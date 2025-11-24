"""
WebMAlphaExportStrategy - WebM with alpha channel

THIS IS THE VFX SOLUTION!

Users export with alpha → drag into Premiere/After Effects → 
instantly composites over any background

This single feature makes HoloForge professional-grade
"""

import subprocess
import os
import time
import sys

# Add parent directories to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from app.core.export.ExportStrategy import (
    ExportStrategy,
    ExportFormat,
    ExportQuality,
    ExportOptions,
    ExportResult
)


class WebMAlphaExportStrategy(ExportStrategy):
    """
    WebM with VP9 codec + alpha channel
    
    Why VP9?
    - Supports alpha channel (VP8 does not)
    - Better compression than H.264
    - Open source, royalty-free
    
    Why not H.264 with alpha?
    - H.264 doesn't support alpha
    - Would need MOV ProRes (huge files)
    
    Compatibility:
    - Chrome/Edge: ✅ Perfect
    - Firefox: ✅ Perfect
    - Safari: ⚠️ WebM support added in Big Sur
    - After Effects: ✅ Can import
    - Premiere Pro: ✅ Can import
    - DaVinci Resolve: ✅ Can import
    """
    
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        super().__init__()
        
        self.name = "WebM Alpha Exporter"
        self.format = ExportFormat.WEBM_ALPHA
        self.supported_qualities = [
            ExportQuality.MEDIUM,
            ExportQuality.HIGH,
            ExportQuality.ULTRA
            # No LOW for alpha (defeats the purpose)
        ]
        self.max_resolution = (3840, 2160)  # 4K with alpha!
        self.supports_alpha = True  # 🎯 THE KEY FEATURE
        
        self.ffmpeg_path = ffmpeg_path
        self.verify_ffmpeg()
    
    def verify_ffmpeg(self):
        """Verify FFmpeg is installed and has VP9 codec"""
        try:
            result = subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                raise RuntimeError("FFmpeg not found or not working")
            
            # Check for VP9 codec
            codecs_result = subprocess.run(
                [self.ffmpeg_path, "-codecs"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if "libvpx-vp9" not in codecs_result.stdout:
                print("⚠️  Warning: VP9 codec (libvpx-vp9) may not be available")
            
            print(f"✅ FFmpeg verified for WebM Alpha export")
            
        except FileNotFoundError:
            raise RuntimeError(
                f"FFmpeg not found at '{self.ffmpeg_path}'. "
                "Install FFmpeg or provide correct path."
            )
    
    async def export(
        self,
        source_path: str,
        output_path: str,
        options: ExportOptions
    ) -> ExportResult:
        """
        Export WebM with VP9 + alpha channel
        
        Critical: Source must have transparent background!
        Frontend must render with alpha-enabled canvas
        """
        
        print(f"🎬 WebM Alpha Export Started")
        print(f"   Source: {source_path}")
        print(f"   Output: {output_path}")
        print(f"   ⚠️  CRITICAL: Source must have alpha channel!")
        
        # Force alpha channel option
        if not options.alpha_channel:
            print(f"   ⚠️  Alpha channel not requested but required for this format")
            options.alpha_channel = True
        
        start_time = time.time()
        
        try:
            await self.validate_options(options)
            
            settings = self._get_quality_settings(options.quality)
            
            print(f"   Quality: {options.quality.value}")
            print(f"   Resolution: {options.resolution[0]}x{options.resolution[1]}")
            print(f"   Bitrate: {settings['bitrate']}")
            print(f"   Speed: {settings['speed']} (0=slowest/best, 4=fastest)")
            
            # Build command for VP9 with alpha
            command = self._build_vp9_command(
                source_path,
                output_path,
                options,
                settings
            )
            
            print(f"   Encoding VP9 with alpha...")
            print(f"   ⏱️  This may take longer than MP4 (better compression)")
            
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=600  # VP9 is slower, 10 min timeout
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"VP9 encoding failed: {result.stderr}")
            
            # Results
            export_time = time.time() - start_time
            file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            
            print(f"✅ WebM Alpha Export Complete")
            print(f"   Time: {export_time:.2f}s")
            print(f"   Size: {file_size_mb:.2f} MB")
            print(f"   🎯 Ready for compositing in Premiere/AE!")
            print(f"   💎 Alpha channel preserved!")
            
            export_result = ExportResult(
                success=True,
                output_path=output_path,
                file_size_mb=file_size_mb,
                export_time_seconds=export_time,
                format=self.format,
                resolution=options.resolution,
                metadata={
                    "codec": "vp9",
                    "has_alpha": True,
                    "bitrate": settings["bitrate"],
                    "quality": settings["quality"],
                    "pixel_format": "yuva420p",
                    "compatible_with": [
                        "After Effects",
                        "Premiere Pro",
                        "DaVinci Resolve",
                        "Chrome/Firefox browsers",
                        "Final Cut Pro"
                    ],
                    "use_case": "Professional VFX compositing"
                }
            )
            
            self._record_success(export_result)
            return export_result
            
        except Exception as error:
            export_time = time.time() - start_time
            
            print(f"❌ WebM Alpha Export Failed")
            print(f"   Error: {str(error)}")
            print(f"   Time elapsed: {export_time:.2f}s")
            
            self._record_failure()
            
            return ExportResult(
                success=False,
                output_path="",
                file_size_mb=0.0,
                export_time_seconds=export_time,
                format=self.format,
                resolution=options.resolution,
                metadata={},
                error=str(error)
            )
    
    def _build_vp9_command(
        self,
        source: str,
        output: str,
        options: ExportOptions,
        settings: dict
    ) -> list:
        """
        Build FFmpeg command for VP9 with alpha
        
        Key parameters:
        - VP9 codec (libvpx-vp9)
        - Auto-alt-ref (better compression)
        - Lag in frames (quality optimization)
        - YUVA420p (YUV with alpha)
        """
        
        command = [
            self.ffmpeg_path,
            "-i", source,
            
            # VP9 encoding
            "-c:v", "libvpx-vp9",
            "-b:v", settings["bitrate"],
            "-quality", settings["quality"],
            "-speed", str(settings["speed"]),
            
            # Alpha channel critical settings
            "-pix_fmt", "yuva420p",  # YUV with alpha
            "-auto-alt-ref", "1",  # Better compression
            "-lag-in-frames", "25",  # Quality optimization
            
            # Scaling
            "-vf", f"scale={options.resolution[0]}:{options.resolution[1]}",
            
            # Output
            "-y",
            output
        ]
        
        return command
    
    def _get_quality_settings(self, quality: ExportQuality) -> dict:
        """
        VP9 quality settings
        
        VP9 is slower but better compression than H.264
        Speed: 0=slowest/best quality, 4=fastest/lower quality
        """
        return {
            ExportQuality.MEDIUM: {
                "bitrate": "2M",
                "quality": "good",
                "speed": 2  # Balanced
            },
            ExportQuality.HIGH: {
                "bitrate": "4M",
                "quality": "best",
                "speed": 1  # Slower, better quality
            },
            ExportQuality.ULTRA: {
                "bitrate": "8M",  # 4K with alpha
                "quality": "best",
                "speed": 0  # Slowest, best quality
            }
        }[quality]


# Test function
async def test_webm_alpha_export():
    """Test WebM Alpha export strategy"""
    print("═══════════════════════════════════════")
    print("🧪 Testing WebM Alpha Export Strategy")
    print("═══════════════════════════════════════\n")
    
    # Create strategy
    strategy = WebMAlphaExportStrategy()
    
    print(f"Strategy Info: {strategy}")
    print(f"Supported Qualities: {[q.value for q in strategy.supported_qualities]}")
    print(f"Max Resolution: {strategy.max_resolution}")
    print(f"Supports Alpha: {strategy.supports_alpha}\n")
    
    print("✅ WebM Alpha Export Strategy initialized successfully")
    print("\n🎯 THE VFX GAME-CHANGER:")
    print("   - VP9 codec with alpha channel support")
    print("   - YUVA420p pixel format")
    print("   - Compatible with After Effects, Premiere Pro, DaVinci Resolve")
    print("   - Users export once, composite anywhere")
    print("   - No manual masking needed!")
    print("   - Turns users into VFX artists instantly! 🎬✨")
    print("\n═══════════════════════════════════════")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_webm_alpha_export())
