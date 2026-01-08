#!/usr/bin/env python3
"""
HoloForge Backend API Test Suite
Tests all backend endpoints for Phase 1 completion
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Dict, Any

# Get backend URL from frontend .env
def get_backend_url():
    """Get backend URL from frontend .env file"""
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BACKEND_URL = get_backend_url()
API_BASE = f"{BACKEND_URL}/api"

print(f"🔗 Testing Backend API at: {API_BASE}")

class BackendTester:
    def __init__(self):
        self.results = {
            "health_check": {"status": "pending", "details": {}},
            "export_capabilities": {"status": "pending", "details": {}},
            "video_upload": {"status": "pending", "details": {}},
            "model_upload": {"status": "pending", "details": {}},
        }
        self.session = requests.Session()
        self.session.timeout = 30
    
    def test_health_check(self):
        """Test GET /api/health endpoint"""
        print("\n" + "="*50)
        print("🏥 Testing Health Check Endpoint")
        print("="*50)
        
        try:
            response = self.session.get(f"{API_BASE}/health")
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check expected structure
                expected_keys = ["status", "service", "version", "dependencies"]
                missing_keys = [key for key in expected_keys if key not in data]
                
                if missing_keys:
                    self.results["health_check"] = {
                        "status": "failed",
                        "details": {
                            "error": f"Missing keys in response: {missing_keys}",
                            "response": data
                        }
                    }
                    print(f"❌ Missing keys: {missing_keys}")
                    return
                
                # Check FFmpeg status
                ffmpeg_info = data.get("dependencies", {}).get("ffmpeg", {})
                if not ffmpeg_info.get("installed"):
                    self.results["health_check"] = {
                        "status": "failed", 
                        "details": {
                            "error": "FFmpeg not installed",
                            "ffmpeg_info": ffmpeg_info
                        }
                    }
                    print("❌ FFmpeg not installed")
                    return
                
                # Check if using bundled FFmpeg
                ffmpeg_source = ffmpeg_info.get("source")
                if ffmpeg_source != "bundled":
                    print(f"⚠️  FFmpeg source is '{ffmpeg_source}', expected 'bundled'")
                
                self.results["health_check"] = {
                    "status": "passed",
                    "details": {
                        "response": data,
                        "ffmpeg_source": ffmpeg_source,
                        "ffmpeg_version": ffmpeg_info.get("version")
                    }
                }
                print("✅ Health check passed")
                print(f"   FFmpeg Source: {ffmpeg_source}")
                print(f"   FFmpeg Version: {ffmpeg_info.get('version')}")
                
            else:
                self.results["health_check"] = {
                    "status": "failed",
                    "details": {
                        "status_code": response.status_code,
                        "response": response.text
                    }
                }
                print(f"❌ Health check failed with status {response.status_code}")
                
        except Exception as e:
            self.results["health_check"] = {
                "status": "failed",
                "details": {"error": str(e)}
            }
            print(f"❌ Health check error: {e}")
    
    def test_export_capabilities(self):
        """Test GET /api/export/capabilities endpoint"""
        print("\n" + "="*50)
        print("📤 Testing Export Capabilities Endpoint")
        print("="*50)
        
        try:
            response = self.session.get(f"{API_BASE}/export/capabilities")
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check expected structure
                if "formats" not in data:
                    self.results["export_capabilities"] = {
                        "status": "failed",
                        "details": {
                            "error": "Missing 'formats' key in response",
                            "response": data
                        }
                    }
                    print("❌ Missing 'formats' key")
                    return
                
                formats = data["formats"]
                expected_formats = ["mp4", "gif", "webm_alpha"]
                available_formats = list(formats.keys())
                
                missing_formats = [fmt for fmt in expected_formats if fmt not in available_formats]
                
                if missing_formats:
                    self.results["export_capabilities"] = {
                        "status": "failed",
                        "details": {
                            "error": f"Missing export formats: {missing_formats}",
                            "available_formats": available_formats,
                            "expected_formats": expected_formats
                        }
                    }
                    print(f"❌ Missing formats: {missing_formats}")
                    return
                
                # Check format details
                format_details = {}
                for fmt in expected_formats:
                    fmt_info = formats[fmt]
                    format_details[fmt] = {
                        "name": fmt_info.get("name"),
                        "supports_alpha": fmt_info.get("supports_alpha"),
                        "qualities": fmt_info.get("qualities", [])
                    }
                
                self.results["export_capabilities"] = {
                    "status": "passed",
                    "details": {
                        "available_formats": available_formats,
                        "format_details": format_details
                    }
                }
                print("✅ Export capabilities passed")
                print(f"   Available formats: {available_formats}")
                
            else:
                self.results["export_capabilities"] = {
                    "status": "failed",
                    "details": {
                        "status_code": response.status_code,
                        "response": response.text
                    }
                }
                print(f"❌ Export capabilities failed with status {response.status_code}")
                
        except Exception as e:
            self.results["export_capabilities"] = {
                "status": "failed",
                "details": {"error": str(e)}
            }
            print(f"❌ Export capabilities error: {e}")
    
    def create_test_video(self) -> str:
        """Create a small test video file"""
        try:
            # Create a simple test video using FFmpeg if available
            temp_file = tempfile.NamedTemporaryFile(suffix='.webm', delete=False)
            temp_file.close()
            
            # Try to create a simple test video
            import subprocess
            
            # Create a 2-second test video with a simple pattern
            cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi',
                '-i', 'testsrc=duration=2:size=320x240:rate=30',
                '-c:v', 'libvpx',
                '-b:v', '100k',
                temp_file.name
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and os.path.exists(temp_file.name):
                return temp_file.name
            else:
                print(f"⚠️  Could not create test video with FFmpeg: {result.stderr}")
                
        except Exception as e:
            print(f"⚠️  Could not create test video: {e}")
        
        # Fallback: create a minimal fake video file
        temp_file = tempfile.NamedTemporaryFile(suffix='.webm', delete=False)
        temp_file.write(b'fake video content for testing')
        temp_file.close()
        return temp_file.name
    
    def test_video_upload(self):
        """Test POST /api/upload-video endpoint"""
        print("\n" + "="*50)
        print("📹 Testing Video Upload Endpoint")
        print("="*50)
        
        try:
            # Create test video file
            test_video_path = self.create_test_video()
            
            try:
                with open(test_video_path, 'rb') as video_file:
                    files = {
                        'video': ('test_video.webm', video_file, 'video/webm')
                    }
                    
                    response = self.session.post(f"{API_BASE}/upload-video", files=files)
                    
                    print(f"Status Code: {response.status_code}")
                    print(f"Response: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Check expected response structure
                        expected_keys = ["success", "video_id", "video_url"]
                        missing_keys = [key for key in expected_keys if key not in data]
                        
                        if missing_keys:
                            self.results["video_upload"] = {
                                "status": "failed",
                                "details": {
                                    "error": f"Missing keys in response: {missing_keys}",
                                    "response": data
                                }
                            }
                            print(f"❌ Missing keys: {missing_keys}")
                            return
                        
                        if not data.get("success"):
                            self.results["video_upload"] = {
                                "status": "failed",
                                "details": {
                                    "error": "Upload not successful",
                                    "response": data
                                }
                            }
                            print("❌ Upload not successful")
                            return
                        
                        self.results["video_upload"] = {
                            "status": "passed",
                            "details": {
                                "video_id": data.get("video_id"),
                                "video_url": data.get("video_url"),
                                "file_size_mb": data.get("file_size_mb")
                            }
                        }
                        print("✅ Video upload passed")
                        print(f"   Video ID: {data.get('video_id')}")
                        print(f"   Video URL: {data.get('video_url')}")
                        
                    else:
                        self.results["video_upload"] = {
                            "status": "failed",
                            "details": {
                                "status_code": response.status_code,
                                "response": response.text
                            }
                        }
                        print(f"❌ Video upload failed with status {response.status_code}")
                        
            finally:
                # Clean up test file
                if os.path.exists(test_video_path):
                    os.unlink(test_video_path)
                    
        except Exception as e:
            self.results["video_upload"] = {
                "status": "failed",
                "details": {"error": str(e)}
            }
            print(f"❌ Video upload error: {e}")
    
    def create_test_3d_model(self) -> str:
        """Create a simple test 3D model file"""
        # Create a simple OBJ file with a cube
        obj_content = """# Simple test cube
v -1.0 -1.0  1.0
v  1.0 -1.0  1.0
v  1.0  1.0  1.0
v -1.0  1.0  1.0
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0

f 1 2 3 4
f 8 7 6 5
f 4 3 7 8
f 5 1 4 8
f 5 6 2 1
f 2 6 7 3
"""
        
        temp_file = tempfile.NamedTemporaryFile(suffix='.obj', delete=False, mode='w')
        temp_file.write(obj_content)
        temp_file.close()
        return temp_file.name
    
    def test_model_upload(self):
        """Test POST /api/upload-model endpoint"""
        print("\n" + "="*50)
        print("🎯 Testing Model Upload Endpoint")
        print("="*50)
        
        try:
            # Create test 3D model file
            test_model_path = self.create_test_3d_model()
            
            try:
                with open(test_model_path, 'rb') as model_file:
                    files = {
                        'file': ('test_cube.obj', model_file, 'application/octet-stream')
                    }
                    
                    response = self.session.post(f"{API_BASE}/upload-model", files=files)
                    
                    print(f"Status Code: {response.status_code}")
                    print(f"Response: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Check expected response structure
                        expected_keys = ["id", "filename", "file_path", "file_size", "file_type"]
                        missing_keys = [key for key in expected_keys if key not in data]
                        
                        if missing_keys:
                            self.results["model_upload"] = {
                                "status": "failed",
                                "details": {
                                    "error": f"Missing keys in response: {missing_keys}",
                                    "response": data
                                }
                            }
                            print(f"❌ Missing keys: {missing_keys}")
                            return
                        
                        # Check if processing status indicates validation passed
                        processing_status = data.get("processing_status", "")
                        if processing_status != "validated":
                            print(f"⚠️  Processing status: {processing_status} (expected 'validated')")
                        
                        self.results["model_upload"] = {
                            "status": "passed",
                            "details": {
                                "model_id": data.get("id"),
                                "filename": data.get("filename"),
                                "file_size": data.get("file_size"),
                                "processing_status": processing_status
                            }
                        }
                        print("✅ Model upload passed")
                        print(f"   Model ID: {data.get('id')}")
                        print(f"   Filename: {data.get('filename')}")
                        print(f"   Processing Status: {processing_status}")
                        
                    else:
                        self.results["model_upload"] = {
                            "status": "failed",
                            "details": {
                                "status_code": response.status_code,
                                "response": response.text
                            }
                        }
                        print(f"❌ Model upload failed with status {response.status_code}")
                        
            finally:
                # Clean up test file
                if os.path.exists(test_model_path):
                    os.unlink(test_model_path)
                    
        except Exception as e:
            self.results["model_upload"] = {
                "status": "failed",
                "details": {"error": str(e)}
            }
            print(f"❌ Model upload error: {e}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting HoloForge Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Run tests in order
        self.test_health_check()
        self.test_export_capabilities()
        self.test_video_upload()
        self.test_model_upload()
        
        # Print summary
        self.print_summary()
        
        return self.results
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("📊 TEST RESULTS SUMMARY")
        print("="*60)
        
        passed = 0
        failed = 0
        
        for test_name, result in self.results.items():
            status = result["status"]
            if status == "passed":
                print(f"✅ {test_name.replace('_', ' ').title()}: PASSED")
                passed += 1
            elif status == "failed":
                print(f"❌ {test_name.replace('_', ' ').title()}: FAILED")
                error = result["details"].get("error", "Unknown error")
                print(f"   Error: {error}")
                failed += 1
            else:
                print(f"⏳ {test_name.replace('_', ' ').title()}: {status.upper()}")
        
        print(f"\n📈 Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed - check details above")


if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    failed_tests = [name for name, result in results.items() if result["status"] == "failed"]
    if failed_tests:
        exit(1)
    else:
        exit(0)