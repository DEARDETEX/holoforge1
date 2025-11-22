import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// OrbitControls removed - using fixed camera for hologram environment
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import * as THREE from 'three';

// Error boundary component for debugging
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
        console.error('🚨 [ModelViewer] Error boundary caught:', error, errorInfo);
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    color: 'red', 
                    padding: '20px', 
                    backgroundColor: '#222',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <h2>🚨 3D Viewer Error</h2>
                    <p>Error: {this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()}>Reload Page</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ADAPTIVE SCALING SYSTEM - Universal model sizing for any 3D model
const setupModelScaling = (mesh, camera) => {
    console.log('🎯 [AdaptiveScaling] Starting intelligent model scaling...');
    
    // Step 1: Calculate true bounding sphere of the model
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Bounding sphere radius (maximum extent from center)
    const radius = Math.max(size.x, size.y, size.z) / 2;
    
    console.log('📏 [AdaptiveScaling] Model measurements:', {
        boundingBoxSize: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
        boundingSphereRadius: radius.toFixed(2),
        originalCenter: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) }
    });
    
    // Step 2: Calculate camera viewing parameters
    const cameraDistance = camera.position.length(); // Distance from camera to origin
    const fov = camera.fov * (Math.PI / 180); // Field of view in radians
    const aspectRatio = camera.aspect || (16 / 9);
    
    // Calculate visible dimensions at origin (where model will be placed)
    const visibleHeight = 2 * Math.tan(fov / 2) * cameraDistance;
    const visibleWidth = visibleHeight * aspectRatio;
    
    console.log('📐 [AdaptiveScaling] Camera viewing space:', {
        cameraDistance: cameraDistance.toFixed(2),
        visibleHeight: visibleHeight.toFixed(2),
        visibleWidth: visibleWidth.toFixed(2),
        fieldOfView: camera.fov + '°'
    });
    
    // Step 3: Intelligent scaling calculation
    // Target: model occupies 65% of viewport height for optimal viewing
    const viewportOccupancy = 0.65; // 65% fills screen nicely without clipping
    const targetHeight = visibleHeight * viewportOccupancy;
    
    // Scale factor = target size / current size
    const modelDiameter = radius * 2;
    const scale = targetHeight / modelDiameter;
    
    // Safety clamps: prevent extreme scaling issues
    const clampedScale = Math.max(0.0001, Math.min(scale, 1000));
    
    console.log('⚖️ [AdaptiveScaling] Scale calculation:', {
        targetViewportHeight: targetHeight.toFixed(2),
        modelDiameter: modelDiameter.toFixed(2),
        calculatedScale: scale.toFixed(4),
        appliedScale: clampedScale.toFixed(4),
        viewportOccupancy: Math.round(viewportOccupancy * 100) + '%'
    });
    
    // Apply calculated scale
    mesh.scale.setScalar(clampedScale);
    
    // Step 4: Center model at origin (where camera looks)
    // Recalculate center after scaling
    const scaledBox = new THREE.Box3().setFromObject(mesh);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    
    // Position model so its center is at origin
    mesh.position.sub(scaledCenter);
    
    // Slight lift above ground plane for better presentation
    const groundOffset = 0.3;
    mesh.position.y += groundOffset;
    
    console.log('📍 [AdaptiveScaling] Final positioning:', {
        position: { 
            x: mesh.position.x.toFixed(2), 
            y: mesh.position.y.toFixed(2), 
            z: mesh.position.z.toFixed(2) 
        },
        scale: clampedScale.toFixed(4)
    });
    
    console.log('✅ [AdaptiveScaling] Model ready - optimally sized for viewport!');
    
    return {
        scale: clampedScale,
        radius: radius,
        viewportOccupancy: viewportOccupancy
    };
};

// 3D Model Loader Component with specific technical fixes
function Model3D({ modelUrl }) {
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [geometryBounds, setGeometryBounds] = useState(null);
    const meshRef = useRef();
    
    // Get camera reference for adaptive scaling
    const { camera } = useThree();
    const cameraRef = useRef(camera);

    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);
    
    // Hologram animation with shader uniforms
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
            
            // Animate hologram shader uniforms if material has them
            if (meshRef.current.material && meshRef.current.material.uniforms) {
                meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
            }
        }
    });

    useEffect(() => {
        if (!modelUrl) return;
        
        console.log('🚀 [HologramEnvironment] Loading 3D model from:', modelUrl);
        setLoading(true);
        setError(null);
        setModel(null);
        
        // Detect file type from URL
        const fileExtension = modelUrl.split('.').pop().toLowerCase();
        console.log('📁 File type detected:', fileExtension);
        
        if (fileExtension === 'gltf' || fileExtension === 'glb') {
            // ============================================
            // GLTF/GLB LOADER - Modern format with embedded scene
            // ============================================
            console.log('🌟 Using GLTF Loader');
            const gltfLoader = new GLTFLoader();
            
            gltfLoader.load(
                modelUrl,
                (gltf) => {
                    console.log('✅ GLTF loaded successfully');
                    console.log('📦 GLTF scene structure:', gltf.scene);
                    
                    // GLTF provides complete scene
                    const scene = gltf.scene;
                    
                    // Collect all meshes from GLTF scene
                    const meshes = [];
                    scene.traverse((child) => {
                        if (child.isMesh) {
                            meshes.push(child);
                            console.log('🔍 Found mesh:', child.name || 'unnamed');
                        }
                    });
                    
                    console.log(`✅ Found ${meshes.length} mesh(es) in GLTF`);
                    
                    if (meshes.length === 0) {
                        setError('No meshes found in GLTF file');
                        setLoading(false);
                        return;
                    }
                    
                    // Create merged geometry from all meshes
                    let mergedGeometry;
                    
                    if (meshes.length === 1) {
                        mergedGeometry = meshes[0].geometry.clone();
                    } else {
                        // Merge multiple meshes
                        const geometries = [];
                        meshes.forEach(mesh => {
                            const geo = mesh.geometry.clone();
                            mesh.updateMatrixWorld();
                            geo.applyMatrix4(mesh.matrixWorld);
                            geometries.push(geo);
                        });
                        
                        // Merge all geometries into one
                        mergedGeometry = new THREE.BufferGeometry();
                        let totalVertices = 0;
                        let totalIndices = 0;
                        
                        geometries.forEach(geo => {
                            totalVertices += geo.attributes.position.count;
                            if (geo.index) {
                                totalIndices += geo.index.count;
                            }
                        });
                        
                        console.log(`🔧 Merging ${geometries.length} geometries: ${totalVertices} vertices`);
                        
                        // Simple merge - combine first geometry (for now)
                        mergedGeometry = geometries[0];
                    }
                    
                    // Compute normals and bounds
                    mergedGeometry.computeBoundingBox();
                    mergedGeometry.computeVertexNormals();
                    
                    const bbox = mergedGeometry.boundingBox;
                    console.log('📏 [HologramEnvironment] GLTF Geometry bounds:', bbox);
                    console.log('  └─ Min:', bbox.min);
                    console.log('  └─ Max:', bbox.max);
                    console.log('  └─ Size:', {
                        x: bbox.max.x - bbox.min.x,
                        y: bbox.max.y - bbox.min.y,
                        z: bbox.max.z - bbox.min.z
                    });
                    
                    setGeometryBounds(bbox);
                    
                    // Apply hologram material
                    const hologramMaterial = createHologramMaterial();
                    
                    // Create final hologram mesh
                    const hologramMesh = new THREE.Mesh(mergedGeometry, hologramMaterial);
                    
                    // Apply adaptive scaling (your existing function)
                    console.log('🎯 [HologramEnvironment] Applying adaptive scaling...');
                    const scalingInfo = setupModelScaling(hologramMesh, cameraRef.current);
                    
                    console.log('✅ GLTF model ready:', {
                        meshCount: meshes.length,
                        scale: scalingInfo.scale.toFixed(4),
                        modelRadius: scalingInfo.radius.toFixed(2),
                        viewportFill: Math.round(scalingInfo.viewportOccupancy * 100) + '%'
                    });
                    
                    setModel(hologramMesh);
                    setLoading(false);
                    console.log('🎉 [HologramEnvironment] GLTF model ready for hologram display!');
                },
                (progress) => {
                    // Loading progress
                    const percent = (progress.loaded / progress.total) * 100;
                    console.log(`📊 [HologramEnvironment] GLTF Loading: ${percent.toFixed(0)}%`);
                },
                (error) => {
                    console.error('❌ GLTF loading error:', error);
                    setError('Failed to load GLTF: ' + error.message);
                    setLoading(false);
                }
            );
            
        } else {
            // ============================================
            // OBJ LOADER - Multi-mesh support with proper merging
            // ============================================
            console.log('📦 Using OBJ Loader');
            const objLoader = new OBJLoader();
            
            objLoader.load(
                modelUrl,
                // Success callback
                (object) => {
                    console.log('🎨 [ModelViewer] OBJ loaded successfully');
                    console.log('📦 [ModelViewer] Object structure:', {
                        type: object.type,
                        childrenCount: object.children.length
                    });
                    
                    // ============================================
                    // COLLECT ALL MESHES (Recursive Traversal)
                    // ============================================
                    const meshes = [];
                    
                    object.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            meshes.push(child);
                            console.log('🔍 Found mesh:', {
                                name: child.name || 'unnamed',
                                vertices: child.geometry.attributes.position?.count || 0
                            });
                        }
                    });
                    
                    console.log(`✅ Found ${meshes.length} mesh(es) in OBJ`);
                    
                    if (meshes.length === 0) {
                        setError('No meshes found in OBJ file');
                        setLoading(false);
                        return;
                    }
                    
                    // ============================================
                    // MERGE ALL GEOMETRIES PROPERLY
                    // ============================================
                    let mergedGeometry;
                    
                    if (meshes.length === 1) {
                        // Single mesh - simple case
                        mergedGeometry = meshes[0].geometry.clone();
                        console.log('📦 Single mesh - using directly');
                        
                    } else {
                        // Multiple meshes - PROPER MERGING
                        console.log('🔨 Merging', meshes.length, 'meshes...');
                        
                        const geometries = [];
                        
                        meshes.forEach((mesh, index) => {
                            const geo = mesh.geometry.clone();
                            
                            // CRITICAL: Apply mesh transformation to geometry
                            mesh.updateMatrixWorld(true); // Update with parent transforms
                            geo.applyMatrix4(mesh.matrixWorld); // Apply world transform
                            
                            // Ensure geometry has required attributes
                            if (!geo.attributes.position) {
                                console.warn(`⚠️ Mesh ${index} has no position attribute, skipping`);
                                return;
                            }
                            
                            geometries.push(geo);
                            
                            console.log(`  └─ Mesh ${index + 1}: ${geo.attributes.position.count} vertices`);
                        });
                        
                        // Use BufferGeometryUtils for proper merging
                        try {
                            mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
                            console.log('✅ Geometries merged successfully');
                            console.log('📊 Total vertices:', mergedGeometry.attributes.position.count);
                            
                        } catch (error) {
                            console.error('❌ Merge failed:', error);
                            // Fallback: use first geometry
                            mergedGeometry = geometries[0];
                            console.warn('⚠️ Using first geometry as fallback');
                        }
                    }
                    
                    // ============================================
                    // COMPUTE NORMALS AND BOUNDS
                    // ============================================
                    if (!mergedGeometry.attributes.normal) {
                        mergedGeometry.computeVertexNormals();
                        console.log('✅ Computed vertex normals');
                    }
                    
                    mergedGeometry.computeBoundingBox();
                    const bbox = mergedGeometry.boundingBox;
                    
                    console.log('📐 Bounding box:', {
                        min: bbox.min,
                        max: bbox.max,
                        size: {
                            x: (bbox.max.x - bbox.min.x).toFixed(2),
                            y: (bbox.max.y - bbox.min.y).toFixed(2),
                            z: (bbox.max.z - bbox.min.z).toFixed(2)
                        }
                    });
                    
                    setGeometryBounds(bbox);
                    
                    // ============================================
                    // CREATE HOLOGRAM MATERIAL
                    // ============================================
                    const hologramMaterial = createHologramMaterial();
                    
                    // ============================================
                    // CREATE FINAL HOLOGRAM MESH
                    // ============================================
                    const hologramMesh = new THREE.Mesh(mergedGeometry, hologramMaterial);
                    
                    console.log('🎨 Created hologram mesh');
                    
                    // ============================================
                    // APPLY ADAPTIVE SCALING
                    // ============================================
                    console.log('🎯 [HologramEnvironment] Applying adaptive scaling...');
                    const scalingInfo = setupModelScaling(hologramMesh, cameraRef.current);
                    
                    console.log('✅ OBJ model ready:', {
                        meshCount: meshes.length,
                        vertices: mergedGeometry.attributes.position.count,
                        scale: scalingInfo.scale.toFixed(4),
                        modelRadius: scalingInfo.radius.toFixed(2),
                        viewportFill: Math.round(scalingInfo.viewportOccupancy * 100) + '%'
                    });
                    
                    setModel(hologramMesh);
                    setLoading(false);
                    console.log('🎉 [HologramEnvironment] OBJ model ready for hologram display!');
                },
                // Progress callback
                (progress) => {
                    const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
                    console.log(`📊 [HologramEnvironment] OBJ Loading: ${percent.toFixed(0)}%`);
                },
                // Error callback
                (error) => {
                    console.error('❌ OBJ loading error:', error);
                    setError('Failed to load OBJ: ' + error.message);
                    setLoading(false);
                }
            );
        }
    }, [modelUrl]);

    // Loading state - yellow cube
    if (loading) {
        return (
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhongMaterial color="#ffff00" />
            </mesh>
        );
    }

    // Error state - red cube
    if (error) {
        return (
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhongMaterial color="#ff0000" />
            </mesh>
        );
    }

    // Loaded model
    if (model) {
        return <primitive ref={meshRef} object={model} />;
    }

    return null;
}

// Test cube for debugging Three.js rendering with hologram effects
function TestCube() {
    const meshRef = useRef();
    const [material] = useState(() => createHologramMaterial());
    
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += 0.01;
            meshRef.current.rotation.y += 0.01;
            
            // Animate hologram shader
            if (meshRef.current.material && meshRef.current.material.uniforms) {
                meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
            }
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]} material={material}>
            <boxGeometry args={[2, 2, 2]} />
        </mesh>
    );
}

// Hologram Shader Material - Phase 2 Implementation
const createHologramMaterial = () => {
    const hologramVertexShader = `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const hologramFragmentShader = `
        uniform float time;
        uniform vec3 color;
        uniform float glowIntensity;
        uniform float scanSpeed;
        uniform float flickerRate;
        
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        varying vec2 vUv;
        
        void main() {
            // Fresnel effect for edge glow
            float fresnel = pow(1.0 - abs(dot(vNormal, vPositionNormal)), 2.5);
            
            // Scan lines effect
            float scanline = sin(gl_FragCoord.y * 0.01 + time * scanSpeed) * 0.05 + 0.95;
            
            // Hologram flicker effect
            float flicker = sin(time * flickerRate) * 0.02 + 0.98;
            
            // Additional hologram distortion
            float distortion = sin(vUv.y * 20.0 + time * 2.0) * 0.01;
            
            // Combine effects
            vec3 glow = color * (fresnel * glowIntensity + 0.1);
            float alpha = (fresnel * 0.7 + 0.3) * scanline * flicker;
            
            gl_FragColor = vec4(glow + distortion, alpha);
        }
    `;

    return new THREE.ShaderMaterial({
        vertexShader: hologramVertexShader,
        fragmentShader: hologramFragmentShader,
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x00ffff) },
            glowIntensity: { value: 1.5 },
            scanSpeed: { value: 5.0 },
            flickerRate: { value: 15.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
};

// Main ModelViewer Component - HOLOGRAM ENVIRONMENT MODE
function ModelViewer({ modelUrl, showTestCube = false }) {
    return (
        <ErrorBoundary>
            <div style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }}>
                <Canvas
                    // HOLOGRAM MODE: Fixed camera position (8, 6, 8) - NO ORBIT CONTROLS
                    camera={{ 
                        position: [8, 6, 8], // Fixed position as specified for hologram environment
                        fov: 75,
                        near: 0.1,
                        far: 1000
                    }}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        minHeight: '400px',
                        backgroundColor: '#000',
                        display: 'block'
                    }}
                    onCreated={(state) => {
                        console.log('🎬 [HologramEnvironment] WebGL context created successfully');
                        console.log('  └─ Renderer:', state.gl.capabilities.version);
                        console.log('  └─ Fixed Camera Position:', state.camera.position);
                        console.log('  └─ Camera FOV:', state.camera.fov);
                        console.log('  └─ Canvas size:', state.size);
                        // CRITICAL: Camera always looks at origin (0, 0, 0)
                        state.camera.lookAt(0, 0, 0);
                    }}
                >
                    {/* HOLOGRAM ENVIRONMENT: Professional 3-Point Lighting System */}
                    <ambientLight intensity={0.3} color="#404040" />
                    <directionalLight position={[10, 10, 5]} intensity={0.8} color="#ffffff" />
                    <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#4444ff" />
                    
                    {/* 3D Content positioned for hologram display */}
                    {showTestCube ? <TestCube /> : null}
                    {modelUrl && !showTestCube ? <Model3D modelUrl={modelUrl} /> : null}
                    
                    {/* NO ORBIT CONTROLS - Fixed camera for hologram environment */}
                    {/* OrbitControls removed for professional hologram setup */}
                </Canvas>
            </div>
        </ErrorBoundary>
    );
}

export default ModelViewer;