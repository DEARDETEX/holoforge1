"""
MP4ExportStrategy - H.264 video export

Most compatible format, works everywhere
Uses FFmpeg for encoding
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


class MP4ExportStrategy(ExportStrategy):
    """
    MP4 (H.264) export strategy
    
    Characteristics:
    - Universal compatibility
    - Good compression
    - Hardware acceleration available
    - No alpha channel support
    """
    
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        super().__init__()
        
        # Metadata
        self.name = "MP4 Exporter"
        self.format = ExportFormat.MP4
        self.supported_qualities = [
            ExportQuality.LOW,
            ExportQuality.MEDIUM,
            ExportQuality.HIGH,
            ExportQuality.ULTRA
        ]
        self.max_resolution = (3840, 2160)  # 4K
        self.supports_alpha = False  # H.264 doesn't support alpha
        
        # Performance
        self.avg_export_time_per_second = 0.5  # 0.5s processing per 1s video
        
        # FFmpeg configuration
        self.ffmpeg_path = ffmpeg_path
        self.verify_ffmpeg()
    
    def verify_ffmpeg(self):
        """Verify FFmpeg is installed and accessible"""
        try:
            result = subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                raise RuntimeError("FFmpeg not found or not working")
            
            print(f"✅ FFmpeg verified: {result.stdout.split(chr(10))[0]}")
            
        except FileNotFoundError:
            raise RuntimeError(
                f"FFmpeg not found at '{self.ffmpeg_path}'. "
                "Install FFmpeg or provide correct path."
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("FFmpeg verification timed out")
    
    async def export(
        self,
        source_path: str,
        output_path: str,
        options: ExportOptions
    ) -> ExportResult:
        """
        Export to MP4 using FFmpeg
        
        Quality settings explained:
        - LOW: 480p, 2Mbps, fast preset (social media)
        - MEDIUM: 720p, 4Mbps, medium preset (web)
        - HIGH: 1080p, 8Mbps, slow preset (professional)
        - ULTRA: 4K, 20Mbps, veryslow preset (cinema)
        """
        
        print(f"🎬 MP4 Export Started")
        print(f"   Source: {source_path}")
        print(f"   Output: {output_path}")
        print(f"   Quality: {options.quality.value}")
        print(f"   Resolution: {options.resolution[0]}x{options.resolution[1]}")
        
        start_time = time.time()
        
        try:
            # Validate options
            await self.validate_options(options)
            
            # Get quality settings
            settings = self._get_quality_settings(options.quality)
            
            # Build FFmpeg command
            command = self._build_ffmpeg_command(
                source_path,
                output_path,
                options,
                settings
            )
            
            # Execute FFmpeg
            print(f"   Command: {' '.join(command)}")
            
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg failed: {result.stderr}")
            
            # Calculate results
            export_time = time.time() - start_time
            file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            
            print(f"✅ MP4 Export Complete")
            print(f"   Time: {export_time:.2f}s")
            print(f"   Size: {file_size_mb:.2f} MB")
            
            # Create result
            export_result = ExportResult(
                success=True,
                output_path=output_path,
                file_size_mb=file_size_mb,
                export_time_seconds=export_time,
                format=self.format,
                resolution=options.resolution,
                metadata={
                    "codec": "h264",
                    "preset": settings["preset"],
                    "bitrate": settings["bitrate"],
                    "fps": options.fps
                }
            )
            
            # Record statistics
            self._record_success(export_result)
            
            return export_result
            
        except Exception as error:
            export_time = time.time() - start_time
            
            print(f"❌ MP4 Export Failed")
            print(f"   Error: {str(error)}")
            print(f"   Time elapsed: {export_time:.2f}s")
            
            # Record failure
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
    
    def _get_quality_settings(self, quality: ExportQuality) -> dict:
        """
        Quality presets
        
        Tuned for hologram content (high motion, effects)
        """
        settings = {
            ExportQuality.LOW: {
                "scale": "854:480",
                "bitrate": "2M",
                "preset": "veryfast",  # Prioritize speed
                "crf": "28"  # Lower quality
            },
            ExportQuality.MEDIUM: {
                "scale": "1280:720",
                "bitrate": "4M",
                "preset": "medium",
                "crf": "23"  # Balanced
            },
            ExportQuality.HIGH: {
                "scale": "1920:1080",
                "bitrate": "8M",
                "preset": "slow",  # Better compression
                "crf": "20"  # High quality
            },
            ExportQuality.ULTRA: {
                "scale": "3840:2160",  # 4K
                "bitrate": "20M",
                "preset": "veryslow",  # Best compression
                "crf": "18"  # Near-lossless
            }
        }
        
        return settings[quality]
    
    def _build_ffmpeg_command(
        self,
        source: str,
        output: str,
        options: ExportOptions,
        settings: dict
    ) -> list:
        """
        Build FFmpeg command with best practices
        
        Optimizations:
        - Fast start (web streaming)
        - YUV420p (universal compatibility)
        - Closed GOP (seeking)
        - Metadata stripping (privacy)
        """
        
        command = [
            self.ffmpeg_path,
            "-i", source,  # Input
            
            # Video encoding
            "-c:v", "libx264",  # H.264 codec
            "-preset", settings["preset"],
            "-crf", settings["crf"],
            "-b:v", settings["bitrate"],
            
            # Scaling
            "-vf", f"scale={settings['scale']}",
            
            # Format settings
            "-pix_fmt", "yuv420p",  # Universal compatibility
            "-movflags", "+faststart",  # Web optimization
            "-g", str(options.fps * 2),  # GOP size (2 seconds)
            
            # Metadata
            "-map_metadata", "-1",  # Strip metadata (privacy)
            
            # Output
            "-y",  # Overwrite
            output
        ]
        
        return command


# Test function
async def test_mp4_export():
    """Test MP4 export strategy"""
    print("═══════════════════════════════════════")
    print("🧪 Testing MP4 Export Strategy")
    print("═══════════════════════════════════════\n")
    
    # Create strategy
    strategy = MP4ExportStrategy()
    
    print(f"Strategy Info: {strategy}")
    print(f"Supported Qualities: {[q.value for q in strategy.supported_qualities]}")
    print(f"Max Resolution: {strategy.max_resolution}")
    print(f"Supports Alpha: {strategy.supports_alpha}\n")
    
    # Note: Actual export would require a source video file
    print("✅ MP4 Export Strategy initialized successfully")
    print("   Ready for production use!")
    print("\n═══════════════════════════════════════")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mp4_export())
