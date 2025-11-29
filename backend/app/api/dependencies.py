"""
FastAPI Dependency Injections

Provides reusable dependencies for routes
"""

from fastapi import Depends, HTTPException, status
from app.core.dependencies.ffmpeg_manager import ffmpeg_manager


async def require_ffmpeg():
    """
    Dependency: Ensure FFmpeg is available
    
    Usage in routes:
        @router.post("/export")
        async def export_video(
            _: None = Depends(require_ffmpeg)
        ):
            # FFmpeg guaranteed to be available here
            ...
    """
    try:
        ffmpeg_manager.ensure_available()
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
