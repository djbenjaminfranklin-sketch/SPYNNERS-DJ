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
from fastapi.responses import FileResponse
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

# Spynners Native API Base URL
SPYNNERS_FUNCTIONS_URL = "https://spynners.base44.app/functions"

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
        
        # Detect audio format from magic bytes
        audio_format = "audio/wav"  # Default
        audio_extension = "wav"
        needs_conversion = False
        
        # Check magic bytes for common formats
        if audio_data[:4] == b'RIFF':
            audio_format = "audio/wav"
            audio_extension = "wav"
        elif audio_data[:4] == b'\x1aE\xdf\xa3':  # WebM/Matroska
            audio_format = "audio/webm"
            audio_extension = "webm"
            needs_conversion = True  # WebM needs conversion for better ACRCloud compatibility
        elif audio_data[:4] == b'ftyp' or audio_data[4:8] == b'ftyp':  # MP4/M4A
            audio_format = "audio/mp4"
            audio_extension = "m4a"
            needs_conversion = True  # M4A needs conversion
        elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':  # MP3
            audio_format = "audio/mpeg"
            audio_extension = "mp3"
        elif audio_data[:4] == b'OggS':  # OGG
            audio_format = "audio/ogg"
            audio_extension = "ogg"
            needs_conversion = True  # OGG needs conversion
        
        print(f"[ACRCloud] Audio format detected: {audio_format} ({len(audio_data)} bytes)")
        print(f"[ACRCloud] First 20 bytes (hex): {audio_data[:20].hex()}")
        
        # Convert non-WAV formats to WAV for better ACRCloud compatibility
        if needs_conversion:
            print(f"[ACRCloud] Converting {audio_format} to WAV for better recognition...")
            import subprocess
            import tempfile
            import os
            
            # Create temp files for conversion
            with tempfile.NamedTemporaryFile(suffix=f'.{audio_extension}', delete=False) as input_file:
                input_file.write(audio_data)
                input_path = input_file.name
            
            output_path = input_path.replace(f'.{audio_extension}', '.wav')
            
            try:
                # Convert to WAV using ffmpeg
                # Use high quality settings for better fingerprinting
                cmd = [
                    'ffmpeg', '-y', '-i', input_path,
                    '-ar', '44100',  # 44.1kHz sample rate
                    '-ac', '1',      # Mono
                    '-acodec', 'pcm_s16le',  # 16-bit PCM
                    output_path
                ]
                print(f"[ACRCloud] Running conversion: {' '.join(cmd)}")
                
                result = subprocess.run(cmd, capture_output=True, timeout=30)
                
                print(f"[ACRCloud] ffmpeg return code: {result.returncode}")
                if result.stderr:
                    stderr_text = result.stderr.decode()
                    print(f"[ACRCloud] ffmpeg stderr (last 500 chars): {stderr_text[-500:]}")
                
                if result.returncode == 0 and os.path.exists(output_path):
                    with open(output_path, 'rb') as f:
                        audio_data = f.read()
                    audio_format = "audio/wav"
                    audio_extension = "wav"
                    print(f"[ACRCloud] Conversion successful! New size: {len(audio_data)} bytes")
                    # Cleanup now that we have the data
                    try:
                        os.unlink(input_path)
                        os.unlink(output_path)
                    except:
                        pass
                else:
                    error_output = result.stderr.decode()[-500:] if result.stderr else "No error message"
                    print(f"[ACRCloud] Conversion failed. Return code: {result.returncode}")
                    print(f"[ACRCloud] Error: {error_output}")
                    # Cleanup input file only
                    try:
                        os.unlink(input_path)
                    except:
                        pass
            except Exception as e:
                print(f"[ACRCloud] Conversion error: {e}")
                import traceback
                traceback.print_exc()
                # Cleanup on error
                try:
                    if os.path.exists(input_path):
                        os.unlink(input_path)
                    if os.path.exists(output_path):
                        os.unlink(output_path)
                except:
                    pass
        
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
        # Use detected format instead of hardcoded wav
        files = {
            'sample': (f'audio.{audio_extension}', BytesIO(audio_data), audio_format)
        }
        
        data = {
            'access_key': ACRCLOUD_ACCESS_KEY,
            'sample_bytes': len(audio_data),
            'timestamp': timestamp,
            'signature': signature,
            'data_type': data_type,
            'signature_version': signature_version
        }
        
        print(f"[ACRCloud] Sending {len(audio_data)} bytes as {audio_format} to ACRCloud...")
        
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
                    spynners_track_id = track.get("spynners_track_id")
                    genre = track.get("genre", "")
                    producer_id = None
                    producer_email = None
                    
                    print(f"[ACRCloud] Custom file - artwork_url: {cover_image}")
                    print(f"[ACRCloud] Custom file - spynners_track_id: {spynners_track_id}")
                    
                    # Fetch full track details from Spynners to get producer_id
                    if spynners_track_id:
                        try:
                            async with httpx.AsyncClient(timeout=5.0) as spynners_client:
                                track_resp = await spynners_client.get(
                                    f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track/{spynners_track_id}",
                                    headers={"X-Base44-App-Id": BASE44_APP_ID}
                                )
                                if track_resp.status_code == 200:
                                    spynners_track_data = track_resp.json()
                                    producer_id = spynners_track_data.get("producer_id")
                                    if not cover_image:
                                        cover_image = spynners_track_data.get("artwork_url")
                                    if not genre:
                                        genre = spynners_track_data.get("genre", "")
                                    print(f"[SPYNNERS] Fetched track details - producer_id: {producer_id}")
                                    
                                    # Get producer email
                                    if producer_id:
                                        try:
                                            user_resp = await spynners_client.get(
                                                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{producer_id}",
                                                headers={"X-Base44-App-Id": BASE44_APP_ID}
                                            )
                                            if user_resp.status_code == 200:
                                                producer = user_resp.json()
                                                producer_email = producer.get("email")
                                                print(f"[SPYNNERS] Producer email: {producer_email}")
                                        except Exception as e:
                                            print(f"[SPYNNERS] Could not get producer email: {e}")
                        except Exception as e:
                            print(f"[SPYNNERS] Could not fetch track details: {e}")
                    
                    # Build result directly from custom_files data + Spynners lookup
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
                        "producer_email": producer_email,
                        "acrcloud_id": acr_id,
                        "play_offset_ms": track.get("play_offset_ms", 0),
                        "is_spynners_track": True
                    }
                    
                    print(f"[SPYNNERS] ✅ Direct match from custom_files: {track_title}")
                    print(f"[SPYNNERS] Producer ID: {producer_id}, Email: {producer_email}")
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


# ==================== AUDIO CONVERSION ====================

class ConvertAudioRequest(BaseModel):
    audio_base64: str
    output_format: str = "mp3"  # mp3, wav, etc.

@app.post("/api/convert-audio")
async def convert_audio(request: ConvertAudioRequest):
    """
    Convert audio from one format to another (e.g., m4a to mp3)
    Returns the converted audio as base64
    """
    import subprocess
    import tempfile
    import os
    
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)
        print(f"[Audio Convert] Received {len(audio_data)} bytes for conversion to {request.output_format}")
        
        # Detect input format from magic bytes
        input_extension = "m4a"  # Default
        if audio_data[:4] == b'RIFF':
            input_extension = "wav"
        elif audio_data[:4] == b'\x1aE\xdf\xa3':
            input_extension = "webm"
        elif audio_data[:4] == b'ftyp' or audio_data[4:8] == b'ftyp':
            input_extension = "m4a"
        elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':
            input_extension = "mp3"
        elif audio_data[:4] == b'OggS':
            input_extension = "ogg"
        
        print(f"[Audio Convert] Detected input format: {input_extension}")
        
        # Create temp files
        with tempfile.NamedTemporaryFile(suffix=f'.{input_extension}', delete=False) as input_file:
            input_file.write(audio_data)
            input_path = input_file.name
        
        output_path = input_path.replace(f'.{input_extension}', f'.{request.output_format}')
        
        try:
            # Convert using ffmpeg
            if request.output_format == "mp3":
                # High quality MP3 conversion
                cmd = [
                    'ffmpeg', '-y', '-i', input_path,
                    '-ar', '44100',      # 44.1kHz sample rate
                    '-ac', '2',          # Stereo
                    '-b:a', '320k',      # 320kbps bitrate
                    '-codec:a', 'libmp3lame',
                    output_path
                ]
            else:
                # Generic conversion
                cmd = [
                    'ffmpeg', '-y', '-i', input_path,
                    '-ar', '44100',
                    '-ac', '2',
                    output_path
                ]
            
            print(f"[Audio Convert] Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, timeout=120)
            
            if result.returncode == 0 and os.path.exists(output_path):
                with open(output_path, 'rb') as f:
                    converted_data = f.read()
                
                converted_base64 = base64.b64encode(converted_data).decode('utf-8')
                print(f"[Audio Convert] Conversion successful! Output size: {len(converted_data)} bytes")
                
                return {
                    "success": True,
                    "audio_base64": converted_base64,
                    "format": request.output_format,
                    "size": len(converted_data)
                }
            else:
                error_msg = result.stderr.decode()[:500] if result.stderr else "Unknown error"
                print(f"[Audio Convert] Conversion failed: {error_msg}")
                return {
                    "success": False,
                    "message": f"Conversion failed: {error_msg}"
                }
                
        finally:
            # Cleanup temp files
            try:
                os.unlink(input_path)
                if os.path.exists(output_path):
                    os.unlink(output_path)
            except:
                pass
                
    except Exception as e:
        print(f"[Audio Convert] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


class ConcatenateAudioRequest(BaseModel):
    audio_segments: List[str]  # List of base64 encoded audio segments
    output_format: str = "m4a"  # Output format

@app.post("/api/concatenate-audio")
async def concatenate_audio(request: ConcatenateAudioRequest):
    """
    Concatenate multiple audio segments into a single file
    Returns the concatenated audio as base64
    """
    import subprocess
    import tempfile
    import os
    
    try:
        if not request.audio_segments:
            return {
                "success": False,
                "message": "No audio segments provided"
            }
        
        print(f"[Audio Concat] Concatenating {len(request.audio_segments)} segments")
        
        # Create temp directory for segments
        temp_dir = tempfile.mkdtemp()
        segment_paths = []
        
        try:
            # Save each segment as a temp file
            for i, segment_base64 in enumerate(request.audio_segments):
                segment_data = base64.b64decode(segment_base64)
                segment_path = os.path.join(temp_dir, f"segment_{i:03d}.m4a")
                
                with open(segment_path, 'wb') as f:
                    f.write(segment_data)
                
                segment_paths.append(segment_path)
                print(f"[Audio Concat] Saved segment {i+1}: {len(segment_data)} bytes")
            
            # Create ffmpeg concat file
            concat_file_path = os.path.join(temp_dir, "concat_list.txt")
            with open(concat_file_path, 'w') as f:
                for segment_path in segment_paths:
                    f.write(f"file '{segment_path}'\n")
            
            # Output file
            output_path = os.path.join(temp_dir, f"concatenated.{request.output_format}")
            
            # Run ffmpeg concatenation
            cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat_file_path,
                '-c', 'copy',  # Copy streams without re-encoding for speed
                output_path
            ]
            
            print(f"[Audio Concat] Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, timeout=300)  # 5 minute timeout
            
            if result.returncode == 0 and os.path.exists(output_path):
                with open(output_path, 'rb') as f:
                    concatenated_data = f.read()
                
                concatenated_base64 = base64.b64encode(concatenated_data).decode('utf-8')
                print(f"[Audio Concat] Concatenation successful! Output size: {len(concatenated_data)} bytes")
                
                return {
                    "success": True,
                    "audio_base64": concatenated_base64,
                    "format": request.output_format,
                    "size": len(concatenated_data),
                    "segments_count": len(request.audio_segments)
                }
            else:
                error_msg = result.stderr.decode()[:500] if result.stderr else "Unknown error"
                print(f"[Audio Concat] Concatenation failed: {error_msg}")
                return {
                    "success": False,
                    "message": f"Concatenation failed: {error_msg}"
                }
                
        finally:
            # Cleanup temp files
            try:
                import shutil
                shutil.rmtree(temp_dir)
            except:
                pass
                
    except Exception as e:
        print(f"[Audio Concat] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Concatenation failed: {str(e)}")


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

@app.get("/api/tracks/{track_id}")
async def get_track_by_id(track_id: str, authorization: Optional[str] = Header(None)):
    """Get a single track by ID"""
    try:
        print(f"[Tracks] Getting track by ID: {track_id}")
        
        # Try local database first
        track = tracks_collection.find_one({"_id": ObjectId(track_id)}) if ObjectId.is_valid(track_id) else None
        
        if track:
            return serialize_doc(track)
        
        # Try Spynners native API
        headers = {}
        if authorization:
            headers["Authorization"] = authorization
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # First try direct track endpoint
            try:
                response = await client.get(
                    f"https://spynners.com/api/tracks/{track_id}",
                    headers=headers
                )
                if response.status_code == 200:
                    return response.json()
            except:
                pass
            
            # Fallback: search in all tracks
            all_tracks_response = await client.post(
                "https://spynners.com/api/functions/nativeGetTracks",
                json={"limit": 500},
                headers=headers
            )
            
            if all_tracks_response.status_code == 200:
                data = all_tracks_response.json()
                tracks = data.get("tracks", [])
                for t in tracks:
                    if t.get("id") == track_id or t.get("_id") == track_id:
                        return t
        
        raise HTTPException(status_code=404, detail="Track not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracks] Error getting track: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/tracks/{track_id}")
async def update_track(track_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """Update a track"""
    try:
        body = await request.json()
        print(f"[Tracks] Updating track {track_id}: {body}")
        
        headers = {}
        if authorization:
            headers["Authorization"] = authorization
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try Spynners native API
            response = await client.put(
                f"https://spynners.com/api/tracks/{track_id}",
                json=body,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                return response.json()
        
        # Fallback to local update
        if ObjectId.is_valid(track_id):
            result = tracks_collection.update_one(
                {"_id": ObjectId(track_id)},
                {"$set": body}
            )
            if result.modified_count > 0:
                return {"success": True, "message": "Track updated"}
        
        raise HTTPException(status_code=404, detail="Failed to update track")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracks] Error updating track: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


# ==================== OFFLINE SPYN PROCESSING ====================

class OfflineRecordingData(BaseModel):
    audioBase64: str
    timestamp: str
    location: Optional[dict] = None

class OfflineSessionRequest(BaseModel):
    sessionId: str
    recordings: List[OfflineRecordingData]
    userId: str
    djName: str
    startTime: str
    endTime: Optional[str] = None
    location: Optional[dict] = None

@app.post("/api/process-offline-session")
async def process_offline_session(request: OfflineSessionRequest, authorization: Optional[str] = Header(None)):
    """
    Process offline SPYN recordings when the device comes back online.
    Each recording is sent to ACRCloud for identification.
    """
    try:
        print(f"[Offline] Processing session {request.sessionId} with {len(request.recordings)} recordings")
        
        results = []
        identified_tracks = []
        
        for idx, recording in enumerate(request.recordings):
            print(f"[Offline] Processing recording {idx + 1}/{len(request.recordings)}")
            
            try:
                # Decode base64 audio
                audio_data = base64.b64decode(recording.audioBase64)
                
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
                
                # Prepare request - Use same format as online mode
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
                
                print(f"[Offline] Sending {len(audio_data)} bytes to ACRCloud...")
                
                # Send to ACRCloud
                async with httpx.AsyncClient(timeout=30.0) as acr_client:
                    response = await acr_client.post(
                        f"https://{ACRCLOUD_HOST}{http_uri}",
                        data=data,
                        files=files
                    )
                
                result = response.json()
                status_code = result.get("status", {}).get("code", -1)
                status_msg = result.get("status", {}).get("msg", "Unknown")
                
                print(f"[Offline] ACRCloud response: code={status_code}, msg={status_msg}")
                print(f"[Offline] Full result: {json.dumps(result, indent=2)[:1000]}")
                
                if status_code == 0:
                    # Check for custom_files first (Spynners tracks), then music, then humming
                    custom_files = result.get("metadata", {}).get("custom_files", [])
                    music = result.get("metadata", {}).get("music", [])
                    humming = result.get("metadata", {}).get("humming", [])
                    
                    track = None
                    is_custom = False
                    source = "unknown"
                    
                    if custom_files:
                        track = custom_files[0]
                        is_custom = True
                        source = "custom_files"
                    elif music:
                        track = music[0]
                        source = "music"
                    elif humming:
                        track = humming[0]
                        source = "humming"
                    
                    print(f"[Offline] Track found in: {source}")
                    
                    if track:
                        track_title = track.get("title", "Unknown")
                        
                        # Get artist name based on source
                        if is_custom:
                            track_artist = track.get("producer_name") or track.get("artist", "Unknown")
                        else:
                            artists = track.get("artists", [])
                            if artists:
                                track_artist = ", ".join([a.get("name", "") for a in artists if a.get("name")])
                            else:
                                track_artist = track.get("artist", "Unknown")
                        
                        if not track_artist:
                            track_artist = "Unknown"
                        
                        # For non-custom tracks, try to find matching Spynners track
                        spynners_track_id = None
                        producer_id = None
                        cover_image = None
                        
                        if is_custom:
                            spynners_track_id = track.get("spynners_track_id")
                            producer_id = track.get("producer_id")
                            cover_image = track.get("artwork_url")
                        else:
                            # Try to match with Spynners database using Base44 API
                            try:
                                from difflib import SequenceMatcher
                                
                                # Fetch tracks from Base44 API - use the correct URL format
                                base44_url = f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track"
                                headers = {
                                    "Content-Type": "application/json"
                                }
                                
                                print(f"[Offline] Fetching tracks from: {base44_url}")
                                
                                async with httpx.AsyncClient(timeout=30.0) as http_client:
                                    tracks_response = await http_client.get(
                                        f"{base44_url}?status=approved&limit=500",
                                        headers=headers
                                    )
                                
                                print(f"[Offline] Base44 response status: {tracks_response.status_code}")
                                
                                if tracks_response.status_code == 200:
                                    all_tracks = tracks_response.json()
                                    print(f"[Offline] Got {len(all_tracks)} tracks from Base44")
                                    best_match = None
                                    best_score = 0
                                    
                                    for db_track in all_tracks:
                                        db_title = db_track.get("title", "").lower()
                                        acr_title = track_title.lower()
                                        
                                        # Calculate similarity
                                        title_ratio = SequenceMatcher(None, db_title, acr_title).ratio()
                                        
                                        # Check artist match too
                                        db_artist = (db_track.get("producer_name") or db_track.get("artist", "")).lower()
                                        artist_ratio = SequenceMatcher(None, db_artist, track_artist.lower()).ratio()
                                        
                                        # Combined score
                                        combined_score = (title_ratio * 0.7) + (artist_ratio * 0.3)
                                        
                                        if combined_score > best_score and combined_score > 0.5:
                                            best_score = combined_score
                                            best_match = db_track
                                    
                                    if best_match:
                                        print(f"[Offline] Matched to Spynners track: {best_match.get('title')} (score: {best_score:.2f})")
                                        spynners_track_id = best_match.get("id")
                                        producer_id = best_match.get("producer_id")
                                        cover_image = best_match.get("artwork_url")
                                        is_custom = True  # Mark as Spynners track
                                    else:
                                        print(f"[Offline] No match found for: {track_title} by {track_artist}")
                                else:
                                    print(f"[Offline] Failed to fetch tracks from Base44: {tracks_response.status_code}")
                                    print(f"[Offline] Response: {tracks_response.text[:500]}")
                            except Exception as match_error:
                                print(f"[Offline] Matching error: {match_error}")
                        
                        track_result = {
                            "success": True,
                            "title": track_title,
                            "artist": track_artist,
                            "cover_image": cover_image,
                            "spynners_track_id": spynners_track_id,
                            "producer_id": producer_id,
                            "timestamp": recording.timestamp,
                            "is_spynners_track": is_custom and spynners_track_id is not None,
                            "source": source
                        }
                        
                        # Only count Spynners tracks
                        if is_custom and spynners_track_id:
                            identified_tracks.append(track_result)
                        
                        results.append(track_result)
                        print(f"[Offline] ✅ Identified: {track_title} by {track_artist} (Spynners: {is_custom and spynners_track_id is not None})")
                    else:
                        results.append({
                            "success": False,
                            "message": "No track in response",
                            "timestamp": recording.timestamp
                        })
                else:
                    results.append({
                        "success": False,
                        "message": result.get("status", {}).get("msg", "Recognition failed"),
                        "timestamp": recording.timestamp
                    })
                    print(f"[Offline] ❌ Not identified: {result.get('status', {}).get('msg', 'Unknown error')}")
                    
            except Exception as rec_error:
                print(f"[Offline] Error processing recording {idx + 1}: {rec_error}")
                results.append({
                    "success": False,
                    "message": str(rec_error),
                    "timestamp": recording.timestamp
                })
        
        # Store session in database for history
        offline_session = {
            "session_id": request.sessionId,
            "user_id": request.userId,
            "dj_name": request.djName,
            "start_time": request.startTime,
            "end_time": request.endTime,
            "location": request.location,
            "recordings_count": len(request.recordings),
            "identified_count": len(identified_tracks),
            "results": results,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        db["offline_sessions"].insert_one(offline_session)
        
        # Send notifications for identified Spynners tracks (if in valid venue)
        location = request.location or {}
        is_valid_venue = location.get("is_valid_venue", False)
        
        if is_valid_venue and identified_tracks and authorization:
            print(f"[Offline] Valid venue detected - Sending producer notifications for {len(identified_tracks)} tracks")
            
            for track in identified_tracks:
                if track.get("producer_id"):
                    try:
                        # Call Base44 sendTrackPlayedEmail function
                        headers = {
                            "Content-Type": "application/json",
                            "X-Base44-App-Id": BASE44_APP_ID,
                            "Authorization": authorization
                        }
                        
                        email_payload = {
                            "producerId": track["producer_id"],
                            "trackTitle": track["title"],
                            "djName": request.djName,
                            "city": location.get("city", ""),
                            "country": location.get("country", ""),
                            "venue": location.get("venue", ""),
                            "trackArtworkUrl": track.get("cover_image", ""),
                            "playedAt": track["timestamp"],
                        }
                        
                        async with httpx.AsyncClient(timeout=30.0) as http_client:
                            await http_client.post(
                                f"https://spynners.com/api/functions/sendTrackPlayedEmail",
                                json=email_payload,
                                headers=headers
                            )
                        print(f"[Offline] ✅ Email sent for: {track['title']}")
                    except Exception as email_error:
                        print(f"[Offline] ❌ Email error for {track['title']}: {email_error}")
        
        print(f"[Offline] Session processed: {len(results)} recordings, {len(identified_tracks)} Spynners tracks identified")
        
        return {
            "success": True,
            "sessionId": request.sessionId,
            "totalRecordings": len(request.recordings),
            "identifiedTracks": len(identified_tracks),
            "results": results
        }
        
    except Exception as e:
        print(f"[Offline] Session processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process offline session: {str(e)}")


# ==================== SPYNNERS NATIVE API PROXY ====================

# Helper function to call Spynners native functions
async def call_spynners_function(function_name: str, body: dict, authorization: str):
    """Call a Spynners native API function"""
    url = f"{SPYNNERS_FUNCTIONS_URL}/{function_name}"
    headers = {
        "Authorization": authorization,
        "Content-Type": "application/json"
    }
    
    print(f"[Spynners API] Calling {function_name} with body: {body}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=body)
        print(f"[Spynners API] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Log a preview of the response
            data_str = str(data)[:500]
            print(f"[Spynners API] Response preview: {data_str}")
            return data
        else:
            print(f"[Spynners API] Error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=response.text)

# ==================== PROFILE ENDPOINTS ====================

class ProfileUpdateRequest(BaseModel):
    artist_name: Optional[str] = None
    bio: Optional[str] = None
    nationality: Optional[str] = None
    instagram: Optional[str] = None
    soundcloud: Optional[str] = None
    sacem_number: Optional[str] = None
    user_type: Optional[str] = None  # dj|producer|both|label|music_lover

@app.post("/api/profile/update")
async def update_profile(request: ProfileUpdateRequest, authorization: str = Header(None)):
    """Update user profile via Spynners native API"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {}
        if request.artist_name is not None:
            body["artist_name"] = request.artist_name
        if request.bio is not None:
            body["bio"] = request.bio
        if request.nationality is not None:
            body["nationality"] = request.nationality
        if request.instagram is not None:
            body["instagram"] = request.instagram
        if request.soundcloud is not None:
            body["soundcloud"] = request.soundcloud
        if request.sacem_number is not None:
            body["sacem_number"] = request.sacem_number
        if request.user_type is not None:
            body["user_type"] = request.user_type
        
        result = await call_spynners_function("nativeUpdateProfile", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Profile] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LIVE TRACK RADAR ====================

class LiveTrackPlaysRequest(BaseModel):
    track_id: Optional[str] = None
    producer_id: Optional[str] = None

@app.post("/api/radar/live-plays")
async def get_live_track_plays(request: LiveTrackPlaysRequest, authorization: str = Header(None)):
    """Get live track plays for radar map"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {}
        if request.track_id:
            body["track_id"] = request.track_id
        if request.producer_id:
            body["producer_id"] = request.producer_id
        
        result = await call_spynners_function("getLiveTrackPlays", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Radar] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CHAT / MESSAGES ====================

@app.post("/api/chat/conversations")
async def get_conversations(authorization: str = Header(None)):
    """Get user's conversations"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        result = await call_spynners_function("nativeGetConversations", {}, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GetMessagesRequest(BaseModel):
    other_user_id: str
    limit: int = 50
    offset: int = 0

@app.post("/api/chat/messages")
async def get_chat_messages(request: GetMessagesRequest, authorization: str = Header(None)):
    """Get messages from a conversation"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "other_user_id": request.other_user_id,
            "limit": request.limit,
            "offset": request.offset
        }
        
        result = await call_spynners_function("nativeGetChatMessages", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SendMessageRequest(BaseModel):
    receiver_id: str
    content: Optional[str] = None
    audio_url: Optional[str] = None
    audio_duration: Optional[int] = None
    attachment_urls: Optional[List[str]] = None

@app.post("/api/chat/send")
async def send_message(request: SendMessageRequest, authorization: str = Header(None)):
    """Send a message"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {"receiver_id": request.receiver_id}
        if request.content:
            body["content"] = request.content
        if request.audio_url:
            body["audio_url"] = request.audio_url
        if request.audio_duration:
            body["audio_duration"] = request.audio_duration
        if request.attachment_urls:
            body["attachment_urls"] = request.attachment_urls
        
        result = await call_spynners_function("nativeSendMessage", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PLAYLISTS ====================

class GetPlaylistsRequest(BaseModel):
    limit: int = 100
    offset: int = 0

@app.post("/api/playlists")
async def get_playlists(request: GetPlaylistsRequest, authorization: str = Header(None)):
    """Get user's playlists"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit,
            "offset": request.offset
        }
        
        result = await call_spynners_function("nativeGetPlaylists", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Playlists] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TRACKS ====================

class GetTracksRequest(BaseModel):
    genre: Optional[str] = None
    limit: int = 50
    offset: int = 0

@app.post("/api/tracks/all")
async def get_all_tracks(request: GetTracksRequest, authorization: str = Header(None)):
    """Get all tracks (PromoPool)"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit,
            "offset": request.offset
        }
        if request.genre:
            body["genre"] = request.genre
        
        result = await call_spynners_function("nativeGetTracks", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracks] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== RANKINGS API ====================

class GetRankingsRequest(BaseModel):
    sort_by: str = "download_count"  # download_count, average_rating, created_date
    genre: Optional[str] = None
    limit: int = 50
    offset: int = 0

@app.post("/api/tracks/rankings")
async def get_track_rankings(request: GetRankingsRequest, authorization: str = Header(None)):
    """
    Get track rankings sorted by downloads, rating, or date.
    Fetches real data from Spynners API.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        print(f"[Rankings] Getting rankings sorted by: {request.sort_by}, genre: {request.genre}")
        
        # Build request body for Spynners native API
        body = {
            "limit": request.limit,
            "offset": request.offset,
            "sort_by": request.sort_by,  # Pass sort parameter
        }
        if request.genre and request.genre != 'all':
            body["genre"] = request.genre
        
        # Call Spynners native API
        result = await call_spynners_function("nativeGetTracks", body, authorization)
        
        # If result is successful, sort locally if API doesn't support sorting
        if result and isinstance(result, dict):
            tracks = result.get("tracks", [])
            
            # Apply sorting based on sort_by parameter
            if request.sort_by == "download_count":
                tracks.sort(key=lambda x: x.get("download_count", 0) or 0, reverse=True)
            elif request.sort_by == "average_rating":
                tracks.sort(key=lambda x: x.get("average_rating", 0) or 0, reverse=True)
            elif request.sort_by == "created_date":
                tracks.sort(key=lambda x: x.get("created_date", "") or "", reverse=True)
            elif request.sort_by == "play_count":
                tracks.sort(key=lambda x: x.get("play_count", 0) or 0, reverse=True)
            
            # Filter only approved tracks
            approved_tracks = [t for t in tracks if t.get("status") == "approved" or t.get("is_approved") == True or not t.get("status")]
            
            result["tracks"] = approved_tracks[:request.limit]
            print(f"[Rankings] Returning {len(result['tracks'])} ranked tracks")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Rankings] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class GetMyTracksRequest(BaseModel):
    status: Optional[str] = None  # approved|pending
    limit: int = 50
    offset: int = 0

@app.post("/api/tracks/my")
async def get_my_tracks(request: GetMyTracksRequest, authorization: str = Header(None)):
    """Get user's uploaded tracks"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit,
            "offset": request.offset
        }
        if request.status:
            body["status"] = request.status
        
        result = await call_spynners_function("nativeGetMyTracks", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracks] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TRACK SHARING ====================

class SendTrackRequest(BaseModel):
    track_id: str
    receiver_id: str
    message: Optional[str] = None

@app.post("/api/tracks/send")
async def send_track(request: SendTrackRequest, authorization: str = Header(None)):
    """Send a track to another user"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "track_id": request.track_id,
            "receiver_id": request.receiver_id
        }
        if request.message:
            body["message"] = request.message
        
        result = await call_spynners_function("nativeSendTrack", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Share] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RECEIVED TRACKS ====================

class GetReceivedTracksRequest(BaseModel):
    limit: int = 100
    offset: int = 0

@app.post("/api/tracks/received")
async def get_received_tracks(request: GetReceivedTracksRequest, authorization: str = Header(None)):
    """Get tracks received from other users"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit,
            "offset": request.offset
        }
        
        result = await call_spynners_function("nativeGetReceivedTracks", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Received] Error: {e}")
        # Return empty array on error
        return {"tracks": []}

# ==================== TRACK DOWNLOAD ====================

class DownloadTrackRequest(BaseModel):
    track_id: str

@app.post("/api/tracks/download")
async def download_track(request: DownloadTrackRequest, authorization: str = Header(None)):
    """Download a track"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {"track_id": request.track_id}
        
        result = await call_spynners_function("nativeDownloadTrack", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Download] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FAVORITES ====================

class GetFavoritesRequest(BaseModel):
    limit: int = 100
    offset: int = 0

@app.post("/api/favorites")
async def get_favorites(request: GetFavoritesRequest, authorization: str = Header(None)):
    """Get user's favorite tracks"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit,
            "offset": request.offset
        }
        
        result = await call_spynners_function("nativeGetFavorites", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Favorites] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ToggleFavoriteRequest(BaseModel):
    track_id: str

@app.post("/api/favorites/toggle")
async def toggle_favorite(request: ToggleFavoriteRequest, authorization: str = Header(None)):
    """Toggle favorite status for a track"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {"track_id": request.track_id}
        
        result = await call_spynners_function("nativeToggleFavorite", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Favorites] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LIVE RADAR ====================

class GetLiveTrackPlaysRequest(BaseModel):
    producer_id: Optional[str] = None
    limit: int = 100

@app.post("/api/live-plays")
async def get_live_track_plays_endpoint(request: GetLiveTrackPlaysRequest, authorization: str = Header(None)):
    """Get live track plays for radar"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        body = {
            "limit": request.limit
        }
        if request.producer_id:
            body["producerId"] = request.producer_id
        
        result = await call_spynners_function("nativeGetLiveTrackPlays", body, authorization)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Live Plays] Error: {e}")
        # Return empty array on error to not break UI
        return {"plays": []}


# ==================== SEND MESSAGE TO DJ ====================

class SendDJMessageRequest(BaseModel):
    dj_id: Optional[str] = None
    dj_name: str
    producer_id: Optional[str] = None
    producer_name: str
    track_title: str
    message: str
    venue: Optional[str] = None
    location: Optional[str] = None

@app.post("/api/send-dj-message")
async def send_dj_message(request: SendDJMessageRequest, authorization: str = Header(None)):
    """Send a message to a DJ who played your track"""
    try:
        print(f"[DJ Message] Sending message from {request.producer_name} to {request.dj_name}")
        print(f"[DJ Message] Track: {request.track_title}")
        print(f"[DJ Message] Message: {request.message}")
        print(f"[DJ Message] Venue: {request.venue}, Location: {request.location}")
        
        # Save message to database
        message_doc = {
            "type": "dj_message",
            "dj_id": request.dj_id,
            "dj_name": request.dj_name,
            "producer_id": request.producer_id,
            "producer_name": request.producer_name,
            "track_title": request.track_title,
            "message": request.message,
            "venue": request.venue or "",
            "location": request.location or "",
            "created_at": datetime.utcnow(),
            "read": False,
        }
        
        # Save to MongoDB
        result = db.dj_messages.insert_one(message_doc)
        print(f"[DJ Message] Saved to database with id: {result.inserted_id}")
        
        # Try to send via Base44 notification system
        if authorization:
            try:
                notification_body = {
                    "type": "producer_message",
                    "recipient_id": request.dj_id,
                    "sender_id": request.producer_id,
                    "sender_name": request.producer_name,
                    "title": f"Message from {request.producer_name}",
                    "message": request.message,
                    "track_title": request.track_title,
                    "venue": request.venue or "",
                    "location": request.location or "",
                }
                
                # Call the notification function
                result = await call_spynners_function("nativeSendNotification", notification_body, authorization)
                print(f"[DJ Message] Notification result: {result}")
                
            except Exception as notif_error:
                print(f"[DJ Message] Notification error (non-fatal): {notif_error}")
        
        print(f"[DJ Message] ✅ Message saved and sent successfully")
        
        return {
            "success": True,
            "message": "Message sent successfully",
            "recipient": request.dj_name,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DJ Message] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BLACK DIAMONDS ====================

class UpdateDiamondsRequest(BaseModel):
    user_id: str
    amount: int  # positive to add, negative to deduct
    current_balance: Optional[int] = None  # Optional: frontend can pass current balance

@app.post("/api/base44/update-diamonds")
async def update_user_diamonds(request: UpdateDiamondsRequest, authorization: str = Header(None)):
    """
    Update user's black diamonds balance using Spynners nativeUpdateProfile.
    Used for VIP track unlocking system.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Diamonds] Updating diamonds for user {request.user_id}: {request.amount}")
        print(f"[Diamonds] Frontend passed current_balance: {request.current_balance}")
        
        # Use frontend-provided balance if available (more reliable)
        current_diamonds = request.current_balance
        
        if current_diamonds is None:
            # Fallback: try to get from Base44 auth/me
            headers = {
                "Content-Type": "application/json",
                "X-Base44-App-Id": BASE44_APP_ID
            }
            headers["Authorization"] = authorization
            
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                me_response = await http_client.get(
                    f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/auth/me",
                    headers=headers
                )
                
                print(f"[Diamonds] Auth/me response: {me_response.status_code}")
                
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    current_diamonds = (
                        user_data.get('data', {}).get('black_diamonds', 0) or 
                        user_data.get('black_diamonds', 0) or 
                        0
                    )
                    print(f"[Diamonds] Got balance from auth/me: {current_diamonds}")
                else:
                    print(f"[Diamonds] Auth/me failed, cannot determine balance")
                    raise HTTPException(status_code=400, detail="Cannot determine current balance. Please re-login.")
        
        print(f"[Diamonds] Current balance: {current_diamonds}")
        
        # Calculate new balance
        new_balance = current_diamonds + request.amount
        print(f"[Diamonds] Calculated new balance: {current_diamonds} + {request.amount} = {new_balance}")
        
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Insufficient diamonds")
        
        # Use Spynners nativeUpdateProfile to update diamonds
        update_result = await call_spynners_function(
            "nativeUpdateProfile", 
            {"black_diamonds": new_balance}, 
            authorization
        )
        
        print(f"[Diamonds] Spynners update result: {update_result}")
        
        if update_result and update_result.get('success'):
            # Get the actual new balance from the response
            actual_balance = update_result.get('user', {}).get('black_diamonds', new_balance)
            print(f"[Diamonds] Successfully updated to: {actual_balance}")
            
            return {
                "success": True,
                "previous_balance": current_diamonds,
                "new_balance": actual_balance,
                "amount_changed": request.amount,
            }
        else:
            print(f"[Diamonds] Update failed: {update_result}")
            raise HTTPException(status_code=500, detail="Failed to update diamonds")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Diamonds] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/diamonds")
async def get_user_diamonds(authorization: str = Header(None)):
    """
    Get user's black diamonds balance from Spynners API.
    Uses nativeUpdateProfile with empty update to get fresh user data.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Diamonds] Getting user diamonds via Spynners API...")
        
        # Use Spynners nativeUpdateProfile with empty body to get user data
        # This works because it returns the user object in the response
        try:
            result = await call_spynners_function("nativeUpdateProfile", {}, authorization)
            print(f"[Diamonds] Spynners response: {result}")
            
            if result and result.get('success') and result.get('user'):
                user_data = result['user']
                diamonds = user_data.get('black_diamonds', 0) or 0
                print(f"[Diamonds] User has {diamonds} diamonds")
                
                return {
                    "success": True,
                    "black_diamonds": diamonds,
                    "user_id": user_data.get('id') or user_data.get('_id'),
                    "email": user_data.get('email'),
                }
        except Exception as spynners_error:
            print(f"[Diamonds] Spynners API failed: {spynners_error}")
        
        # If Spynners fails, return error
        raise HTTPException(status_code=404, detail="Could not fetch user data")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Diamonds] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoint to add diamonds to any user
class AdminAddDiamondsRequest(BaseModel):
    user_id: str
    amount: int

@app.post("/api/base44/add-diamonds")
async def admin_add_diamonds(request: AdminAddDiamondsRequest, authorization: str = Header(None)):
    """
    Admin endpoint to add black diamonds to any user.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Diamonds] Adding {request.amount} diamonds to user {request.user_id}")
        
        # Get user's current balance by fetching their profile
        # For now, we'll use a direct approach via the User entity
        try:
            # Get user data
            headers = {
                "Content-Type": "application/json",
                "X-Base44-App-Id": BASE44_APP_ID,
                "Authorization": authorization
            }
            
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                # Get user by ID
                user_response = await http_client.get(
                    f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{request.user_id}",
                    headers=headers
                )
                
                if user_response.status_code == 200:
                    user_data = user_response.json()
                    current_diamonds = user_data.get('black_diamonds', 0) or user_data.get('data', {}).get('black_diamonds', 0) or 0
                    new_balance = current_diamonds + request.amount
                    
                    print(f"[Admin Diamonds] Current: {current_diamonds}, New: {new_balance}")
                    
                    # Update user diamonds via entity update
                    update_response = await http_client.put(
                        f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/User/{request.user_id}",
                        headers=headers,
                        json={"black_diamonds": new_balance}
                    )
                    
                    if update_response.status_code in [200, 201]:
                        return {
                            "success": True,
                            "user_id": request.user_id,
                            "previous_balance": current_diamonds,
                            "new_balance": new_balance,
                            "amount_added": request.amount
                        }
                    else:
                        print(f"[Admin Diamonds] Update failed: {update_response.text}")
                        raise HTTPException(status_code=500, detail="Failed to update user diamonds")
                else:
                    print(f"[Admin Diamonds] User not found: {user_response.text}")
                    raise HTTPException(status_code=404, detail="User not found")
                    
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Admin Diamonds] Error fetching user: {e}")
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Diamonds] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN STATISTICS ENDPOINT ====================

@app.get("/api/admin/stats")
async def get_admin_stats(authorization: str = Header(None)):
    """
    Get comprehensive admin statistics from Spynners.
    Returns: total users, tracks, pending, approved, downloads, sessions, etc.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print("[Admin Stats] Fetching comprehensive admin statistics...")
        
        stats = {
            "total_users": 0,
            "total_tracks": 0,
            "pending_tracks": 0,
            "approved_tracks": 0,
            "rejected_tracks": 0,
            "vip_tracks": 0,
            "total_downloads": 0,
            "total_plays": 0,
            "total_sessions": 0,
            "active_sessions": 0,
            "unique_djs": 0,
            "tracks_detected": 0,
        }
        
        # Get all users
        try:
            users_result = await call_spynners_function("nativeGetAllUsers", {"limit": 1000}, authorization)
            if users_result:
                # Handle different response formats
                if isinstance(users_result, dict):
                    users = users_result.get('users', users_result.get('items', []))
                else:
                    users = users_result if isinstance(users_result, list) else []
                stats["total_users"] = len(users)
                print(f"[Admin Stats] Total users: {stats['total_users']}")
        except Exception as e:
            print(f"[Admin Stats] Error fetching users: {e}")
        
        # Get all tracks
        try:
            tracks_result = await call_spynners_function("nativeGetTracks", {"limit": 1000}, authorization)
            if tracks_result:
                # Handle different response formats
                if isinstance(tracks_result, dict):
                    tracks = tracks_result.get('tracks', tracks_result.get('items', []))
                else:
                    tracks = tracks_result if isinstance(tracks_result, list) else []
                stats["total_tracks"] = len(tracks)
                
                # Count by status
                for track in tracks:
                    status = track.get('status', '').lower()
                    is_vip = track.get('is_vip', False)
                    
                    if is_vip:
                        stats["vip_tracks"] += 1
                    
                    if status == 'pending':
                        stats["pending_tracks"] += 1
                    elif status == 'rejected':
                        stats["rejected_tracks"] += 1
                    else:
                        stats["approved_tracks"] += 1
                    
                    # Sum downloads and plays
                    stats["total_downloads"] += track.get('download_count', 0) or 0
                    stats["total_plays"] += track.get('play_count', 0) or 0
                
                print(f"[Admin Stats] Total tracks: {stats['total_tracks']}, VIP: {stats['vip_tracks']}")
        except Exception as e:
            print(f"[Admin Stats] Error fetching tracks: {e}")
        
        # Get live track plays for sessions data
        try:
            # Try both function names
            plays_result = None
            try:
                plays_result = await call_spynners_function("nativeGetLiveTrackPlays", {"limit": 1000}, authorization)
            except:
                pass
            
            if not plays_result:
                try:
                    plays_result = await call_spynners_function("getLiveTrackPlays", {"limit": 1000}, authorization)
                except:
                    pass
            
            if plays_result:
                # Handle different response formats
                if isinstance(plays_result, dict):
                    plays = plays_result.get('plays', plays_result.get('items', plays_result.get('data', [])))
                else:
                    plays = plays_result if isinstance(plays_result, list) else []
                
                stats["total_sessions"] = len(plays)
                stats["tracks_detected"] = len(plays)
                
                # Count unique DJs
                unique_djs = set()
                for play in plays:
                    dj_id = play.get('dj_id') or play.get('user_id') or play.get('dj_name')
                    if dj_id:
                        unique_djs.add(dj_id)
                stats["unique_djs"] = len(unique_djs)
                
                print(f"[Admin Stats] Sessions: {stats['total_sessions']}, Unique DJs: {stats['unique_djs']}")
        except Exception as e:
            print(f"[Admin Stats] Error fetching sessions: {e}")
        
        return {"success": True, "stats": stats}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Stats] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/users")
async def get_admin_users(authorization: str = Header(None), limit: int = 500):
    """
    Get all users for admin panel with full details.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Users] Fetching users (limit: {limit})...")
        
        result = await call_spynners_function("nativeGetAllUsers", {"limit": limit}, authorization)
        
        if result:
            # Handle different response formats
            if isinstance(result, dict):
                users = result.get('users', result.get('items', []))
            else:
                users = result if isinstance(result, list) else []
            print(f"[Admin Users] Got {len(users)} users")
            return {"success": True, "users": users, "total": len(users)}
        
        return {"success": True, "users": [], "total": 0}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Users] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/tracks")
async def get_admin_tracks(authorization: str = Header(None), status: str = None, limit: int = 500):
    """
    Get all tracks for admin panel, optionally filtered by status.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Tracks] Fetching tracks (status: {status}, limit: {limit})...")
        
        result = await call_spynners_function("nativeGetTracks", {"limit": limit}, authorization)
        
        if result:
            # Handle different response formats
            if isinstance(result, dict):
                tracks = result.get('tracks', result.get('items', []))
            else:
                tracks = result if isinstance(result, list) else []
            
            # Filter by status if specified
            if status:
                tracks = [t for t in tracks if t.get('status', '').lower() == status.lower()]
            
            print(f"[Admin Tracks] Got {len(tracks)} tracks")
            return {"success": True, "tracks": tracks, "total": len(tracks)}
        
        return {"success": True, "tracks": [], "total": 0}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Tracks] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/sessions")
async def get_admin_sessions(authorization: str = Header(None), limit: int = 500):
    """
    Get all SPYN sessions for admin panel.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Sessions] Fetching sessions (limit: {limit})...")
        
        # Try both function names
        result = None
        try:
            result = await call_spynners_function("nativeGetLiveTrackPlays", {"limit": limit}, authorization)
        except:
            pass
        
        if not result:
            try:
                result = await call_spynners_function("getLiveTrackPlays", {"limit": limit}, authorization)
            except:
                pass
        
        if result:
            # Handle different response formats
            if isinstance(result, dict):
                sessions = result.get('recentPlays', result.get('plays', result.get('items', [])))
            else:
                sessions = result if isinstance(result, list) else []
            print(f"[Admin Sessions] Got {len(sessions)} sessions")
            return {"success": True, "sessions": sessions, "total": len(sessions)}
        
        return {"success": True, "sessions": [], "total": 0}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Sessions] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/downloads")
async def get_admin_downloads(authorization: str = Header(None), limit: int = 500):
    """
    Get download history for admin panel.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Downloads] Fetching downloads (limit: {limit})...")
        
        # Get tracks with download info
        result = await call_spynners_function("nativeGetTracks", {"limit": limit}, authorization)
        
        downloads = []
        total_downloads = 0
        
        if result:
            # Handle different response formats
            if isinstance(result, dict):
                tracks = result.get('tracks', result.get('items', []))
            else:
                tracks = result if isinstance(result, list) else []
            
            for track in tracks:
                download_count = track.get('download_count', 0) or 0
                total_downloads += download_count
                
                if download_count > 0:
                    downloads.append({
                        "track_id": track.get('id') or track.get('_id'),
                        "track_title": track.get('title'),
                        "producer": track.get('artist_name') or track.get('producer_name'),
                        "genre": track.get('genre'),
                        "download_count": download_count,
                    })
        
        print(f"[Admin Downloads] Total downloads: {total_downloads}")
        return {
            "success": True, 
            "downloads": downloads, 
            "total_downloads": total_downloads,
            "tracks_with_downloads": len(downloads)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Downloads] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN BROADCAST EMAIL ====================

class BroadcastEmailRequest(BaseModel):
    subject: str
    message: str
    recipient_type: str = "all"  # all, category, individual
    category: Optional[str] = None
    individual_email: Optional[str] = None
    genre_filter: Optional[str] = None
    include_tracks: Optional[bool] = False

@app.post("/api/admin/broadcast")
async def send_broadcast_email(request: BroadcastEmailRequest, authorization: str = Header(None)):
    """
    Send broadcast email to users.
    Uses Base44 sendBroadcastEmail cloud function.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Broadcast] Sending email to: {request.recipient_type}")
        print(f"[Admin Broadcast] Subject: {request.subject}")
        
        # Call Base44 sendBroadcastEmail function
        result = await call_spynners_function("sendBroadcastEmail", {
            "subject": request.subject,
            "message": request.message,
            "recipientType": request.recipient_type,
            "category": request.category,
            "individualEmail": request.individual_email,
            "genreFilter": request.genre_filter,
            "includeTracks": request.include_tracks,
        }, authorization)
        
        if result:
            sent_count = result.get('sentCount', 0) if isinstance(result, dict) else 0
            print(f"[Admin Broadcast] Email sent successfully to {sent_count} recipients")
            return {
                "success": True,
                "message": f"Email sent to {sent_count} recipients",
                "sent_count": sent_count,
                "details": result
            }
        
        return {"success": False, "message": "Failed to send email"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Broadcast] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/broadcast/history")
async def get_broadcast_history(authorization: str = Header(None), limit: int = 50):
    """
    Get broadcast email history.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin Broadcast] Fetching email history (limit: {limit})...")
        
        # Try to get from Spynners BroadcastEmail entity
        result = await call_spynners_function("getAdminData", {"section": "broadcasts"}, authorization)
        
        broadcasts = []
        if result:
            if isinstance(result, dict):
                broadcasts = result.get('broadcasts', result.get('items', []))
            else:
                broadcasts = result if isinstance(result, list) else []
        
        print(f"[Admin Broadcast] Got {len(broadcasts)} broadcast records")
        return {"success": True, "broadcasts": broadcasts, "total": len(broadcasts)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin Broadcast] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN VIP PROMOS ====================

@app.get("/api/admin/vip-promos")
async def get_vip_promos(authorization: str = Header(None)):
    """
    Get all VIP promos for admin panel.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print("[Admin VIP] Fetching VIP promos...")
        
        result = await call_spynners_function("getAdminData", {"section": "vip_promos"}, authorization)
        
        promos = []
        if result:
            if isinstance(result, dict):
                promos = result.get('vip_promos', result.get('promos', result.get('items', [])))
            else:
                promos = result if isinstance(result, list) else []
        
        print(f"[Admin VIP] Got {len(promos)} VIP promos")
        return {"success": True, "promos": promos, "total": len(promos)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin VIP] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CreateVIPPromoRequest(BaseModel):
    name: str
    description: Optional[str] = None
    track_ids: Optional[List[str]] = None
    price: Optional[int] = None
    duration_days: Optional[int] = None

@app.post("/api/admin/vip-promos")
async def create_vip_promo(request: CreateVIPPromoRequest, authorization: str = Header(None)):
    """
    Create a new VIP promo.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin VIP] Creating new promo: {request.name}")
        
        result = await call_spynners_function("createVIPPromo", {
            "name": request.name,
            "description": request.description,
            "trackIds": request.track_ids or [],
            "price": request.price,
            "durationDays": request.duration_days,
        }, authorization)
        
        if result:
            print(f"[Admin VIP] Promo created successfully")
            return {"success": True, "promo": result}
        
        return {"success": False, "message": "Failed to create promo"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin VIP] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN UPLOAD VIP TRACK ====================

@app.post("/api/admin/upload-vip-track")
async def upload_vip_track(
    title: str = Form(...),
    artist: str = Form(None),
    description: str = Form(None),
    genre: str = Form(None),
    bpm: str = Form(None),
    is_vip: str = Form("true"),
    vip_price: str = Form("2"),
    vip_stock: str = Form("-1"),
    preview_start: str = Form("0"),
    preview_end: str = Form("30"),
    audio: UploadFile = File(...),
    image: UploadFile = File(None),
    authorization: str = Header(None)
):
    """
    Upload a new VIP track with audio and optional artwork.
    """
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Admin VIP Upload] Starting upload for: {title}")
        print(f"[Admin VIP Upload] Artist: {artist}, Genre: {genre}, BPM: {bpm}")
        print(f"[Admin VIP Upload] VIP Price: {vip_price}, Stock: {vip_stock}")
        
        # Read audio file
        audio_content = await audio.read()
        audio_filename = audio.filename or "track.mp3"
        audio_content_type = audio.content_type or "audio/mpeg"
        print(f"[Admin VIP Upload] Audio file: {audio_filename}, size: {len(audio_content)} bytes")
        
        # Read image file if provided
        image_data = None
        image_filename = None
        if image and image.filename:
            image_data = await image.read()
            image_filename = image.filename or "artwork.jpg"
            print(f"[Admin VIP Upload] Image file: {image_filename}, size: {len(image_data)} bytes")
        
        # First, upload the audio file to Spynners/Base44 storage
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Upload audio file to Base44 storage
            print(f"[Admin VIP Upload] Uploading audio to Base44 storage...")
            audio_files = {
                'file': (audio_filename, audio_content, audio_content_type)
            }
            audio_upload_response = await client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/files/upload",
                files=audio_files,
                headers={'Authorization': authorization}
            )
            
            if audio_upload_response.status_code != 200:
                print(f"[Admin VIP Upload] Audio upload failed: {audio_upload_response.text}")
                raise HTTPException(status_code=500, detail="Failed to upload audio file")
            
            audio_result = audio_upload_response.json()
            audio_url = audio_result.get('url') or audio_result.get('file_url')
            print(f"[Admin VIP Upload] Audio uploaded: {audio_url}")
            
            # Upload image if provided
            artwork_url = None
            if image_data:
                print(f"[Admin VIP Upload] Uploading artwork to Base44 storage...")
                image_files = {
                    'file': (image_filename, image_data, 'image/jpeg')
                }
                image_upload_response = await client.post(
                    f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/files/upload",
                    files=image_files,
                    headers={'Authorization': authorization}
                )
                
                if image_upload_response.status_code == 200:
                    image_result = image_upload_response.json()
                    artwork_url = image_result.get('url') or image_result.get('file_url')
                    print(f"[Admin VIP Upload] Artwork uploaded: {artwork_url}")
        
        # Create the track in Spynners database using the Track entity API
        # Based on the Spynners schema: is_vip, vip_preview_start, vip_preview_end
        track_data = {
            "title": title,
            "artist_name": artist or "Unknown Artist",
            "description": description or "",
            "genre": genre or "Electronic",
            "bpm": int(bpm) if bpm and bpm.isdigit() else 0,
            "audio_url": audio_url,
            "artwork_url": artwork_url,
            # VIP fields - matching Spynners Track entity schema
            "is_vip": True,  # This marks the track as VIP with padlock
            "vip_requested": True,  # Needs validation by admin
            "vip_preview_start": int(preview_start) if preview_start else 0,
            "vip_preview_end": int(preview_end) if preview_end else 30,
            # Track approval status - PENDING for admin validation
            "status": "pending",  # Goes to admin validation queue
            "approved": False,  # Not yet approved
        }
        
        print(f"[Admin VIP Upload] Creating VIP track in database with is_vip=True, status=pending")
        print(f"[Admin VIP Upload] Track data: {track_data}")
        
        # Use the base44 entities API to create the Track directly
        async with httpx.AsyncClient(timeout=60.0) as client:
            create_response = await client.post(
                f"{BASE44_API_URL}/apps/{BASE44_APP_ID}/entities/Track",
                json=track_data,
                headers={
                    'Authorization': authorization,
                    'Content-Type': 'application/json'
                }
            )
            
            print(f"[Admin VIP Upload] Create response status: {create_response.status_code}")
            print(f"[Admin VIP Upload] Create response: {create_response.text[:500]}")
            
            if create_response.status_code in [200, 201]:
                result = create_response.json()
                track_id = result.get('id') or result.get('_id')
                print(f"[Admin VIP Upload] ✅ VIP Track created successfully: {track_id}")
                return {
                    "success": True,
                    "track": result,
                    "message": "Track V.I.P. uploadé avec succès!"
                }
            else:
                print(f"[Admin VIP Upload] ❌ Failed to create track: {create_response.text}")
                return {"success": False, "message": f"Failed to create track: {create_response.text}"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Admin VIP Upload] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ANALYTICS CSV EXPORT ====================

class AnalyticsCSVRequest(BaseModel):
    start_date: Optional[str] = None  # ISO format: YYYY-MM-DD
    end_date: Optional[str] = None    # ISO format: YYYY-MM-DD

@app.post("/api/analytics/sessions/csv")
async def export_sessions_csv(request: AnalyticsCSVRequest, authorization: str = Header(None)):
    """
    Export DJ sessions as CSV report.
    Groups tracks by session with clear separation.
    Includes: Session ID, Date, Start Time, End Time, Venue, DJ Name, SACEM, Track #, Title, Artist, ISRC, ISWC
    """
    import csv
    import io
    from fastapi.responses import Response
    from collections import defaultdict
    
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Analytics CSV] Generating CSV report with session grouping...")
        print(f"[Analytics CSV] Date range: {request.start_date} to {request.end_date}")
        
        # Get user info from token
        user_info = {}
        try:
            user_result = await call_spynners_function("nativeGetCurrentUser", {}, authorization)
            if user_result:
                user_info = user_result
                print(f"[Analytics CSV] User info: {user_info.get('full_name', 'Unknown')}")
        except Exception as e:
            print(f"[Analytics CSV] Could not get user info: {e}")
        
        dj_name = user_info.get('full_name') or user_info.get('name') or 'DJ'
        sacem_number = user_info.get('sacem_number') or user_info.get('sacem') or 'N/A'
        
        # Get live track plays
        plays_data = []
        try:
            body = {"limit": 1000}
            result = await call_spynners_function("nativeGetLiveTrackPlays", body, authorization)
            
            if isinstance(result, dict):
                plays_data = result.get('plays', []) or result.get('data', []) or []
            elif isinstance(result, list):
                plays_data = result
            
            print(f"[Analytics CSV] Got {len(plays_data)} track plays")
        except Exception as e:
            print(f"[Analytics CSV] Error getting live plays: {e}")
        
        # Filter by date range and parse dates
        filtered_plays = []
        for play in plays_data:
            play_date_str = play.get('played_at') or play.get('created_at') or play.get('timestamp')
            if play_date_str:
                try:
                    if 'T' in play_date_str:
                        play_date = datetime.fromisoformat(play_date_str.replace('Z', '+00:00'))
                    else:
                        play_date = datetime.strptime(play_date_str, '%Y-%m-%d')
                    
                    include = True
                    if request.start_date:
                        start = datetime.strptime(request.start_date, '%Y-%m-%d')
                        if play_date.replace(tzinfo=None) < start:
                            include = False
                    if request.end_date:
                        end = datetime.strptime(request.end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                        if play_date.replace(tzinfo=None) > end:
                            include = False
                    
                    if include:
                        play['_parsed_date'] = play_date
                        filtered_plays.append(play)
                except Exception as date_error:
                    print(f"[Analytics CSV] Date parse error: {date_error}")
                    filtered_plays.append(play)
            else:
                filtered_plays.append(play)
        
        print(f"[Analytics CSV] Filtered to {len(filtered_plays)} plays")
        
        # Group plays by session
        # A session is defined by: same date + same venue (or session_id if available)
        sessions = defaultdict(list)
        
        for play in filtered_plays:
            # Get session identifier
            session_id = play.get('session_id') or play.get('sessionId')
            
            if not session_id:
                # Create session key from date + venue
                play_date = play.get('_parsed_date')
                if play_date:
                    date_key = play_date.strftime('%Y-%m-%d')
                else:
                    date_key = play.get('played_at', '')[:10] if play.get('played_at') else 'unknown'
                
                venue = play.get('venue') or play.get('club_name') or play.get('location', {})
                if isinstance(venue, dict):
                    venue = venue.get('venue') or venue.get('name') or 'Unknown'
                venue = venue or 'Unknown'
                
                session_id = f"{date_key}_{venue}"
            
            sessions[session_id].append(play)
        
        print(f"[Analytics CSV] Grouped into {len(sessions)} sessions")
        
        # Sort sessions by date (most recent first)
        sorted_sessions = sorted(sessions.items(), key=lambda x: x[0], reverse=True)
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_ALL)
        
        # Write header row
        headers = [
            'Session ID',
            'Date Session',
            'Heure Début',
            'Heure Fin',
            'Venue',
            'DJ Name',
            'SACEM Number',
            'Track #',
            'Track Title',
            'Artist',
            'ISRC',
            'ISWC',
            'Heure Play'
        ]
        writer.writerow(headers)
        
        session_counter = 1
        
        for session_key, tracks in sorted_sessions:
            # Sort tracks within session by time
            tracks_sorted = sorted(tracks, key=lambda x: x.get('played_at', '') or x.get('created_at', ''))
            
            # Get session info from first and last track
            first_track = tracks_sorted[0] if tracks_sorted else {}
            last_track = tracks_sorted[-1] if tracks_sorted else {}
            
            # Session date
            session_date = 'N/A'
            first_dt = first_track.get('_parsed_date')
            if first_dt:
                session_date = first_dt.strftime('%d/%m/%Y')
            
            # Start and end time
            start_time = 'N/A'
            end_time = 'N/A'
            if first_dt:
                start_time = first_dt.strftime('%H:%M')
            last_dt = last_track.get('_parsed_date')
            if last_dt:
                end_time = last_dt.strftime('%H:%M')
            
            # Venue
            venue = first_track.get('venue') or first_track.get('club_name') or first_track.get('location', {})
            if isinstance(venue, dict):
                venue = venue.get('venue') or venue.get('name') or 'N/A'
            venue = venue or 'N/A'
            
            # Generate readable session ID
            readable_session_id = f"SESSION-{session_counter:03d}"
            
            # Write each track in the session
            for track_num, play in enumerate(tracks_sorted, 1):
                track_title = play.get('track_title') or play.get('title') or 'N/A'
                artist = play.get('track_artist') or play.get('artist') or play.get('producer_name') or 'N/A'
                isrc = play.get('isrc') or play.get('isrc_code') or 'N/A'
                iswc = play.get('iswc') or play.get('iswc_code') or 'N/A'
                
                # Track play time
                track_time = 'N/A'
                track_dt = play.get('_parsed_date')
                if track_dt:
                    track_time = track_dt.strftime('%H:%M:%S')
                
                row = [
                    readable_session_id,
                    session_date,
                    start_time,
                    end_time,
                    venue,
                    dj_name,
                    sacem_number,
                    track_num,
                    track_title,
                    artist,
                    isrc,
                    iswc,
                    track_time
                ]
                writer.writerow(row)
            
            # Add empty row between sessions for visual separation
            writer.writerow([])
            
            session_counter += 1
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Generate filename with date
        filename = f"spynners_sessions_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        print(f"[Analytics CSV] CSV generated: {len(csv_content)} bytes, {len(sessions)} sessions, {len(filtered_plays)} total tracks")
        
        # Return CSV as downloadable file
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Analytics CSV] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate CSV: {str(e)}")


@app.post("/api/analytics/sessions/pdf")
async def export_sessions_pdf(request: AnalyticsCSVRequest, authorization: str = Header(None)):
    """
    Export DJ sessions as PDF report.
    Professional layout with session grouping and SPYNNERS branding.
    """
    import io
    from fastapi.responses import Response
    from collections import defaultdict
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        print(f"[Analytics PDF] Generating PDF report...")
        print(f"[Analytics PDF] Date range: {request.start_date} to {request.end_date}")
        
        # Get user info from token
        user_info = {}
        try:
            user_result = await call_spynners_function("nativeGetCurrentUser", {}, authorization)
            if user_result:
                user_info = user_result
                print(f"[Analytics PDF] User info: {user_info.get('full_name', 'Unknown')}")
        except Exception as e:
            print(f"[Analytics PDF] Could not get user info: {e}")
        
        dj_name = user_info.get('full_name') or user_info.get('name') or 'DJ'
        sacem_number = user_info.get('sacem_number') or user_info.get('sacem') or 'N/A'
        
        # Get live track plays
        plays_data = []
        try:
            body = {"limit": 1000}
            result = await call_spynners_function("nativeGetLiveTrackPlays", body, authorization)
            
            if isinstance(result, dict):
                plays_data = result.get('plays', []) or result.get('data', []) or []
            elif isinstance(result, list):
                plays_data = result
            
            print(f"[Analytics PDF] Got {len(plays_data)} track plays")
        except Exception as e:
            print(f"[Analytics PDF] Error getting live plays: {e}")
        
        # Filter by date range
        filtered_plays = []
        for play in plays_data:
            play_date_str = play.get('played_at') or play.get('created_at') or play.get('timestamp')
            if play_date_str:
                try:
                    if 'T' in play_date_str:
                        play_date = datetime.fromisoformat(play_date_str.replace('Z', '+00:00'))
                    else:
                        play_date = datetime.strptime(play_date_str, '%Y-%m-%d')
                    
                    include = True
                    if request.start_date:
                        start = datetime.strptime(request.start_date, '%Y-%m-%d')
                        if play_date.replace(tzinfo=None) < start:
                            include = False
                    if request.end_date:
                        end = datetime.strptime(request.end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                        if play_date.replace(tzinfo=None) > end:
                            include = False
                    
                    if include:
                        play['_parsed_date'] = play_date
                        filtered_plays.append(play)
                except Exception as date_error:
                    filtered_plays.append(play)
            else:
                filtered_plays.append(play)
        
        print(f"[Analytics PDF] Filtered to {len(filtered_plays)} plays")
        
        # Group plays by session
        sessions = defaultdict(list)
        
        for play in filtered_plays:
            session_id = play.get('session_id') or play.get('sessionId')
            
            if not session_id:
                play_date = play.get('_parsed_date')
                if play_date:
                    date_key = play_date.strftime('%Y-%m-%d')
                else:
                    date_key = play.get('played_at', '')[:10] if play.get('played_at') else 'unknown'
                
                venue = play.get('venue') or play.get('club_name') or play.get('location', {})
                if isinstance(venue, dict):
                    venue = venue.get('venue') or venue.get('name') or 'Unknown'
                venue = venue or 'Unknown'
                
                session_id = f"{date_key}_{venue}"
            
            sessions[session_id].append(play)
        
        print(f"[Analytics PDF] Grouped into {len(sessions)} sessions")
        
        # Sort sessions by date
        sorted_sessions = sorted(sessions.items(), key=lambda x: x[0], reverse=True)
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=landscape(A4),
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1.5*cm,
            bottomMargin=1*cm
        )
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#9C27B0'),
            alignment=TA_CENTER,
            spaceAfter=10
        )
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#666666'),
            alignment=TA_CENTER,
            spaceAfter=20
        )
        session_title_style = ParagraphStyle(
            'SessionTitle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#333333'),
            spaceBefore=15,
            spaceAfter=8
        )
        info_style = ParagraphStyle(
            'InfoStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#555555'),
            alignment=TA_LEFT
        )
        
        elements = []
        
        # Title
        elements.append(Paragraph("SPYNNERS - Rapport de Sessions DJ", title_style))
        
        # Report info
        date_range_text = ""
        if request.start_date and request.end_date:
            date_range_text = f"Période: {request.start_date} au {request.end_date}"
        elif request.start_date:
            date_range_text = f"À partir du: {request.start_date}"
        elif request.end_date:
            date_range_text = f"Jusqu'au: {request.end_date}"
        else:
            date_range_text = "Toutes les sessions"
        
        elements.append(Paragraph(f"{date_range_text} | Généré le: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}", subtitle_style))
        
        # DJ Info box
        dj_info_data = [
            ['DJ:', dj_name, 'N° SACEM:', sacem_number, 'Total Sessions:', str(len(sessions)), 'Total Tracks:', str(len(filtered_plays))]
        ]
        dj_info_table = Table(dj_info_data, colWidths=[1.5*cm, 5*cm, 2*cm, 3*cm, 2.5*cm, 2*cm, 2.5*cm, 2*cm])
        dj_info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, 0), 'Helvetica-Bold'),
            ('FONTNAME', (4, 0), (4, 0), 'Helvetica-Bold'),
            ('FONTNAME', (6, 0), (6, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ]))
        elements.append(dj_info_table)
        elements.append(Spacer(1, 15))
        
        # Sessions
        session_counter = 1
        
        for session_key, tracks in sorted_sessions:
            tracks_sorted = sorted(tracks, key=lambda x: x.get('played_at', '') or x.get('created_at', ''))
            
            first_track = tracks_sorted[0] if tracks_sorted else {}
            last_track = tracks_sorted[-1] if tracks_sorted else {}
            
            # Session date
            session_date = 'N/A'
            first_dt = first_track.get('_parsed_date')
            if first_dt:
                session_date = first_dt.strftime('%d/%m/%Y')
            
            # Start and end time
            start_time = 'N/A'
            end_time = 'N/A'
            if first_dt:
                start_time = first_dt.strftime('%H:%M')
            last_dt = last_track.get('_parsed_date')
            if last_dt:
                end_time = last_dt.strftime('%H:%M')
            
            # Venue
            venue = first_track.get('venue') or first_track.get('club_name') or first_track.get('location', {})
            if isinstance(venue, dict):
                venue = venue.get('venue') or venue.get('name') or 'N/A'
            venue = venue or 'N/A'
            
            # Session header
            session_header = f"SESSION {session_counter:03d} - {session_date} | {venue} | {start_time} - {end_time} | {len(tracks_sorted)} tracks"
            elements.append(Paragraph(session_header, session_title_style))
            
            # Tracks table
            table_data = [['#', 'Titre', 'Artiste', 'ISRC', 'ISWC', 'Heure']]
            
            for track_num, play in enumerate(tracks_sorted, 1):
                track_title = play.get('track_title') or play.get('title') or 'N/A'
                artist = play.get('track_artist') or play.get('artist') or play.get('producer_name') or 'N/A'
                isrc = play.get('isrc') or play.get('isrc_code') or 'N/A'
                iswc = play.get('iswc') or play.get('iswc_code') or 'N/A'
                
                track_time = 'N/A'
                track_dt = play.get('_parsed_date')
                if track_dt:
                    track_time = track_dt.strftime('%H:%M')
                
                # Truncate long text
                if len(track_title) > 35:
                    track_title = track_title[:32] + '...'
                if len(artist) > 25:
                    artist = artist[:22] + '...'
                
                table_data.append([str(track_num), track_title, artist, isrc, iswc, track_time])
            
            # Create tracks table
            tracks_table = Table(table_data, colWidths=[1*cm, 8*cm, 5*cm, 3.5*cm, 3.5*cm, 2*cm])
            tracks_table.setStyle(TableStyle([
                # Header row
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9C27B0')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                
                # Data rows
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#333333')),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ALIGN', (0, 1), (0, -1), 'CENTER'),
                ('ALIGN', (5, 1), (5, -1), 'CENTER'),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#9C27B0')),
                
                # Padding
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            
            elements.append(tracks_table)
            elements.append(Spacer(1, 10))
            
            session_counter += 1
        
        # Footer
        elements.append(Spacer(1, 20))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#999999'),
            alignment=TA_CENTER
        )
        elements.append(Paragraph("Rapport généré par SPYNNERS - www.spynners.com", footer_style))
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        buffer.close()
        
        # Generate filename
        filename = f"spynners_sessions_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        print(f"[Analytics PDF] PDF generated: {len(pdf_content)} bytes, {len(sessions)} sessions")
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Analytics PDF] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


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

@app.get("/api/download-project")
async def download_project():
    """Download the project ZIP file"""
    zip_path = "/tmp/spynners-project.zip"
    if os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="spynners-project.zip"
        )
    else:
        raise HTTPException(status_code=404, detail="Project file not found")

@app.get("/api/download-base44")
async def download_base44():
    """Download the base44Api.ts file"""
    file_path = "/app/frontend/src/services/base44Api.ts"
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="text/plain",
            filename="base44Api.ts"
        )
    else:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/download-bugfixes")
async def download_bugfixes():
    """Download the bugfixes ZIP file"""
    file_path = "/app/backend/spynners-final-v2.zip"
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="application/zip",
            filename="spynners-final-v2.zip"
        )
    else:
        raise HTTPException(status_code=404, detail="Bugfixes file not found")

@app.get("/api/download-backend")
async def download_backend():
    """Download the updated backend server.py"""
    file_path = "/app/backend/server.py"
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="text/plain",
            filename="server.py"
        )
    else:
        raise HTTPException(status_code=404, detail="Backend file not found")

@app.get("/")
async def root():
    return {"message": "SPYNNERS API - Use /api/* endpoints"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
