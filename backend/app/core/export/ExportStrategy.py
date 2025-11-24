"""
ExportStrategy - Abstract base for all video exporters

Design Pattern: Strategy Pattern
Purpose: Add new export formats without modifying existing code
Inspired by: FFmpeg's modular codec system

Future formats we'll support:
- MP4 (today)
- GIF (today)
- WebM with alpha (today)
- APNG (later)
- AVIF (later)
- MOV ProRes (later - professional)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from enum import Enum
import asyncio


class ExportQuality(Enum):
    """Quality presets for exports"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra"  # 4K, future-proof


class ExportFormat(Enum):
    """Supported export formats"""
    MP4 = "mp4"
    GIF = "gif"
    WEBM = "webm"
    WEBM_ALPHA = "webm_alpha"
    PNG_SEQUENCE = "png_sequence"
    # Future formats
    APNG = "apng"
    AVIF = "avif"
    MOV_PRORES = "mov_prores"


@dataclass
class ExportOptions:
    """Standardized export options across all formats"""
    quality: ExportQuality
    resolution: tuple  # (width, height)
    fps: int
    duration: float
    bitrate: Optional[str] = None
    codec: Optional[str] = None
    alpha_channel: bool = False
    
    # Advanced options (future-proof)
    color_space: str = "srgb"  # srgb, rec709, rec2020
    hdr: bool = False
    audio: bool = False  # Future: hologram with sound effects


@dataclass
class ExportResult:
    """Standardized result from any exporter"""
    success: bool
    output_path: str
    file_size_mb: float
    export_time_seconds: float
    format: ExportFormat
    resolution: tuple
    metadata: Dict[str, Any]
    error: Optional[str] = None


class ExportStrategy(ABC):
    """
    Abstract base class for all export strategies
    
    Every new export format extends this class
    
    Example future usage:
        class AVIFExportStrategy(ExportStrategy):
            async def export(self, source, options):
                # AVIF-specific logic
                pass
    """
    
    def __init__(self):
        # Metadata
        self.name: str = ""
        self.format: ExportFormat = None
        self.supported_qualities: List[ExportQuality] = []
        self.max_resolution: tuple = (3840, 2160)  # 4K
        self.supports_alpha: bool = False
        
        # Performance characteristics
        self.avg_export_time_per_second: float = 0.0  # seconds of processing per second of video
        
        # Statistics
        self.stats = {
            "total_exports": 0,
            "successful_exports": 0,
            "failed_exports": 0,
            "total_export_time": 0.0,
            "total_output_size_mb": 0.0
        }
    
    @abstractmethod
    async def export(
        self,
        source_path: str,
        output_path: str,
        options: ExportOptions
    ) -> ExportResult:
        """
        Export video with given options
        
        Args:
            source_path: Path to source video/frames
            output_path: Where to save output
            options: Export configuration
            
        Returns:
            ExportResult with success/failure details
        """
        raise NotImplementedError(f"Strategy '{self.name}' must implement export()")
    
    async def validate_options(self, options: ExportOptions) -> bool:
        """
        Validate export options before processing
        
        Override for format-specific validation
        """
        # Check quality support
        if options.quality not in self.supported_qualities:
            raise ValueError(
                f"{self.name} does not support {options.quality.value} quality. "
                f"Supported: {[q.value for q in self.supported_qualities]}"
            )
        
        # Check resolution
        if options.resolution[0] > self.max_resolution[0] or \
           options.resolution[1] > self.max_resolution[1]:
            raise ValueError(
                f"Resolution {options.resolution} exceeds max {self.max_resolution}"
            )
        
        # Check alpha channel
        if options.alpha_channel and not self.supports_alpha:
            raise ValueError(f"{self.name} does not support alpha channel")
        
        return True
    
    async def pre_process(self, source_path: str, options: ExportOptions) -> str:
        """
        Pre-processing hook (optional)
        
        Use case: Frame extraction, color correction, etc.
        """
        return source_path
    
    async def post_process(self, output_path: str, options: ExportOptions) -> str:
        """
        Post-processing hook (optional)
        
        Use case: Watermarking, compression optimization, etc.
        """
        return output_path
    
    def _record_success(self, result: ExportResult):
        """Record successful export (internal)"""
        self.stats["total_exports"] += 1
        self.stats["successful_exports"] += 1
        self.stats["total_export_time"] += result.export_time_seconds
        self.stats["total_output_size_mb"] += result.file_size_mb
    
    def _record_failure(self):
        """Record failed export (internal)"""
        self.stats["total_exports"] += 1
        self.stats["failed_exports"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get export statistics"""
        success_rate = 0.0
        if self.stats["total_exports"] > 0:
            success_rate = (
                self.stats["successful_exports"] / 
                self.stats["total_exports"]
            ) * 100
        
        avg_time = 0.0
        if self.stats["successful_exports"] > 0:
            avg_time = (
                self.stats["total_export_time"] / 
                self.stats["successful_exports"]
            )
        
        return {
            **self.stats,
            "success_rate": f"{success_rate:.2f}%",
            "avg_export_time": f"{avg_time:.2f}s",
            "format": self.format.value if self.format else "unknown"
        }
    
    def __str__(self) -> str:
        return (
            f"{self.name} "
            f"(format: {self.format.value if self.format else 'unknown'}, "
            f"alpha: {self.supports_alpha})"
        )
