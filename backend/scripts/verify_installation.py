"""
HoloForge Installation Verification Script

Run this after setup to verify everything works
"""

import sys
import subprocess
from pathlib import Path


def print_header(text):
    """Print formatted header"""
    print("\n" + "═" * 60)
    print(f"  {text}")
    print("═" * 60)


def print_check(number, description):
    """Print check description"""
    print(f"\n{number}  {description}...")


def print_result(status, message):
    """Print check result"""
    if status:
        print(f"   ✅ {message}")
    else:
        print(f"   ❌ {message}")


def main():
    print_header("HoloForge Installation Verification")
    
    all_checks_passed = True
    
    # Check 1: Python version
    print_check("1️⃣", "Checking Python version")
    python_version = sys.version_info
    if python_version >= (3, 9):
        print_result(True, f"Python {python_version.major}.{python_version.minor}.{python_version.micro}")
    else:
        print_result(False, f"Python {python_version.major}.{python_version.minor} (need 3.9+)")
        all_checks_passed = False
    
    # Check 2: FFmpeg
    print_check("2️⃣", "Checking FFmpeg")
    ffmpeg_status = check_ffmpeg()
    if not ffmpeg_status['installed']:
        all_checks_passed = False
    
    # Check 3: Required Python packages
    print_check("3️⃣", "Checking Python packages")
    required_packages = [
        'fastapi',
        'uvicorn',
        'pydantic',
        'aiofiles',
        'motor'
    ]
    
    for package in required_packages:
        try:
            __import__(package)
            print_result(True, package)
        except ImportError:
            print_result(False, f"{package} not installed")
            all_checks_passed = False
    
    # Check 4: Project structure
    print_check("4️⃣", "Checking project structure")
    
    # Check from backend directory
    backend_dir = Path(__file__).parent.parent
    required_dirs = [
        'app',
        'app/api',
        'app/core',
        'app/strategies'
    ]
    
    for dir_path in required_dirs:
        full_path = backend_dir / dir_path
        if full_path.exists():
            print_result(True, f"{dir_path}/")
        else:
            print_result(False, f"{dir_path}/ missing")
            all_checks_passed = False
    
    # Summary
    print("\n" + "═" * 60)
    if all_checks_passed:
        print("✅ ALL CHECKS PASSED - Ready to run!")
        print("\nStart server:")
        print("   cd backend")
        print("   uvicorn server:app --reload --host 0.0.0.0 --port 8001")
    else:
        print("❌ SOME CHECKS FAILED - Please fix issues above")
        
        # If FFmpeg failed, show installation instructions
        if not ffmpeg_status['installed']:
            print("\n" + get_ffmpeg_installation_instructions())
        
        return 1
    print("═" * 60 + "\n")
    
    return 0


def check_ffmpeg():
    """
    Check FFmpeg installation and capabilities
    
    Returns:
        dict: Status information about FFmpeg
    """
    status = {
        'installed': False,
        'version': None,
        'codecs_available': [],
        'issues': []
    }
    
    # Check FFmpeg executable
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            status['installed'] = True
            
            # Parse version
            version_line = result.stdout.split('\n')[0]
            if 'version' in version_line:
                version = version_line.split('version')[1].split()[0]
                status['version'] = version
                print_result(True, f"FFmpeg version {version}")
            else:
                print_result(True, "FFmpeg found")
        else:
            status['issues'].append("FFmpeg command failed")
            print_result(False, "FFmpeg command returned error")
            
    except FileNotFoundError:
        status['issues'].append("FFmpeg not found in PATH")
        print_result(False, "FFmpeg not found in system PATH")
        
    except subprocess.TimeoutExpired:
        status['issues'].append("FFmpeg command timeout")
        print_result(False, "FFmpeg command timed out")
        
    except Exception as e:
        status['issues'].append(f"FFmpeg check error: {str(e)}")
        print_result(False, f"Error checking FFmpeg: {e}")
    
    # Check FFprobe
    if status['installed']:
        try:
            result = subprocess.run(
                ['ffprobe', '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                print_result(True, "FFprobe found")
            else:
                status['issues'].append("FFprobe not available")
                print_result(False, "FFprobe not available")
                
        except FileNotFoundError:
            status['issues'].append("FFprobe not found")
            print_result(False, "FFprobe not found")
    
    # Check required codecs
    if status['installed']:
        required_codecs = ['libx264', 'libvpx-vp9', 'aac']
        try:
            result = subprocess.run(
                ['ffmpeg', '-codecs'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                output = result.stdout
                available = []
                missing = []
                
                for codec in required_codecs:
                    if codec in output:
                        available.append(codec)
                    else:
                        missing.append(codec)
                
                status['codecs_available'] = available
                
                if available:
                    print_result(True, f"Codecs: {', '.join(available)}")
                
                if missing:
                    print_result(False, f"Missing codecs: {', '.join(missing)}")
                    status['issues'].append(f"Missing codecs: {', '.join(missing)}")
                    
        except Exception as e:
            print_result(False, f"Could not check codecs: {e}")
    
    return status


def get_ffmpeg_installation_instructions():
    """Get platform-specific FFmpeg installation instructions"""
    platform = sys.platform
    
    if platform.startswith('linux'):
        return """
╔════════════════════════════════════════════════════════════╗
║          FFmpeg Installation - Linux/Ubuntu                ║
╚════════════════════════════════════════════════════════════╝

Run these commands:

    sudo apt update
    sudo apt install -y ffmpeg

Verify installation:

    ffmpeg -version

For other distros:
  - Fedora/RHEL: sudo dnf install ffmpeg
  - Arch: sudo pacman -S ffmpeg

Need help? Visit: https://ffmpeg.org/download.html
        """
    elif platform == 'darwin':
        return """
╔════════════════════════════════════════════════════════════╗
║          FFmpeg Installation - macOS                       ║
╚════════════════════════════════════════════════════════════╝

Using Homebrew (recommended):

    brew install ffmpeg

Verify installation:

    ffmpeg -version

Don't have Homebrew? Install it first:
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Need help? Visit: https://ffmpeg.org/download.html
        """
    elif platform == 'win32':
        return """
╔════════════════════════════════════════════════════════════╗
║          FFmpeg Installation - Windows                     ║
╚════════════════════════════════════════════════════════════╝

Option 1: Using Chocolatey (recommended)
    choco install ffmpeg

Option 2: Manual Installation
    1. Download from: https://www.gyan.dev/ffmpeg/builds/
    2. Extract to C:\\ffmpeg
    3. Add to PATH:
       - Open System Properties → Environment Variables
       - Add C:\\ffmpeg\\bin to PATH

Verify installation:
    ffmpeg -version

Need help? Visit: https://ffmpeg.org/download.html
        """
    else:
        return """
Visit https://ffmpeg.org/download.html for installation instructions.
        """


if __name__ == "__main__":
    sys.exit(main())
