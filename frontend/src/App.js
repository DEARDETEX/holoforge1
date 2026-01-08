import React, { useState } from 'react';
import axios from 'axios';
import ModelViewer from './components/ModelViewer';
import ExportPanel from './components/export/ExportPanel';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [modelUrl, setModelUrl] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [showTestCube, setShowTestCube] = useState(true);
    const [show3DViewer, setShow3DViewer] = useState(false);
    
    // Phase 3: Video Export System
    const [isRecording, setIsRecording] = useState(false);
    const [recordingProgress, setRecordingProgress] = useState(0);
    const [capturedVideoUrl, setCapturedVideoUrl] = useState(null);
    const [showExportPanel, setShowExportPanel] = useState(false);
    const mediaRecorderRef = React.useRef(null);
    const progressIntervalRef = React.useRef(null);

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setUploadStatus('Uploading...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log('🚀 [App] Uploading file:', file.name);
            
            const response = await axios.post(`${API}/upload-model`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            console.log('✅ [App] Upload successful:', response.data);
            
            // Construct the model URL
            const fileUrl = `${BACKEND_URL}/api/${response.data.file_path}`;
            console.log('🎯 [App] Model URL:', fileUrl);
            
            setModelUrl(fileUrl);
            setShowTestCube(false);
            setShow3DViewer(true);
            setUploadStatus(`✅ Uploaded successfully! Loading 3D model...`);
            
        } catch (error) {
            console.error('❌ [App] Upload failed:', error);
            setUploadStatus(`❌ Upload failed: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleToggleTestCube = () => {
        setShowTestCube(!showTestCube);
        setShow3DViewer(true);
    };

    const handleToggle3DViewer = () => {
        setShow3DViewer(!show3DViewer);
    };

    // Phase 3: Video Export System Implementation
    const startRecording = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            alert('❌ No 3D canvas found. Please ensure the 3D viewer is active.');
            return;
        }

        try {
            console.log('🎬 [VideoExport] Starting hologram video recording...');
            
            // Capture canvas stream at 30 FPS
            const stream = canvas.captureStream(30);
            
            // Configure MediaRecorder with high quality settings
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
            });

            const chunks = [];
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = async () => {
                console.log('🎬 [VideoExport] Recording completed, creating video blob...');
                const blob = new Blob(chunks, { type: 'video/webm' });
                
                // Upload to backend for format conversion
                console.log('📤 [VideoExport] Uploading captured video to server...');
                try {
                    const formData = new FormData();
                    formData.append('video', blob, `hologram_${Date.now()}.webm`);
                    
                    const uploadResponse = await axios.post(`${API}/upload-video`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    
                    const serverVideoUrl = `${BACKEND_URL}${uploadResponse.data.video_url}`;
                    console.log('✅ [VideoExport] Video uploaded:', serverVideoUrl);
                    setCapturedVideoUrl(serverVideoUrl);
                    setShowExportPanel(true);
                    
                } catch (uploadError) {
                    console.error('❌ [VideoExport] Upload failed, using local download:', uploadError);
                    // Fallback to direct download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `hologram_${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 100);
                }
                
                setIsRecording(false);
                setRecordingProgress(0);
                
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                }
            };

            recorder.onerror = (event) => {
                console.error('❌ [VideoExport] Recording error:', event.error);
                setIsRecording(false);
                setRecordingProgress(0);
                alert('❌ Recording failed: ' + event.error.message);
                
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                }
            };

            // Start recording
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingProgress(0);

            // Progress tracking (15 second recording)
            const recordingDuration = 15000; // 15 seconds
            const progressUpdateInterval = 100; // Update every 100ms
            let startTime = Date.now();

            progressIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / recordingDuration) * 100, 100);
                setRecordingProgress(Math.round(progress));

                if (elapsed >= recordingDuration) {
                    if (mediaRecorderRef.current?.state === 'recording') {
                        mediaRecorderRef.current.stop();
                    }
                    clearInterval(progressIntervalRef.current);
                }
            }, progressUpdateInterval);

            console.log('🎬 [VideoExport] Recording started - 15 second hologram video');

        } catch (error) {
            console.error('❌ [VideoExport] Failed to start recording:', error);
            alert('❌ Failed to start recording: ' + error.message);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            console.log('🛑 [VideoExport] Recording stopped manually');
        }
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
    };

    const handleExportComplete = (result) => {
        console.log('✅ [ExportPanel] Export completed:', result);
        // Could show a notification or update UI
    };

    const closeExportPanel = () => {
        setShowExportPanel(false);
    };

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            backgroundColor: '#222',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header Controls */}
            <div style={{ 
                padding: '20px',
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderBottom: '2px solid #444'
            }}>
                <h1 style={{ color: '#00ffff', margin: '0 0 20px 0' }}>
                    🚀 HoloForge - 3D Model Viewer
                </h1>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <input 
                        type="file" 
                        accept=".obj,.fbx,.gltf,.glb,.ply"
                        onChange={handleFileSelect}
                        style={{ color: 'white' }}
                    />
                    
                    <button 
                        onClick={handleToggleTestCube}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: showTestCube ? '#ff4444' : '#0088ff',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        {showTestCube ? 'Hide Test Cube' : 'Show Test Cube'}
                    </button>
                    
                    <button 
                        onClick={handleToggle3DViewer}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: show3DViewer ? '#44ff44' : '#666666',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        {show3DViewer ? '3D Viewer ON' : '3D Viewer OFF'}
                    </button>
                    
                    {/* Phase 3: Video Export Controls */}
                    <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={!show3DViewer || (!modelUrl && !showTestCube)}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: isRecording ? '#ff4444' : '#00ff00',
                            color: 'black',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: (!show3DViewer || (!modelUrl && !showTestCube)) ? 'not-allowed' : 'pointer',
                            opacity: (!show3DViewer || (!modelUrl && !showTestCube)) ? 0.5 : 1
                        }}
                    >
                        {isRecording ? '🔴 Recording... (' + recordingProgress + '%)' : '📹 Generate Hologram Video (15s)'}
                    </button>
                </div>

                {/* File Info */}
                {selectedFile && (
                    <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                        <strong>📁 Selected:</strong> {selectedFile.name} 
                        <span style={{ color: '#888' }}> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                )}

                {/* Upload Status */}
                {uploadStatus && (
                    <div style={{ 
                        color: uploadStatus.includes('❌') ? '#ff4444' : '#44ff44',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        {uploadStatus}
                    </div>
                )}

                {/* Phase 3: Recording Progress Indicator */}
                {isRecording && (
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ 
                            width: '100%', 
                            height: '6px', 
                            backgroundColor: '#333',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            border: '1px solid #00ffff'
                        }}>
                            <div style={{
                                width: `${recordingProgress}%`,
                                height: '100%',
                                backgroundColor: '#00ff00',
                                transition: 'width 0.1s ease',
                                boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)'
                            }} />
                        </div>
                        <p style={{ 
                            fontSize: '12px', 
                            color: '#00ffff', 
                            marginTop: '5px',
                            textAlign: 'center',
                            fontWeight: 'bold'
                        }}>
                            🎬 Recording hologram video... {recordingProgress}% ({Math.round(recordingProgress * 0.15)}s / 15s)
                        </p>
                    </div>
                )}
            </div>

            {/* 3D Viewer Area */}
            <div style={{ flex: 1, position: 'relative' }}>
                {show3DViewer ? (
                    <ModelViewer 
                        modelUrl={modelUrl} 
                        showTestCube={showTestCube}
                    />
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        backgroundColor: '#333'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ color: '#00ffff' }}>🎯 3D Model Viewer</h2>
                            <p>Click "3D Viewer ON" to activate the viewer</p>
                            <p>Then upload a 3D model or show test cube</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;