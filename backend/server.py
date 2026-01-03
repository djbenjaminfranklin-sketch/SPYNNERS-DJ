"""
SPYNNERS Backend Server
- ACRCloud Audio Recognition
- Chat messaging
- Track upload
- User authentication (local fallback)
- MP3 metadata extraction
"""

import os
import base64
import hashlib
import hmac
import time
import json
import uuid
import tempfile
from datetime import datetime
from typing import Optional, List
from io import BytesIO

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
import httpx

# For MP3 metadata extraction
try:
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3, APIC, TIT2, TPE1, TALB, TCON, TBPM
    from mutagen.easyid3 import EasyID3
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("Warning: mutagen not available, MP3 metadata extraction disabled")

# For automatic BPM detection
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("Warning: librosa not available, automatic BPM detection disabled")

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

# Google Places API
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

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
        
        # Prepare request - ACRCloud accepts various formats
        files = {
            'sample': ('audio.wav', BytesIO(audio_data), 'audio/wav')
        }
        
        data = {
            'access_key': ACRCLOUD_ACCESS_KEY,
            'sample_bytes': len(audio_data),
            'timestamp': timestamp,
            'signature': signature,
            'data_type': data_type,
            'signature_version': signature_version
        }
        
        print(f"[ACRCloud] Sending {len(audio_data)} bytes to ACRCloud...")
        
        # Send to ACRCloud
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{ACRCLOUD_HOST}{http_uri}",
                data=data,
                files=files
            )
        
        result = response.json()
        print(f"[ACRCloud] Full response: {json.dumps(result, indent=2)[:500]}")
        
        # Parse ACRCloud response
        status_code = result.get("status", {}).get("code", -1)
        if status_code == 0:
            # Check for custom_files first (Spynners tracks), then music (general tracks)
            custom_files = result.get("metadata", {}).get("custom_files", [])
            music = result.get("metadata", {}).get("music", [])
            
            track = None
            is_custom = False
            
            if custom_files:
                track = custom_files[0]
                is_custom = True
                print(f"[ACRCloud] Found in custom_files (Spynners track)")
            elif music:
                track = music[0]
                print(f"[ACRCloud] Found in music (general track)")
            
            if track:
                # Get ACRCloud ID and track info
                acr_id = track.get("acrid", "")
                track_title = track.get("title", "Unknown")
                
                # For custom files, artist might be in producer_name
                if is_custom:
                    track_artist = track.get("producer_name") or track.get("artist", "Unknown")
                else:
                    track_artist = ", ".join([a.get("name", "") for a in track.get("artists", [])]) or "Unknown"
                
                print(f"[ACRCloud] Identified: {track_title} by {track_artist}")
                print(f"[ACRCloud] ACR ID: {acr_id}")
                
                # For custom files, we already have Spynners data directly
                if is_custom:
                    cover_image = track.get("artwork_url")
                    producer_id = track.get("producer_id")
                    spynners_track_id = track.get("spynners_track_id")
                    genre = track.get("genre", "")
                    
                    print(f"[ACRCloud] Custom file - artwork_url: {cover_image}")
                    print(f"[ACRCloud] Custom file - spynners_track_id: {spynners_track_id}")
                    
                    # Build result directly from custom_files data
                    recognition_result = {
                        "success": True,
                        "title": track_title,
                        "artist": track_artist,
                        "album": track.get("album", ""),
                        "cover_image": cover_image,
                        "genre": genre,
                        "genres": [genre] if genre else [],
                        "release_date": track.get("release_date", ""),
                        "label": track.get("label", ""),
                        "duration_ms": track.get("duration_ms", 0),
                        "score": track.get("score", 0),
                        "bpm": track.get("bpm"),
                        "spynners_track_id": spynners_track_id,
                        "producer_id": producer_id,
                        "acrcloud_id": acr_id,
                        "play_offset_ms": track.get("play_offset_ms", 0),
                        "is_spynners_track": True
                    }
                    
                    print(f"[SPYNNERS] ✅ Direct match from custom_files: {track_title}")
                    return recognition_result
                
                # ==================== SEARCH IN SPYNNERS DATABASE ====================
                # For non-custom tracks, search in Spynners by acrcloud_id or title
                spynners_track = None
                cover_image = None
                producer_email = None
                
                try:
                    # Clean title for search (remove parentheses content like "Extended", "Original Mix")
                    import re
                    from difflib import SequenceMatcher
                    
                    # Normalize function for better matching
                    def normalize_title(title):
                        if not title:
                            return ""
                        # Remove parentheses content
                        title = re.sub(r'\s*\([^)]*\)\s*', ' ', title)
                        # Remove special characters except spaces
                        title = re.sub(r'[^\w\s]', ' ', title)
                        # Normalize spaces
                        title = ' '.join(title.split())
                        return title.lower().strip()
                    
                    def similarity_score(a, b):
                        """Calculate similarity between two strings (0-1)"""
                        return SequenceMatcher(None, a, b).ratio()
                    
                    clean_title = normalize_title(track_title)
                    clean_artist = normalize_title(track_artist)
                    
                    print(f"[SPYNNERS] Searching for: '{track_title}' (normalized: '{clean_title}')")
                    print(f"[SPYNNERS] Artist: '{track_artist}' (normalized: '{clean_artist}')")
                    
                    # Search by acrcloud_id first
                    if acr_id:
                        spynners_search_url = f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track"
                        async with httpx.AsyncClient(timeout=10.0) as search_client:
                            search_resp = await search_client.get(
                                spynners_search_url,
                                params={"acrcloud_id": acr_id, "limit": 1},
                                headers={"X-Base44-App-Id": BASE44_APP_ID}
                            )
                            if search_resp.status_code == 200:
                                tracks = search_resp.json()
                                if tracks and len(tracks) > 0:
                                    spynners_track = tracks[0]
                                    print(f"[SPYNNERS] ✅ Found track by acrcloud_id: {spynners_track.get('title')}")
                    
                    # If not found by acrcloud_id, search by title with fuzzy matching
                    if not spynners_track:
                        async with httpx.AsyncClient(timeout=10.0) as search_client:
                            search_resp = await search_client.get(
                                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track",
                                params={"limit": 500},
                                headers={"X-Base44-App-Id": BASE44_APP_ID}
                            )
                            if search_resp.status_code == 200:
                                all_tracks = search_resp.json()
                                print(f"[SPYNNERS] Searching through {len(all_tracks)} tracks...")
                                
                                best_match = None
                                best_score = 0
                                
                                for t in all_tracks:
                                    t_title = t.get("title") or ""
                                    t_producer = t.get("producer_name") or ""
                                    
                                    if not t_title:
                                        continue
                                    
                                    t_title_norm = normalize_title(t_title)
                                    t_producer_norm = normalize_title(t_producer)
                                    
                                    # Calculate title similarity
                                    title_score = similarity_score(clean_title, t_title_norm)
                                    
                                    # Bonus if artist/producer matches
                                    artist_bonus = 0
                                    if clean_artist and t_producer_norm:
                                        artist_score = similarity_score(clean_artist, t_producer_norm)
                                        if artist_score > 0.5:
                                            artist_bonus = 0.2
                                        # Check if artist name is in producer name or vice versa
                                        if clean_artist in t_producer_norm or t_producer_norm in clean_artist:
                                            artist_bonus = 0.3
                                    
                                    # Check if title contains the search term or vice versa
                                    contains_bonus = 0
                                    if clean_title in t_title_norm or t_title_norm in clean_title:
                                        contains_bonus = 0.2
                                    
                                    # Check for key words match
                                    clean_words = set(clean_title.split())
                                    t_words = set(t_title_norm.split())
                                    common_words = clean_words & t_words
                                    if len(common_words) > 0:
                                        word_bonus = len(common_words) / max(len(clean_words), len(t_words)) * 0.3
                                    else:
                                        word_bonus = 0
                                    
                                    # Special bonus for remix tracks - check if original artist matches
                                    remix_bonus = 0
                                    if 'remix' in clean_title or 'remix' in t_title_norm:
                                        # Extract potential original artist from title
                                        for word in clean_words:
                                            if len(word) > 3 and word in t_title_norm:
                                                remix_bonus = 0.15
                                                break
                                    
                                    total_score = title_score + artist_bonus + contains_bonus + word_bonus + remix_bonus
                                    
                                    # Exact match - perfect score
                                    if t_title_norm == clean_title:
                                        total_score = 2.0
                                    
                                    # Log potential matches for debugging
                                    if total_score > 0.3:
                                        print(f"[SPYNNERS] Candidate: '{t.get('title')}' score={total_score:.2f}")
                                    
                                    if total_score > best_score:
                                        best_score = total_score
                                        best_match = t
                                
                                # Accept match if score is above threshold (lowered to 0.45)
                                if best_match and best_score >= 0.45:
                                    spynners_track = best_match
                                    print(f"[SPYNNERS] ✅ Found track by fuzzy match (score: {best_score:.2f}): '{best_match.get('title')}'")
                                elif best_match:
                                    print(f"[SPYNNERS] ⚠️ Best match score too low ({best_score:.2f}): '{best_match.get('title')}'")
                    
                    # Get artwork and producer info from Spynners track
                    if spynners_track:
                        cover_image = spynners_track.get("artwork_url")
                        producer_id = spynners_track.get("producer_id")
                        
                        print(f"[SPYNNERS] Artwork URL: {cover_image}")
                        print(f"[SPYNNERS] Producer ID: {producer_id}")
                        
                        # Update the acrcloud_id in Spynners if it was empty
                        if acr_id and not spynners_track.get("acrcloud_id"):
                            try:
                                async with httpx.AsyncClient(timeout=5.0) as update_client:
                                    await update_client.put(
                                        f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track/{spynners_track.get('id')}",
                                        json={"acrcloud_id": acr_id},
                                        headers={"X-Base44-App-Id": BASE44_APP_ID}
                                    )
                                    print(f"[SPYNNERS] Updated acrcloud_id for track")
                            except:
                                pass
                        
                        # Get producer email for notification
                        if producer_id:
                            try:
                                async with httpx.AsyncClient(timeout=5.0) as user_client:
                                    user_resp = await user_client.get(
                                        f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{producer_id}",
                                        headers={"X-Base44-App-Id": BASE44_APP_ID}
                                    )
                                    if user_resp.status_code == 200:
                                        producer = user_resp.json()
                                        producer_email = producer.get("email")
                                        print(f"[SPYNNERS] Producer email: {producer_email}")
                            except Exception as e:
                                print(f"[SPYNNERS] Could not get producer email: {e}")
                    else:
                        print(f"[SPYNNERS] Track NOT found in Spynners database: '{track_title}' by '{track_artist}'")
                        
                except Exception as e:
                    print(f"[SPYNNERS] Error searching Spynners database: {e}")
                
                # Extract genre from Spynners track or ACRCloud
                genre = ""
                if spynners_track:
                    genre = spynners_track.get("genre", "")
                if not genre:
                    genres = [g.get("name") for g in track.get("genres", [])]
                    genre = genres[0] if genres else ""
                
                # Build recognition result using SPYNNERS data
                recognition_result = {
                    "success": True,
                    "title": spynners_track.get("title") if spynners_track else track_title,
                    "artist": spynners_track.get("producer_name") if spynners_track else track_artist,
                    "album": spynners_track.get("album", "") if spynners_track else track.get("album", {}).get("name", ""),
                    "cover_image": cover_image,  # From Spynners artwork_url
                    "genre": genre,
                    "genres": [genre] if genre else [],
                    "release_date": spynners_track.get("release_date", "") if spynners_track else "",
                    "label": spynners_track.get("label", "") if spynners_track else "",
                    "duration_ms": track.get("duration_ms", 0),
                    "score": track.get("score", 0),
                    "bpm": spynners_track.get("bpm") if spynners_track else None,
                    "energy_level": spynners_track.get("energy_level") if spynners_track else None,
                    "mood": spynners_track.get("mood") if spynners_track else None,
                    "spynners_track_id": spynners_track.get("id") if spynners_track else None,
                    "producer_id": spynners_track.get("producer_id") if spynners_track else None,
                    "producer_email": producer_email,
                    "acrcloud_id": acr_id,
                    "isrc": spynners_track.get("isrc") if spynners_track else None,
                    "play_offset_ms": result.get("metadata", {}).get("played_duration", 0) * 1000
                }
                
                print(f"[SPYNNERS] Final result: {recognition_result['title']} by {recognition_result['artist']}")
                print(f"[SPYNNERS] Cover image: {cover_image}")
                
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


# ==================== GOOGLE PLACES API ====================

@app.get("/api/nearby-places")
async def get_nearby_places(lat: float, lng: float):
    """
    Get nearby venues (clubs, bars, night clubs) using Google Places API.
    Returns the name of the most likely venue the user is at.
    """
    try:
        if not GOOGLE_PLACES_API_KEY:
            return {"success": False, "message": "Google Places API key not configured"}
        
        # Search for nearby venues - prioritize night clubs, bars, clubs
        types_to_search = ["night_club", "bar", "cafe", "restaurant", "establishment"]
        
        best_venue = None
        min_distance = float('inf')
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            for place_type in types_to_search[:2]:  # Only search night_club and bar for speed
                url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
                params = {
                    "location": f"{lat},{lng}",
                    "radius": 100,  # 100 meters radius - very close venues only
                    "type": place_type,
                    "key": GOOGLE_PLACES_API_KEY
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("status") == "OK" and data.get("results"):
                        for place in data["results"]:
                            # Calculate rough distance (already filtered by radius)
                            place_lat = place["geometry"]["location"]["lat"]
                            place_lng = place["geometry"]["location"]["lng"]
                            
                            # Simple distance calculation
                            distance = ((place_lat - lat) ** 2 + (place_lng - lng) ** 2) ** 0.5
                            
                            if distance < min_distance:
                                min_distance = distance
                                best_venue = place["name"]
                
                if best_venue:
                    break  # Found a venue, no need to search more types
        
        if best_venue:
            print(f"[Google Places] Found venue: {best_venue} at ({lat}, {lng})")
            return {
                "success": True,
                "venue": best_venue
            }
        
        return {
            "success": False,
            "message": "No nearby venues found"
        }
        
    except Exception as e:
        print(f"Google Places error: {e}")
        return {
            "success": False,
            "message": f"Places lookup failed: {str(e)}"
        }


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

# ==================== MP3 METADATA EXTRACTION ====================

async def detect_bpm_with_acrcloud(audio_data: bytes) -> dict:
    """
    Use ACRCloud to detect BPM and other audio features.
    This is more accurate than librosa for electronic music.
    """
    if not ACRCLOUD_ACCESS_KEY or not ACRCLOUD_ACCESS_SECRET:
        print("[ACRCloud BPM] ACRCloud not configured")
        return {}
    
    try:
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
        
        # Prepare request - send first 30 seconds of audio for faster processing
        # ACRCloud can identify from a small sample
        sample_size = min(len(audio_data), 30 * 44100 * 2)  # ~30 sec at 44.1kHz stereo
        audio_sample = audio_data[:sample_size] if len(audio_data) > sample_size else audio_data
        
        files = {
            'sample': ('audio.mp3', BytesIO(audio_sample), 'audio/mpeg')
        }
        
        data = {
            'access_key': ACRCLOUD_ACCESS_KEY,
            'sample_bytes': len(audio_sample),
            'timestamp': timestamp,
            'signature': signature,
            'data_type': data_type,
            'signature_version': signature_version
        }
        
        print(f"[ACRCloud BPM] Sending {len(audio_sample)} bytes for analysis...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{ACRCLOUD_HOST}{http_uri}",
                data=data,
                files=files
            )
        
        result = response.json()
        print(f"[ACRCloud BPM] Response status: {result.get('status', {})}")
        
        extracted = {}
        
        if result.get("status", {}).get("code") == 0:
            # Successfully identified
            music = result.get("metadata", {}).get("music", [])
            if music:
                track = music[0]
                
                # Extract BPM if available
                if track.get("bpm"):
                    extracted["bpm"] = int(track.get("bpm"))
                    print(f"[ACRCloud BPM] Detected BPM: {extracted['bpm']}")
                
                # Extract genre if available
                genres = track.get("genres", [])
                if genres:
                    extracted["genre"] = genres[0].get("name", "")
                    print(f"[ACRCloud BPM] Detected genre: {extracted['genre']}")
                
                # Also get title/artist as fallback
                if track.get("title"):
                    extracted["title"] = track.get("title")
                if track.get("artists"):
                    artists = track.get("artists", [])
                    if artists:
                        extracted["artist"] = ", ".join([a.get("name", "") for a in artists])
        else:
            print(f"[ACRCloud BPM] Track not recognized: {result.get('status', {}).get('msg', 'Unknown error')}")
        
        return extracted
        
    except Exception as e:
        print(f"[ACRCloud BPM] Error: {e}")
        return {}


@app.post("/api/extract-mp3-metadata")
async def extract_mp3_metadata(file: UploadFile = File(...)):
    """Extract metadata from MP3 file including cover art, BPM, genre using ACRCloud"""
    if not MUTAGEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="MP3 metadata extraction not available")
    
    try:
        # Read file content
        content = await file.read()
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        result = {
            "title": None,
            "artist": None,
            "album": None,
            "genre": None,
            "bpm": None,
            "cover_image": None,
            "duration": None,
        }
        
        try:
            # Try to read MP3 metadata from ID3 tags
            audio = MP3(tmp_path)
            
            # Get duration
            if audio.info:
                result["duration"] = int(audio.info.length)
            
            # Try ID3 tags first
            try:
                tags = ID3(tmp_path)
                
                # Title
                if 'TIT2' in tags:
                    result["title"] = str(tags['TIT2'].text[0])
                
                # Artist
                if 'TPE1' in tags:
                    result["artist"] = str(tags['TPE1'].text[0])
                
                # Album
                if 'TALB' in tags:
                    result["album"] = str(tags['TALB'].text[0])
                
                # Genre - try multiple tag formats
                if 'TCON' in tags:
                    result["genre"] = str(tags['TCON'].text[0])
                
                # BPM - try multiple tag formats
                if 'TBPM' in tags:
                    try:
                        bpm_val = str(tags['TBPM'].text[0])
                        result["bpm"] = int(float(bpm_val))
                    except:
                        pass
                
                # Try TXXX frames for custom tags (BPM, genre might be there)
                for key in tags.keys():
                    if key.startswith('TXXX'):
                        frame = tags[key]
                        desc = frame.desc.lower() if hasattr(frame, 'desc') else ''
                        if 'bpm' in desc and not result["bpm"]:
                            try:
                                result["bpm"] = int(float(str(frame.text[0])))
                            except:
                                pass
                        elif 'genre' in desc and not result["genre"]:
                            result["genre"] = str(frame.text[0])
                
                # Cover art
                for key in tags.keys():
                    if key.startswith('APIC'):
                        apic = tags[key]
                        if apic.data:
                            # Convert to base64
                            cover_base64 = base64.b64encode(apic.data).decode('utf-8')
                            mime_type = apic.mime if hasattr(apic, 'mime') else 'image/jpeg'
                            result["cover_image"] = f"data:{mime_type};base64,{cover_base64}"
                            break
                            
            except Exception as id3_error:
                print(f"ID3 tags error: {id3_error}")
            
            # Try EasyID3 as fallback for missing fields
            try:
                easy_tags = EasyID3(tmp_path)
                if not result["title"] and 'title' in easy_tags:
                    result["title"] = str(easy_tags['title'][0])
                if not result["artist"] and 'artist' in easy_tags:
                    result["artist"] = str(easy_tags['artist'][0])
                if not result["genre"] and 'genre' in easy_tags:
                    result["genre"] = str(easy_tags['genre'][0])
                if not result["bpm"] and 'bpm' in easy_tags:
                    try:
                        result["bpm"] = int(float(str(easy_tags['bpm'][0])))
                    except:
                        pass
            except Exception as easy_error:
                print(f"EasyID3 error: {easy_error}")
            
            print(f"[MP3 Metadata] Extracted from ID3 tags: title={result['title']}, artist={result['artist']}, genre={result['genre']}, bpm={result['bpm']}, has_cover={result['cover_image'] is not None}")
            
            # ========== ACRCloud Detection for BPM (Primary Method) ==========
            # Use ACRCloud if BPM not found in tags - this is more accurate for electronic music
            if result["bpm"] is None:
                print(f"[MP3 Metadata] BPM not in tags, trying ACRCloud detection...")
                acr_result = await detect_bpm_with_acrcloud(content)
                
                if acr_result.get("bpm"):
                    result["bpm"] = acr_result["bpm"]
                    print(f"[MP3 Metadata] ACRCloud detected BPM: {result['bpm']}")
                
                # Also use ACRCloud genre if not found in tags
                if not result["genre"] and acr_result.get("genre"):
                    result["genre"] = acr_result["genre"]
                    print(f"[MP3 Metadata] ACRCloud detected genre: {result['genre']}")
            
            # ========== Fallback to librosa if ACRCloud didn't find BPM ==========
            if result["bpm"] is None and LIBROSA_AVAILABLE:
                try:
                    print(f"[MP3 Metadata] Fallback: Attempting BPM detection with librosa...")
                    # Load audio file (first 60 seconds for faster processing)
                    y, sr = librosa.load(tmp_path, sr=None, duration=60)
                    # Detect tempo (BPM)
                    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                    if tempo is not None:
                        # tempo can be an array, get the first value
                        if hasattr(tempo, '__iter__'):
                            bpm_value = float(tempo[0]) if len(tempo) > 0 else float(tempo)
                        else:
                            bpm_value = float(tempo)
                        result["bpm"] = int(round(bpm_value))
                        print(f"[MP3 Metadata] Librosa detected BPM: {result['bpm']}")
                except Exception as bpm_error:
                    print(f"[MP3 Metadata] Librosa BPM detection error: {bpm_error}")
                
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
        
        print(f"[MP3 Metadata] Final result: title={result['title']}, artist={result['artist']}, genre={result['genre']}, bpm={result['bpm']}")
        return result
        
    except Exception as e:
        print(f"[MP3 Metadata] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract metadata: {str(e)}")

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

@app.post("/api/base44/entities/{entity_name}")
async def base44_create_entity(
    entity_name: str,
    request_body: dict = {},
    authorization: Optional[str] = Header(None)
):
    """Proxy entity creation to Base44"""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
        
        print(f"[Base44] Creating entity {entity_name}")
        print(f"[Base44] Data keys: {list(request_body.keys())}")
        
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/{entity_name}",
                headers=headers,
                json=request_body
            )
            
            print(f"[Base44] Create response: {response.status_code}")
            
            if response.status_code in [200, 201]:
                return response.json()
            else:
                print(f"Base44 create error: {response.status_code} - {response.text[:500]}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create entity: {response.text}"
                )
    except httpx.RequestError as e:
        print(f"Base44 request error: {e}")
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")

@app.put("/api/base44/entities/{entity_name}/{entity_id}")
async def base44_update_entity(
    entity_name: str,
    entity_id: str,
    request_body: dict = {},
    authorization: Optional[str] = Header(None)
):
    """Proxy entity update to Base44"""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
        
        print(f"[Base44] Updating entity {entity_name}/{entity_id}")
        
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.put(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/{entity_name}/{entity_id}",
                headers=headers,
                json=request_body
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Base44 update error: {response.status_code} - {response.text[:500]}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to update entity: {response.text}"
                )
    except httpx.RequestError as e:
        print(f"Base44 request error: {e}")
        raise HTTPException(status_code=503, detail=f"Base44 service unavailable: {str(e)}")

@app.post("/api/base44/functions/invoke/{function_name}")
async def base44_invoke_function(
    function_name: str,
    request: Request,
    request_body: dict = {},
    authorization: Optional[str] = Header(None)
):
    """Proxy function invocation to Base44"""
    try:
        # Debug: Log all incoming headers
        print(f"[Base44] Incoming headers: {dict(request.headers)}")
        print(f"[Base44] Authorization from Header: {authorization}")
        
        # Try to get auth from headers directly if Header() didn't work
        if not authorization:
            authorization = request.headers.get("authorization") or request.headers.get("Authorization")
            print(f"[Base44] Authorization from request.headers: {authorization}")
        
        headers = {
            "Content-Type": "application/json",
            "X-Base44-App-Id": BASE44_APP_ID
        }
        if authorization:
            headers["Authorization"] = authorization
        
        # List of functions that use spynners.com domain
        SPYNNERS_FUNCTIONS = [
            "nativeGetAllUsers", 
            "listUsers", 
            "getPublicProfiles",
            "getAdminData",
            "sendTrackPlayedEmail",
            "getLiveTrackPlays"
        ]
        
        # For backend functions, use the app's domain
        if function_name in SPYNNERS_FUNCTIONS:
            # Use spynners.com domain for app functions
            app_function_url = f"https://spynners.com/api/functions/{function_name}"
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
                    print(f"[Base44] Success! Got response")
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


# ==================== DIAMOND REWARDS ====================

class AwardDiamondRequest(BaseModel):
    user_id: str
    type: str = "black"  # black, gold, etc
    reason: str = "spyn_session"
    session_id: Optional[str] = None

@app.post("/api/award-diamond")
async def award_diamond(request: AwardDiamondRequest, authorization: Optional[str] = Header(None)):
    """
    Award a diamond to a user for completing a SPYN session.
    Only one black diamond per day can be earned.
    """
    try:
        user_id = request.user_id
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Check if user already earned a diamond today
        existing_award = db["diamond_awards"].find_one({
            "user_id": user_id,
            "type": request.type,
            "date": today
        })
        
        if existing_award:
            return {
                "success": False,
                "message": "Already earned a diamond today",
                "already_awarded": True
            }
        
        # Record the diamond award
        award = {
            "user_id": user_id,
            "type": request.type,
            "reason": request.reason,
            "session_id": request.session_id,
            "date": today,
            "awarded_at": datetime.utcnow().isoformat()
        }
        db["diamond_awards"].insert_one(award)
        
        # Update user's diamond count in Base44
        if authorization:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "X-Base44-App-Id": BASE44_APP_ID,
                    "Authorization": authorization
                }
                
                # Get current user data to increment diamonds
                async with httpx.AsyncClient(timeout=30.0) as http_client:
                    # Try to update user's diamonds in Base44
                    user_response = await http_client.get(
                        f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{user_id}",
                        headers=headers
                    )
                    
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        current_diamonds = user_data.get("black_diamonds", 0)
                        
                        # Update with incremented diamonds
                        await http_client.put(
                            f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{user_id}",
                            headers=headers,
                            json={"black_diamonds": current_diamonds + 1}
                        )
            except Exception as e:
                print(f"Could not update user diamonds in Base44: {e}")
        
        return {
            "success": True,
            "message": "Diamond awarded!",
            "type": request.type,
            "date": today
        }
        
    except Exception as e:
        print(f"Award diamond error: {e}")
        return {
            "success": False,
            "message": f"Failed to award diamond: {str(e)}"
        }


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
