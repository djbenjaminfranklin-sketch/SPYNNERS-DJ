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
