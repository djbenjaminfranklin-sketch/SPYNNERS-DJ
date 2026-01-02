"""
SPYNNERS Backend Server
- ACRCloud Audio Recognition
- Chat messaging
- Track upload
- User authentication (local fallback)
"""

import os
import base64
import hashlib
import hmac
import time
import json
import uuid
from datetime import datetime
from typing import Optional, List
from io import BytesIO

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
import httpx

load_dotenv()

app = FastAPI(title="SPYNNERS API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "spynners_db")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
tracks_collection = db["tracks"]
messages_collection = db["messages"]
playlists_collection = db["playlists"]
recognition_history_collection = db["recognition_history"]

# ACRCloud Configuration (to be set by user)
ACRCLOUD_HOST = os.getenv("ACRCLOUD_HOST", "identify-eu-west-1.acrcloud.com")
ACRCLOUD_ACCESS_KEY = os.getenv("ACRCLOUD_ACCESS_KEY", "")
ACRCLOUD_ACCESS_SECRET = os.getenv("ACRCLOUD_ACCESS_SECRET", "")

# Helper to convert ObjectId
def serialize_doc(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ==================== MODELS ====================

class AudioRecognitionRequest(BaseModel):
    audio_base64: str

class MessageSendRequest(BaseModel):
    sender_id: str
    sender_name: str
    recipient_id: str
    type: str = "text"
    content: str

class LocalLoginRequest(BaseModel):
    email: str
    password: str

class LocalSignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    user_type: Optional[str] = None  # dj, producer, dj_producer, label


# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/local/signup")
async def local_signup(request: LocalSignupRequest):
    """Local signup fallback when Base44 is unavailable"""
    existing = users_collection.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Simple password hash (in production use bcrypt)
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    user = {
        "email": request.email.lower(),
        "password_hash": password_hash,
        "full_name": request.full_name,
        "user_type": request.user_type or "dj",
        "created_at": datetime.utcnow().isoformat(),
        "diamonds": 0,
        "is_vip": False
    }
    
    result = users_collection.insert_one(user)
    user_id = str(result.inserted_id)
    
    # Generate simple token
    token = base64.b64encode(f"{user_id}:{time.time()}".encode()).decode()
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": request.email.lower(),
            "full_name": request.full_name,
            "user_type": request.user_type or "dj"
        }
    }

@app.post("/api/auth/local/login")
async def local_login(request: LocalLoginRequest):
    """Local login fallback when Base44 is unavailable"""
    user = users_collection.find_one({"email": request.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    if user.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    token = base64.b64encode(f"{user_id}:{time.time()}".encode()).decode()
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "full_name": user.get("full_name", "User"),
            "user_type": user.get("user_type", "dj")
        }
    }


# ==================== ACRCLOUD RECOGNITION ====================

def generate_acrcloud_signature(http_method: str, http_uri: str, access_key: str, 
                                 data_type: str, signature_version: str, timestamp: str, 
                                 access_secret: str) -> str:
    """Generate ACRCloud API signature"""
    string_to_sign = f"{http_method}\n{http_uri}\n{access_key}\n{data_type}\n{signature_version}\n{timestamp}"
    sign = base64.b64encode(
        hmac.new(
            access_secret.encode('ascii'),
            string_to_sign.encode('ascii'),
            digestmod=hashlib.sha1
        ).digest()
    ).decode('ascii')
    return sign

@app.post("/api/recognize-audio")
async def recognize_audio(request: AudioRecognitionRequest, authorization: Optional[str] = Header(None)):
    """
    Recognize audio using ACRCloud
    Expects base64 encoded audio data
    """
    if not ACRCLOUD_ACCESS_KEY or not ACRCLOUD_ACCESS_SECRET:
        raise HTTPException(
            status_code=503, 
            detail="ACRCloud not configured. Please set ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET in backend/.env"
        )
    
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)
        
        # ACRCloud API parameters
        http_method = "POST"
        http_uri = "/v1/identify"
        data_type = "audio"
        signature_version = "1"
        timestamp = str(int(time.time()))
        
        # Generate signature
        signature = generate_acrcloud_signature(
            http_method, http_uri, ACRCLOUD_ACCESS_KEY,
            data_type, signature_version, timestamp, ACRCLOUD_ACCESS_SECRET
        )
        
        # Prepare request
        files = {
            'sample': ('audio.m4a', BytesIO(audio_data), 'audio/m4a')
        }
        
        data = {
            'access_key': ACRCLOUD_ACCESS_KEY,
            'sample_bytes': len(audio_data),
            'timestamp': timestamp,
            'signature': signature,
            'data_type': data_type,
            'signature_version': signature_version
        }
        
        # Send to ACRCloud
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{ACRCLOUD_HOST}{http_uri}",
                data=data,
                files=files
            )
        
        result = response.json()
        
        # Parse ACRCloud response
        if result.get("status", {}).get("code") == 0:
            # Successfully identified
            music = result.get("metadata", {}).get("music", [])
            if music:
                track = music[0]
                recognition_result = {
                    "success": True,
                    "title": track.get("title", "Unknown"),
                    "artist": ", ".join([a.get("name", "") for a in track.get("artists", [])]) or "Unknown",
                    "album": track.get("album", {}).get("name", ""),
                    "release_date": track.get("release_date", ""),
                    "genres": [g.get("name") for g in track.get("genres", [])],
                    "label": track.get("label", ""),
                    "duration_ms": track.get("duration_ms", 0),
                    "score": track.get("score", 0),
                    "external_ids": track.get("external_ids", {}),
                    "play_offset_ms": result.get("metadata", {}).get("played_duration", 0) * 1000
                }
                
                # Save to history
                if authorization:
                    try:
                        token_data = base64.b64decode(authorization.replace("Bearer ", "")).decode()
                        user_id = token_data.split(":")[0]
                        recognition_history_collection.insert_one({
                            "user_id": user_id,
                            "result": recognition_result,
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except:
                        pass
                
                return recognition_result
        
        # Not recognized
        return {
            "success": False,
            "message": "Could not identify the track",
            "status": result.get("status", {})
        }
        
    except Exception as e:
        print(f"ACRCloud error: {e}")
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")


# ==================== CHAT ENDPOINTS ====================

@app.get("/api/chat/messages")
async def get_messages(user_id: str, contact_id: str, limit: int = 100):
    """Get chat messages between two users"""
    messages = list(messages_collection.find({
        "$or": [
            {"sender_id": user_id, "recipient_id": contact_id},
            {"sender_id": contact_id, "recipient_id": user_id}
        ]
    }).sort("timestamp", 1).limit(limit))
    
    return {
        "success": True,
        "messages": [serialize_doc(m) for m in messages]
    }

@app.post("/api/chat/send")
async def send_message(request: MessageSendRequest):
    """Send a chat message"""
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": request.sender_id,
        "sender_name": request.sender_name,
        "recipient_id": request.recipient_id,
        "type": request.type,
        "content": request.content,
        "timestamp": datetime.utcnow().isoformat(),
        "synced": True,
        "sent_from": "app"
    }
    
    messages_collection.insert_one(message)
    message.pop("_id", None)
    
    return {
        "success": True,
        "message": message,
        "synced": True
    }

@app.post("/api/chat/upload-voice")
async def upload_voice(
    audio: UploadFile = File(...),
    sender_id: str = Form(...),
    recipient_id: str = Form(...)
):
    """Upload voice message"""
    try:
        content = await audio.read()
        
        # Store as base64 (in production, use cloud storage)
        voice_data = base64.b64encode(content).decode()
        voice_url = f"data:audio/m4a;base64,{voice_data}"
        
        return {
            "success": True,
            "url": voice_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TRACK ENDPOINTS ====================

@app.get("/api/tracks")
async def get_tracks(limit: int = 100, genre: Optional[str] = None):
    """Get all tracks"""
    query = {}
    if genre:
        query["genre"] = genre
    
    tracks = list(tracks_collection.find(query).sort("created_at", -1).limit(limit))
    return {
        "success": True,
        "tracks": [serialize_doc(t) for t in tracks]
    }

@app.post("/api/tracks/upload")
async def upload_track(
    title: str = Form(...),
    artist: str = Form(...),
    genre: str = Form(...),
    producer_name: str = Form(None),
    collaborators: str = Form(None),
    label: str = Form(None),
    bpm: str = Form(None),
    key: str = Form(None),
    energy_level: str = Form(None),
    mood: str = Form(None),
    description: str = Form(None),
    is_vip: str = Form("false"),
    isrc_code: str = Form(None),
    iswc_code: str = Form(None),
    release_date: str = Form(None),
    copyright: str = Form(None),
    audio: UploadFile = File(None),
    artwork: UploadFile = File(None),
    audio_url: str = Form(None),
    audio_name: str = Form(None),
    artwork_url: str = Form(None),
    authorization: Optional[str] = Header(None)
):
    """Upload a new track"""
    try:
        # Process audio file
        audio_data = None
        if audio:
            content = await audio.read()
            audio_data = f"data:audio/mpeg;base64,{base64.b64encode(content).decode()}"
        elif audio_url:
            audio_data = audio_url
        
        # Process artwork
        artwork_data = None
        if artwork:
            content = await artwork.read()
            artwork_data = f"data:image/jpeg;base64,{base64.b64encode(content).decode()}"
        elif artwork_url:
            artwork_data = artwork_url
        
        # Parse collaborators
        collab_list = []
        if collaborators:
            try:
                collab_list = json.loads(collaborators)
            except:
                collab_list = [collaborators]
        
        track = {
            "title": title,
            "artist": artist,
            "genre": genre,
            "producer_name": producer_name or artist,
            "collaborators": collab_list,
            "label": label,
            "bpm": int(bpm) if bpm and bpm.isdigit() else None,
            "key": key,
            "energy_level": energy_level,
            "mood": mood,
            "description": description,
            "is_vip": is_vip.lower() == "true",
            "isrc_code": isrc_code,
            "iswc_code": iswc_code,
            "release_date": release_date,
            "copyright": copyright,
            "audio_url": audio_data,
            "artwork_url": artwork_data,
            "status": "pending",  # pending, approved, rejected
            "created_at": datetime.utcnow().isoformat(),
            "play_count": 0,
            "download_count": 0
        }
        
        result = tracks_collection.insert_one(track)
        track["_id"] = str(result.inserted_id)
        
        return {
            "success": True,
            "message": "Track uploaded successfully",
            "track_id": track["_id"],
            "synced": False  # Would be True if synced with spynners.com
        }
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PLAYLIST ENDPOINTS ====================

@app.get("/api/playlists")
async def get_playlists(user_id: str):
    """Get user's playlists"""
    playlists = list(playlists_collection.find({"user_id": user_id}))
    return {
        "success": True,
        "playlists": [serialize_doc(p) for p in playlists]
    }

@app.post("/api/playlists")
async def create_playlist(name: str = Form(...), user_id: str = Form(...)):
    """Create a new playlist"""
    playlist = {
        "name": name,
        "user_id": user_id,
        "tracks": [],
        "created_at": datetime.utcnow().isoformat()
    }
    result = playlists_collection.insert_one(playlist)
    playlist["_id"] = str(result.inserted_id)
    
    return {"success": True, "playlist": playlist}

@app.post("/api/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(playlist_id: str, track_id: str = Form(...)):
    """Add a track to a playlist"""
    playlists_collection.update_one(
        {"_id": ObjectId(playlist_id)},
        {"$addToSet": {"tracks": track_id}}
    )
    return {"success": True}


# ==================== GEOLOCATION / PLACES ====================

@app.get("/api/places/nearby")
async def get_nearby_places(lat: float, lng: float, radius: int = 5000, type: str = "night_club"):
    """
    Get nearby places using Google Places API
    This endpoint proxies requests to Google Places to avoid exposing API key in app
    """
    google_api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    
    if not google_api_key:
        # Return mock data if no API key configured
        return {
            "success": True,
            "places": [
                {
                    "place_id": "mock_1",
                    "name": "Club Example",
                    "vicinity": "123 Music Street",
                    "rating": 4.5,
                    "types": ["night_club", "bar"]
                }
            ],
            "mock": True
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{lat},{lng}",
                    "radius": radius,
                    "type": type,
                    "key": google_api_key
                }
            )
        
        data = response.json()
        return {
            "success": True,
            "places": data.get("results", []),
            "mock": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SPYN NOTIFICATION ====================

class SpynNotificationRequest(BaseModel):
    track_title: str
    track_artist: str
    track_album: Optional[str] = None
    track_cover: Optional[str] = None
    dj_id: Optional[str] = None
    dj_name: str
    venue: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    played_at: Optional[str] = None

@app.post("/api/notify-producer")
async def notify_producer(request: SpynNotificationRequest, authorization: Optional[str] = Header(None)):
    """
    Notify the producer when their track is played (SPYNed) by a DJ.
    Calls the Base44 sendTrackPlayedEmail cloud function.
    """
    try:
        # Extract Bearer token
        user_token = ""
        if authorization and authorization.startswith("Bearer "):
            user_token = authorization.replace("Bearer ", "")
        
        # Base44 API configuration
        BASE44_APP_ID = "691a4d96d819355b52c063f3"
        BASE44_FUNCTION_URL = "https://api.base44.com/v1/functions/invoke/sendTrackPlayedEmail"
        
        # Prepare payload for Base44 function
        payload = {
            "producerId": "",  # Base44 will determine from track info
            "trackTitle": request.track_title,
            "djName": request.dj_name,
            "city": request.city or "Unknown",
            "country": request.country or "Unknown",
            "venue": request.venue or "",
            "trackArtworkUrl": request.track_cover or "",
            "djAvatar": "",  # Will be fetched by Base44 if needed
            "playedAt": request.played_at or datetime.utcnow().isoformat() + "Z",
            "collaborators": []  # Base44 will populate from track data
        }
        
        # Add location coordinates if available
        if request.latitude and request.longitude:
            payload["location"] = {
                "latitude": request.latitude,
                "longitude": request.longitude
            }
        
        # Call Base44 cloud function
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID,
        }
        
        # Add user token if available for authentication
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                BASE44_FUNCTION_URL,
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "message": "Producer notification sent successfully",
                    "details": result
                }
            else:
                # Log the error but don't fail the SPYN operation
                print(f"Base44 notification error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": "Notification service unavailable",
                    "status_code": response.status_code
                }
                
    except Exception as e:
        # Don't fail the entire SPYN operation if notification fails
        print(f"Producer notification error: {e}")
        return {
            "success": False,
            "message": f"Notification failed: {str(e)}"
        }


# ==================== BASE44 PROXY ====================

BASE44_API_URL = "https://app.base44.com/api"
BASE44_APP_ID = "691a4d96d819355b52c063f3"

class Base44LoginRequest(BaseModel):
    email: str
    password: str

class Base44SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    user_type: Optional[str] = None

@app.post("/api/base44/auth/login")
async def base44_login(request: Base44LoginRequest):
    """Proxy login request to Base44 to avoid CORS issues"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/auth/login",
                json={"email": request.email, "password": request.password},
                headers={
                    "Content-Type": "application/json",
                    "X-Base44-App-Id": BASE44_APP_ID
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                # Try to parse error message
                error_message = "Login failed"
                try:
                    error_data = response.json()
                    error_message = error_data.get("message") or error_data.get("detail") or error_message
                except:
                    error_message = response.text or f"Login failed with status {response.status_code}"
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_message
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")

@app.post("/api/base44/auth/signup")
async def base44_signup(request: Base44SignupRequest):
    """Proxy signup request to Base44 to avoid CORS issues"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/auth/signup",
                json={
                    "email": request.email,
                    "password": request.password,
                    "full_name": request.full_name,
                    "user_type": request.user_type
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Base44-App-Id": BASE44_APP_ID
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("message", "Signup failed")
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")

@app.get("/api/base44/auth/me")
async def base44_me(authorization: Optional[str] = Header(None)):
    """Proxy me request to Base44"""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
            
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/auth/me",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Auth failed")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")

@app.get("/api/base44/entities/{entity_name}")
async def base44_list_entities(
    entity_name: str,
    authorization: Optional[str] = Header(None),
    limit: int = 50,
    offset: int = 0,
    sort: Optional[str] = None,
    genre: Optional[str] = None,
    energy_level: Optional[str] = None,
    is_vip: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    user_id: Optional[str] = None,
    receiver_id: Optional[str] = None,
    sender_id: Optional[str] = None,
    read: Optional[str] = None
):
    """Proxy entity list request to Base44"""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
        
        # Build query params
        params = {"limit": limit}
        if offset > 0:
            params["offset"] = offset
        if sort:
            params["sort"] = sort
        if genre:
            params["genre"] = genre
        if energy_level:
            params["energy_level"] = energy_level
        if is_vip:
            params["is_vip"] = is_vip
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        if uploaded_by:
            params["uploaded_by"] = uploaded_by
        if user_id:
            params["user_id"] = user_id
        if receiver_id:
            params["receiver_id"] = receiver_id
        if sender_id:
            params["sender_id"] = sender_id
        if read:
            params["read"] = read
            
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/{entity_name}",
                headers=headers,
                params=params
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Base44 entity error: {response.status_code} - {response.text}")
                return []
    except httpx.RequestError as e:
        print(f"Base44 request error: {e}")
        return []

@app.post("/api/base44/functions/invoke/{function_name}")
async def base44_invoke_function(
    function_name: str,
    request_body: dict = {},
    authorization: Optional[str] = Header(None)
):
    """Proxy function invocation to Base44"""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
        
        # For backend functions like nativeGetAllUsers, use the app's functions endpoint
        if function_name in ["nativeGetAllUsers", "listUsers"]:
            # Use the correct Base44 app functions URL
            app_function_url = f"https://{BASE44_APP_ID}.app.base44.com/functions/{function_name}"
            print(f"[Base44] Calling function URL: {app_function_url}")
            print(f"[Base44] Request body: {request_body}")
            print(f"[Base44] Auth header present: {bool(authorization)}")
            
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                response = await http_client.post(
                    app_function_url,
                    json=request_body,
                    headers=headers
                )
                
                print(f"[Base44] Response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"[Base44] Success! Got response with keys: {list(result.keys()) if isinstance(result, dict) else 'array'}")
                    return result
                else:
                    print(f"[Base44] Function error: {response.status_code} - {response.text[:500]}")
                    # Fall through to try standard API
        
        # Standard Base44 function invocation via platform API
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/functions/invoke/{function_name}",
                json=request_body,
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Function invocation failed: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")


# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "SPYNNERS API",
        "version": "1.0.0",
        "acrcloud_configured": bool(ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/")
async def root():
    return {"message": "SPYNNERS API - Use /api/* endpoints"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
