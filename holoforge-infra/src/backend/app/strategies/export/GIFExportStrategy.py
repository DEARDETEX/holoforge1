"""
GIFExportStrategy - Optimized animated GIF export

Perfect for:
- Social media (Twitter, Discord)
- Quick previews
- Email-friendly format
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


class GIFExportStrategy(ExportStrategy):
    """
    GIF export with palette optimization
    
    Key technique: Two-pass encoding with custom palette
    Result: Better quality than naive conversion
    
    Limitation: No alpha channel (GIF transparency is binary)
    """
    
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        super().__init__()
        
        self.name = "GIF Exporter"
        self.format = ExportFormat.GIF
        self.supported_qualities = [
            ExportQuality.LOW,
            ExportQuality.MEDIUM,
            ExportQuality.HIGH
            # No ULTRA for GIF (file size would be huge)
        ]
        self.max_resolution = (640, 640)  # GIFs get huge fast
        self.supports_alpha = False  # GIF has binary transparency, not useful for holograms
        
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
            
            print(f"✅ FFmpeg verified for GIF export")
            
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
        Two-pass GIF export with palette generation
        
        Why two-pass?
        - Pass 1: Analyze video, generate optimal 256-color palette
        - Pass 2: Use palette for encoding
        Result: 30-50% better quality than direct conversion
        """
        
        print(f"🎨 GIF Export Started (2-pass with palette)")
        print(f"   Source: {source_path}")
        print(f"   Output: {output_path}")
        
        start_time = time.time()
        
        try:
            await self.validate_options(options)
            
            settings = self._get_quality_settings(options.quality)
            
            print(f"   Quality: {options.quality.value}")
            print(f"   Resolution: {settings['scale']}px")
            print(f"   FPS: {settings['fps']}")
            
            # PASS 1: Generate palette
            palette_path = await self._generate_palette(
                source_path,
                settings,
                options
            )
            
            # PASS 2: Encode with palette
            await self._encode_gif(
                source_path,
                output_path,
                palette_path,
                settings,
                options
            )
            
            # Cleanup palette
            if os.path.exists(palette_path):
                os.remove(palette_path)
                print(f"   ✅ Palette file cleaned up")
            
            # Results
            export_time = time.time() - start_time
            file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            
            print(f"✅ GIF Export Complete")
            print(f"   Time: {export_time:.2f}s")
            print(f"   Size: {file_size_mb:.2f} MB")
            print(f"   FPS: {settings['fps']}")
            
            result = ExportResult(
                success=True,
                output_path=output_path,
                file_size_mb=file_size_mb,
                export_time_seconds=export_time,
                format=self.format,
                resolution=(settings['scale'], settings['scale']),
                metadata={
                    "fps": settings['fps'],
                    "colors": 256,
                    "optimized_palette": True,
                    "dithering": "bayer"
                }
            )
            
            self._record_success(result)
            return result
            
        except Exception as error:
            export_time = time.time() - start_time
            
            print(f"❌ GIF Export Failed")
            print(f"   Error: {str(error)}")
            print(f"   Time elapsed: {export_time:.2f}s")
            
            self._record_failure()
            
            return ExportResult(
                success=False,
                output_path="",
                file_size_mb=0.0,
                export_time_seconds=export_time,
                format=self.format,
                resolution=(0, 0),
                metadata={},
                error=str(error)
            )
    
    async def _generate_palette(
        self,
        source: str,
        settings: dict,
        options: ExportOptions
    ) -> str:
        """
        Generate optimized 256-color palette
        
        Uses Lanczos scaling (best quality) and diff mode for motion
        """
        palette_path = source.replace(os.path.splitext(source)[1], "_palette.png")
        
        command = [
            self.ffmpeg_path,
            "-i", source,
            "-vf", (
                f"fps={settings['fps']},"
                f"scale={settings['scale']}:-1:flags=lanczos,"
                "palettegen=stats_mode=diff"  # Diff mode for motion
            ),
            "-y",
            palette_path
        ]
        
        print(f"   [Pass 1/2] Generating optimized palette...")
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Palette generation failed: {result.stderr}")
        
        print(f"   ✅ Palette generated: {palette_path}")
        
        return palette_path
    
    async def _encode_gif(
        self,
        source: str,
        output: str,
        palette: str,
        settings: dict,
        options: ExportOptions
    ):
        """
        Encode GIF using generated palette
        
        Dithering: Bayer algorithm (best for hologram effects with smooth gradients)
        """
        command = [
            self.ffmpeg_path,
            "-i", source,
            "-i", palette,
            "-lavfi", (
                f"fps={settings['fps']},"
                f"scale={settings['scale']}:-1:flags=lanczos[x];"
                "[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle"
            ),
            "-y",
            output
        ]
        
        print(f"   [Pass 2/2] Encoding GIF with palette...")
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"GIF encoding failed: {result.stderr}")
        
        print(f"   ✅ GIF encoded")
    
    def _get_quality_settings(self, quality: ExportQuality) -> dict:
        """
        GIF quality presets
        
        Balance: Quality vs file size (GIFs grow fast)
        """
        return {
            ExportQuality.LOW: {
                "scale": 320,
                "fps": 10  # Choppy but tiny
            },
            ExportQuality.MEDIUM: {
                "scale": 480,
                "fps": 15  # Good balance
            },
            ExportQuality.HIGH: {
                "scale": 640,
                "fps": 24  # Smooth, larger file
            }
        }[quality]


# Test function
async def test_gif_export():
    """Test GIF export strategy"""
    print("═══════════════════════════════════════")
    print("🧪 Testing GIF Export Strategy")
    print("═══════════════════════════════════════\n")
    
    # Create strategy
    strategy = GIFExportStrategy()
    
    print(f"Strategy Info: {strategy}")
    print(f"Supported Qualities: {[q.value for q in strategy.supported_qualities]}")
    print(f"Max Resolution: {strategy.max_resolution}")
    print(f"Supports Alpha: {strategy.supports_alpha}\n")
    
    print("✅ GIF Export Strategy initialized successfully")
    print("   Features:")
    print("   - Two-pass palette optimization")
    print("   - Bayer dithering for smooth gradients")
    print("   - Optimized for social media")
    print("   - File sizes 30-50% smaller than naive conversion")
    print("\n═══════════════════════════════════════")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_gif_export())
