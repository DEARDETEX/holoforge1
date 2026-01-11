"""
Export API Routes - RESTful endpoints for video export

Design: Clean REST principles
Validation: Pydantic models
Error handling: Comprehensive, user-friendly

Endpoints:
- POST /api/export/convert - Convert video
- GET /api/export/status/{job_id} - Check status
- GET /api/export/download/{job_id} - Download result
- GET /api/export/capabilities - Get format info
- GET /api/export/history - User's export history
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, validator
from typing import Optional, List
from enum import Enum
import uuid
import os
import sys
from datetime import datetime

# Add parent directories to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Import our export system
from app.core.export.ExportManager import ExportManager
from app.core.export.ExportStrategy import (
    ExportFormat,
    ExportQuality,
    ExportOptions,
    ExportResult
)

# Initialize export manager (singleton)
export_manager = ExportManager()

router = APIRouter(prefix="/api/export", tags=["export"])


# ═══════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS (Pydantic for validation)
# ═══════════════════════════════════════════════════════

class ExportFormatEnum(str, Enum):
    """API-friendly format enum"""
    MP4 = "mp4"
    GIF = "gif"
    WEBM_ALPHA = "webm_alpha"


class ExportQualityEnum(str, Enum):
    """API-friendly quality enum"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra"


class ExportRequest(BaseModel):
    """
    Export request model with validation
    
    Example:
        {
            "source_url": "https://cdn.holoforge.com/temp/hologram_abc123.webm",
            "format": "mp4",
            "quality": "high",
            "resolution": [1920, 1080],
            "fps": 30,
            "duration": 15.0
        }
    """
    source_url: str
    format: ExportFormatEnum
    quality: ExportQualityEnum = ExportQualityEnum.MEDIUM
    resolution: List[int] = [1920, 1080]
    fps: int = 30
    duration: float = 15.0
    alpha_channel: bool = False
    
    @validator('resolution')
    def validate_resolution(cls, v):
        """Validate resolution is reasonable"""
        if len(v) != 2:
            raise ValueError("Resolution must be [width, height]")
        
        width, height = v
        
        # Minimum resolution
        if width < 320 or height < 240:
            raise ValueError("Resolution too small (min 320x240)")
        
        # Maximum resolution (4K)
        if width > 3840 or height > 2160:
            raise ValueError("Resolution too large (max 3840x2160)")
        
        return v
    
    @validator('fps')
    def validate_fps(cls, v):
        """Validate FPS is reasonable"""
        if v < 10 or v > 60:
            raise ValueError("FPS must be between 10 and 60")
        return v
    
    @validator('duration')
    def validate_duration(cls, v):
        """Validate duration is reasonable"""
        if v < 1.0 or v > 60.0:
            raise ValueError("Duration must be between 1 and 60 seconds")
        return v


class ExportResponse(BaseModel):
    """
    Export response model
    
    Example:
        {
            "status": "success",
            "job_id": "abc123-def456",
            "message": "Export started",
            "estimated_time_seconds": 45
        }
    """
    status: str
    job_id: str
    message: str
    estimated_time_seconds: Optional[float] = None


class ExportStatusResponse(BaseModel):
    """
    Export status response
    
    States: pending, processing, complete, failed
    """
    job_id: str
    status: str
    progress: int  # 0-100
    created_at: str
    completed_at: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None
    result: Optional[dict] = None


# ═══════════════════════════════════════════════════════
# IN-MEMORY JOB STORAGE (Production: use Redis/Database)
# ═══════════════════════════════════════════════════════

class JobStorage:
    """
    Simple in-memory job storage
    
    Production TODO: Replace with Redis or Database
    Benefits of Redis:
    - Persistence across restarts
    - Distributed (multiple servers)
    - TTL (auto-cleanup old jobs)
    """
    
    def __init__(self):
        self.jobs = {}  # job_id -> job_data
    
    def create_job(self, job_id: str, user_id: str, request: ExportRequest) -> dict:
        """Create new export job"""
        job = {
            "job_id": job_id,
            "user_id": user_id,
            "status": "pending",
            "progress": 0,
            "created_at": datetime.now(),
            "completed_at": None,
            "request": request.dict(),
            "result": None,
            "error": None
        }
        
        self.jobs[job_id] = job
        return job
    
    def get_job(self, job_id: str) -> Optional[dict]:
        """Get job by ID"""
        return self.jobs.get(job_id)
    
    def update_job(self, job_id: str, updates: dict):
        """Update job data"""
        if job_id in self.jobs:
            self.jobs[job_id].update(updates)
    
    def get_user_jobs(self, user_id: str) -> List[dict]:
        """Get all jobs for a user"""
        return [
            job for job in self.jobs.values()
            if job["user_id"] == user_id
        ]


# Global job storage
job_storage = JobStorage()


# ═══════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════

@router.post("/convert", response_model=ExportResponse)
async def convert_video(
    request: ExportRequest,
    background_tasks: BackgroundTasks,
    user_id: str = "demo_user"  # Simplified auth for MVP
):
    """
    Convert video to specified format
    
    Process:
    1. Validate request
    2. Create job ID
    3. Start background processing
    4. Return job ID immediately
    
    User then polls /status/{job_id} for completion
    """
    
    print("═══════════════════════════════════════")
    print("📤 EXPORT API - REQUEST RECEIVED")
    print("═══════════════════════════════════════")
    print(f"   User: {user_id}")
    print(f"   Format: {request.format}")
    print(f"   Quality: {request.quality}")
    print(f"   Resolution: {request.resolution[0]}x{request.resolution[1]}")
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Create job record
    job = job_storage.create_job(job_id, user_id, request)
    
    # Start background processing
    background_tasks.add_task(
        process_export,
        job_id,
        request,
        user_id
    )
    
    # Estimate processing time
    format_map = {
        "mp4": ExportFormat.MP4,
        "gif": ExportFormat.GIF,
        "webm_alpha": ExportFormat.WEBM_ALPHA
    }
    format_obj = format_map.get(request.format.value)
    strategy = export_manager.strategies.get(format_obj)
    estimated_time = strategy.avg_export_time_per_second * request.duration if strategy else 30
    
    print(f"✅ Job created: {job_id}")
    print(f"   Estimated time: {estimated_time:.1f}s")
    print("═══════════════════════════════════════\n")
    
    return ExportResponse(
        status="success",
        job_id=job_id,
        message=f"Export started. Processing {request.format} at {request.quality} quality.",
        estimated_time_seconds=estimated_time
    )


async def process_export(job_id: str, request: ExportRequest, user_id: str):
    """
    Background task to process export
    
    Updates job status as it progresses
    """
    
    try:
        # Update status to processing
        job_storage.update_job(job_id, {
            "status": "processing",
            "progress": 10
        })
        
        # Convert source_url to actual file path
        source_url = request.source_url
        
        # Handle full URLs (e.g., https://domain.com/api/videos/file.webm)
        if '/api/videos/' in source_url:
            # Extract filename from URL (handles both relative and absolute URLs)
            filename = source_url.split('/api/videos/')[-1].split('?')[0]  # Remove query params if any
            source_path = f"/app/backend/videos/{filename}"
        elif source_url.startswith('/videos/'):
            # Handle /videos/filename.webm
            filename = source_url.split('/')[-1]
            source_path = f"/app/backend/videos/{filename}"
        else:
            # Use as-is for full paths
            source_path = source_url
        
        job_storage.update_job(job_id, {"progress": 20})
        
        # Prepare output path
        output_dir = f"/app/backend/exports/{user_id}"
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"{job_id}.{request.format.value}"
        output_path = os.path.join(output_dir, output_filename)
        
        job_storage.update_job(job_id, {"progress": 30})
        
        # Convert format enum to ExportFormat
        format_map = {
            "mp4": ExportFormat.MP4,
            "gif": ExportFormat.GIF,
            "webm_alpha": ExportFormat.WEBM_ALPHA
        }
        export_format = format_map[request.format.value]
        
        # Convert quality enum to ExportQuality
        quality_map = {
            "low": ExportQuality.LOW,
            "medium": ExportQuality.MEDIUM,
            "high": ExportQuality.HIGH,
            "ultra": ExportQuality.ULTRA
        }
        export_quality = quality_map[request.quality.value]
        
        # Create export options
        options = ExportOptions(
            quality=export_quality,
            resolution=tuple(request.resolution),
            fps=request.fps,
            duration=request.duration,
            alpha_channel=request.alpha_channel
        )
        
        job_storage.update_job(job_id, {"progress": 40})
        
        # Execute export using our export manager
        result = await export_manager.export(
            source_path=source_path,
            output_path=output_path,
            format=export_format,
            options=options
        )
        
        if result.success:
            # Success!
            job_storage.update_job(job_id, {
                "status": "complete",
                "progress": 100,
                "completed_at": datetime.now(),
                "result": {
                    "file_size_mb": result.file_size_mb,
                    "export_time_seconds": result.export_time_seconds,
                    "resolution": result.resolution,
                    "format": result.format.value,
                    "metadata": result.metadata
                }
            })
            
            print(f"✅ Export complete: {job_id}")
            
        else:
            # Failed
            raise Exception(result.error or "Export failed")
    
    except Exception as error:
        print(f"❌ Export failed: {job_id} - {str(error)}")
        
        job_storage.update_job(job_id, {
            "status": "failed",
            "progress": 0,
            "completed_at": datetime.now(),
            "error": str(error)
        })


@router.get("/status/{job_id}", response_model=ExportStatusResponse)
async def get_export_status(job_id: str):
    """
    Get export job status
    
    User polls this endpoint to check progress
    """
    
    job = job_storage.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Build download URL if complete
    download_url = None
    if job["status"] == "complete":
        download_url = f"/api/export/download/{job_id}"
    
    return ExportStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        created_at=job["created_at"].isoformat(),
        completed_at=job["completed_at"].isoformat() if job["completed_at"] else None,
        download_url=download_url,
        error=job["error"],
        result=job["result"]
    )


@router.get("/download/{job_id}")
async def download_export(job_id: str):
    """
    Download exported file
    
    Returns file with appropriate MIME type
    """
    
    job = job_storage.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "complete":
        raise HTTPException(status_code=400, detail="Export not complete yet")
    
    # Build file path
    user_id = job["user_id"]
    format_val = job["request"]["format"]
    file_path = f"/app/backend/exports/{user_id}/{job_id}.{format_val}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # MIME types
    mime_types = {
        "mp4": "video/mp4",
        "gif": "image/gif",
        "webm_alpha": "video/webm"
    }
    
    media_type = mime_types.get(format_val, "application/octet-stream")
    
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=f"hologram_{job_id}.{format_val}"
    )


@router.get("/capabilities")
async def get_export_capabilities():
    """
    Get information about available export formats
    
    Frontend uses this to show format options
    
    Returns:
        {
            "formats": {
                "mp4": {
                    "name": "MP4 Exporter",
                    "supports_alpha": false,
                    "max_resolution": [3840, 2160],
                    "qualities": ["low", "medium", "high", "ultra"]
                },
                ...
            }
        }
    """
    
    capabilities = export_manager.get_all_formats_info()
    
    return JSONResponse({
        "status": "success",
        "formats": capabilities
    })


@router.get("/history")
async def get_export_history(
    user_id: str = "demo_user",  # Simplified auth for MVP
    limit: int = 10
):
    """
    Get user's export history
    
    Shows recent exports for dashboard
    """
    
    user_jobs = job_storage.get_user_jobs(user_id)
    
    # Sort by created_at descending
    user_jobs.sort(key=lambda j: j["created_at"], reverse=True)
    
    # Limit results
    user_jobs = user_jobs[:limit]
    
    # Format for response
    history = []
    for job in user_jobs:
        history.append({
            "job_id": job["job_id"],
            "format": job["request"]["format"],
            "quality": job["request"]["quality"],
            "status": job["status"],
            "created_at": job["created_at"].isoformat(),
            "file_size_mb": job["result"]["file_size_mb"] if job["result"] else None,
            "download_url": f"/api/export/download/{job['job_id']}" if job["status"] == "complete" else None
        })
    
    return JSONResponse({
        "status": "success",
        "total": len(history),
        "exports": history
    })


@router.get("/stats")
async def get_export_stats():
    """
    Get export statistics
    
    Shows system-wide export metrics
    """
    
    stats = export_manager.get_stats()
    
    return JSONResponse({
        "status": "success",
        "stats": stats
    })
