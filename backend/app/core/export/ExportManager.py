"""
ExportManager - Central export system

Design: Same pattern as UniversalModelLoader
Benefit: Add new formats without touching this code

Future: MOV ProRes? Create strategy, register, done!
"""

import sys
import os
from typing import Dict, List, Optional

# Add parent directories to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from app.core.export.ExportStrategy import (
    ExportStrategy,
    ExportFormat,
    ExportOptions,
    ExportResult
)
from app.strategies.export.MP4ExportStrategy import MP4ExportStrategy
from app.strategies.export.GIFExportStrategy import GIFExportStrategy
from app.strategies.export.WebMAlphaExportStrategy import WebMAlphaExportStrategy
from app.core.dependencies.ffmpeg_manager import ffmpeg_manager


class ExportManager:
    """
    Central export management system
    
    Responsibilities:
    - Register export strategies
    - Route requests to correct strategy
    - Track export statistics
    - Provide export capabilities info
    
    Usage:
        manager = ExportManager()
        result = await manager.export(
            source="hologram.webm",
            format=ExportFormat.MP4,
            options=ExportOptions(...)
        )
    """
    
    def __init__(self):
        self.strategies: Dict[ExportFormat, ExportStrategy] = {}
        
        # Statistics
        self.stats = {
            "total_exports": 0,
            "exports_by_format": {},
            "total_export_time": 0.0,
            "total_output_size_gb": 0.0
        }
        
        print("═══════════════════════════════════════")
        print("📤 ExportManager Initialization")
        print("═══════════════════════════════════════\n")
        
        # Register all export strategies
        self._register_strategies()
        
        print("═══════════════════════════════════════")
        print("✅ ExportManager Ready")
        print(f"   Available formats: {len(self.strategies)}")
        print(f"   Formats: {[f.value for f in self.strategies.keys()]}")
        print("═══════════════════════════════════════\n")
    
    def _register_strategies(self):
        """
        Register all available export strategies
        
        Adding new format? Just add one line here!
        
        CRITICAL: Uses FFmpegManager for portable FFmpeg path
        """
        print("📦 Registering export strategies...\n")
        
        # Get FFmpeg path from manager (bundled or system)
        try:
            ffmpeg_path = ffmpeg_manager.get_ffmpeg_command()
            print(f"✅ Using FFmpeg from: {ffmpeg_manager.source} ({ffmpeg_path})\n")
        except RuntimeError as e:
            print(f"⚠️  FFmpeg not available: {e}")
            print("   Export strategies will fail until FFmpeg is installed")
            print("   Install via: pip install imageio-ffmpeg\n")
            ffmpeg_path = "ffmpeg"  # Fallback, will fail gracefully
        
        # MP4 (H.264)
        mp4_strategy = MP4ExportStrategy(ffmpeg_path=ffmpeg_path)
        self.register(mp4_strategy)
        
        # GIF (optimized)
        gif_strategy = GIFExportStrategy(ffmpeg_path=ffmpeg_path)
        self.register(gif_strategy)
        
        # WebM with Alpha (VFX solution)
        webm_alpha_strategy = WebMAlphaExportStrategy(ffmpeg_path=ffmpeg_path)
        self.register(webm_alpha_strategy)
        
        # Future strategies register here:
        # mov_prores_strategy = MOVProResStrategy(ffmpeg_path=ffmpeg_path)
        # self.register(mov_prores_strategy)
        
        # apng_strategy = APNGExportStrategy(ffmpeg_path=ffmpeg_path)
        # self.register(apng_strategy)
    
    def register(self, strategy: ExportStrategy):
        """
        Register an export strategy
        
        Args:
            strategy: ExportStrategy instance
        """
        if not isinstance(strategy, ExportStrategy):
            raise TypeError("Strategy must extend ExportStrategy")
        
        if strategy.format is None:
            raise ValueError(f"Strategy '{strategy.name}' has no format defined")
        
        # Check for duplicates
        if strategy.format in self.strategies:
            print(f"⚠️  Overwriting existing strategy for {strategy.format.value}")
        
        self.strategies[strategy.format] = strategy
        self.stats["exports_by_format"][strategy.format.value] = 0
        
        print(f"✅ Registered: {strategy}\n")
    
    async def export(
        self,
        source_path: str,
        output_path: str,
        format: ExportFormat,
        options: ExportOptions
    ) -> ExportResult:
        """
        Export video to specified format
        
        Args:
            source_path: Source video file
            output_path: Where to save output
            format: Desired export format
            options: Export configuration
            
        Returns:
            ExportResult with success/failure details
        """
        
        print("═══════════════════════════════════════")
        print("📤 EXPORT REQUEST")
        print("═══════════════════════════════════════")
        print(f"   Source: {source_path}")
        print(f"   Output: {output_path}")
        print(f"   Format: {format.value}")
        print(f"   Quality: {options.quality.value}")
        print(f"   Resolution: {options.resolution[0]}x{options.resolution[1]}")
        
        # Get appropriate strategy
        strategy = self.strategies.get(format)
        
        if strategy is None:
            supported = [f.value for f in self.strategies.keys()]
            error_msg = (
                f"Format '{format.value}' not supported. "
                f"Supported formats: {', '.join(supported)}"
            )
            print(f"❌ {error_msg}\n")
            
            return ExportResult(
                success=False,
                output_path="",
                file_size_mb=0.0,
                export_time_seconds=0.0,
                format=format,
                resolution=(0, 0),
                metadata={},
                error=error_msg
            )
        
        print(f"✅ Using: {strategy.name}")
        
        # Execute export
        result = await strategy.export(source_path, output_path, options)
        
        # Update statistics
        if result.success:
            self.stats["total_exports"] += 1
            self.stats["exports_by_format"][format.value] += 1
            self.stats["total_export_time"] += result.export_time_seconds
            self.stats["total_output_size_gb"] += result.file_size_mb / 1024
        
        print("═══════════════════════════════════════\n")
        
        return result
    
    def get_supported_formats(self) -> List[ExportFormat]:
        """Get list of supported export formats"""
        return list(self.strategies.keys())
    
    def get_format_info(self, format: ExportFormat) -> dict:
        """
        Get detailed information about a format
        
        Useful for frontend to show capabilities
        """
        strategy = self.strategies.get(format)
        
        if strategy is None:
            return None
        
        return {
            "name": strategy.name,
            "format": strategy.format.value,
            "supported_qualities": [q.value for q in strategy.supported_qualities],
            "max_resolution": strategy.max_resolution,
            "supports_alpha": strategy.supports_alpha,
            "avg_export_time_per_second": strategy.avg_export_time_per_second,
            "stats": strategy.get_stats()
        }
    
    def get_all_formats_info(self) -> dict:
        """
        Get information about all formats
        
        Perfect for /api/export/capabilities endpoint
        """
        return {
            format.value: self.get_format_info(format)
            for format in self.strategies.keys()
        }
    
    def get_stats(self) -> dict:
        """Get export manager statistics"""
        avg_time = 0.0
        if self.stats["total_exports"] > 0:
            avg_time = self.stats["total_export_time"] / self.stats["total_exports"]
        
        return {
            **self.stats,
            "available_formats": len(self.strategies),
            "avg_export_time": f"{avg_time:.2f}s",
            "formats": [f.value for f in self.strategies.keys()]
        }
    
    def unregister(self, format: ExportFormat):
        """
        Unregister a strategy (for testing or dynamic loading)
        """
        if format in self.strategies:
            strategy = self.strategies[format]
            del self.strategies[format]
            print(f"✅ Unregistered: {strategy.name}")
        else:
            print(f"⚠️  Format {format.value} not registered")


# Test function
async def test_export_manager():
    """Test Export Manager"""
    print("\n" + "═" * 50)
    print("🧪 Testing Export Manager")
    print("═" * 50 + "\n")
    
    # Create manager
    manager = ExportManager()
    
    # Test capabilities API
    print("📊 Testing Capabilities API:")
    print("-" * 50)
    
    capabilities = manager.get_all_formats_info()
    
    for format_name, info in capabilities.items():
        print(f"\n{format_name.upper()}:")
        print(f"   Name: {info['name']}")
        print(f"   Qualities: {info['supported_qualities']}")
        print(f"   Max Resolution: {info['max_resolution']}")
        print(f"   Supports Alpha: {info['supports_alpha']}")
        print(f"   Avg Export Time: {info['avg_export_time_per_second']}s per video second")
    
    # Test statistics
    print("\n" + "-" * 50)
    print("📈 Export Manager Statistics:")
    print("-" * 50)
    
    stats = manager.get_stats()
    print(f"   Total Exports: {stats['total_exports']}")
    print(f"   Available Formats: {stats['available_formats']}")
    print(f"   Supported: {', '.join(stats['formats'])}")
    
    print("\n" + "═" * 50)
    print("✅ Export Manager Test Complete")
    print("═" * 50 + "\n")
    
    print("🎯 KEY BENEFITS:")
    print("   1. Adding new format = 1 line in _register_strategies()")
    print("   2. Frontend auto-discovers capabilities via API")
    print("   3. Statistics tracked automatically")
    print("   4. Zero coupling between strategies")
    print("   5. Production-ready architecture!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_export_manager())
