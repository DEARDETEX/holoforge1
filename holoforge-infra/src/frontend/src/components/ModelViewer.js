import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// OrbitControls removed - using fixed camera for hologram environment
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import * as THREE from 'three';

// ✨ NEW: Import UniversalModelLoader for plugin-based loading
import UniversalModelLoader from '../core/plugins/UniversalModelLoader';

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
            // GLB LOADER - Blender-Inspired Multi-Mesh System
            // (Adapted from proven OBJ multi-mesh solution)
            // ============================================
            console.log('📦 Using GLB Loader with Multi-Mesh Support');
            const gltfLoader = new GLTFLoader();
            
            gltfLoader.load(
                modelUrl,
                // SUCCESS CALLBACK
                (gltf) => {
                    console.log('═══════════════════════════════════════');
                    console.log('🎨 GLB LOADING START - BLENDER METHOD');
                    console.log('═══════════════════════════════════════');
                    console.log('📦 Root object type:', gltf.scene.type);
                    console.log('📦 Direct children:', gltf.scene.children.length);
                    
                    // ============================================
                    // PHASE 1: MESH COLLECTION (Blender's Scene Traversal)
                    // Based on: source/blender/draw/intern/draw_manager.cc
                    // IDENTICAL to OBJ approach - same scene graph structure
                    // ============================================
                    const meshes = [];
                    let totalVerticesBeforeMerge = 0;
                    
                    console.log('🔍 Starting recursive mesh collection...');
                    
                    // Recursive traversal (Blender's scene graph pattern)
                    gltf.scene.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const vertCount = child.geometry.attributes.position?.count || 0;
                            
                            if (vertCount === 0) {
                                console.warn(`⚠️  Skipping mesh "${child.name}" - no vertices`);
                                return;
                            }
                            
                            meshes.push(child);
                            totalVerticesBeforeMerge += vertCount;
                            
                            console.log(`  ✓ Mesh ${meshes.length}: "${child.name || 'unnamed'}"`, {
                                vertices: vertCount,
                                hasNormals: !!child.geometry.attributes.normal,
                                hasUVs: !!child.geometry.attributes.uv,
                                position: {
                                    x: child.position.x.toFixed(2),
                                    y: child.position.y.toFixed(2),
                                    z: child.position.z.toFixed(2)
                                }
                            });
                        }
                    });
                    
                    console.log('═══════════════════════════════════════');
                    console.log('✅ Mesh Collection Complete');
                    console.log(`   Total meshes found: ${meshes.length}`);
                    console.log(`   Total vertices: ${totalVerticesBeforeMerge}`);
                    console.log('═══════════════════════════════════════');
                    
                    // Validation
                    if (meshes.length === 0) {
                        console.error('❌ CRITICAL: No meshes found in GLB file!');
                        setError('No 3D geometry found in GLB file');
                        setLoading(false);
                        return;
                    }
                    
                    // ============================================
                    // PHASE 2: GEOMETRY MERGING (Blender's GPU Batch System)
                    // Based on: source/blender/gpu/GPU_batch.hh
                    // IDENTICAL to OBJ approach
                    // ============================================
                    let mergedGeometry;
                    
                    if (meshes.length === 1) {
                        // Single mesh - direct use (no merge needed)
                        console.log('📦 Single mesh detected - using directly');
                        mergedGeometry = meshes[0].geometry.clone();
                        
                    } else {
                        // Multi-mesh - Professional merging (Blender's approach)
                        console.log('═══════════════════════════════════════');
                        console.log(`🔨 MERGING ${meshes.length} MESHES`);
                        console.log('   Using Blender-inspired batching system');
                        console.log('═══════════════════════════════════════');
                        
                        // Step 1: Verify BufferGeometryUtils availability
                        if (typeof BufferGeometryUtils === 'undefined' || 
                            typeof BufferGeometryUtils.mergeGeometries === 'undefined') {
                            console.error('❌ CRITICAL: BufferGeometryUtils not available!');
                            console.error('   Import statement missing or failed');
                            console.error('   Falling back to first mesh only');
                            mergedGeometry = meshes[0].geometry.clone();
                        } else {
                            console.log('✅ BufferGeometryUtils available');
                            
                            // Step 2: Prepare geometries with world transforms
                            // (Blender applies model matrix before batching)
                            const geometriesToMerge = [];
                            
                            meshes.forEach((mesh, index) => {
                                console.log(`  Processing mesh ${index + 1}/${meshes.length}...`);
                                
                                // Clone geometry to avoid modifying original
                                const geo = mesh.geometry.clone();
                                
                                // CRITICAL: Apply world transform
                                // (Blender does this in draw_manager before GPU submission)
                                mesh.updateMatrixWorld(true);
                                geo.applyMatrix4(mesh.matrixWorld);
                                
                                // Validate geometry has required attributes
                                if (!geo.attributes.position) {
                                    console.warn(`  ⚠️  Mesh ${index + 1} missing position attribute - SKIPPING`);
                                    return;
                                }
                                
                                // Ensure normals exist (Blender always provides normals)
                                if (!geo.attributes.normal) {
                                    console.log(`  🔧 Computing normals for mesh ${index + 1}...`);
                                    geo.computeVertexNormals();
                                }
                                
                                geometriesToMerge.push(geo);
                                
                                console.log(`  ✅ Mesh ${index + 1} prepared:`, {
                                    vertices: geo.attributes.position.count,
                                    hasNormals: !!geo.attributes.normal,
                                    transformed: true
                                });
                            });
                            
                            console.log(`📦 Geometries ready for merge: ${geometriesToMerge.length}`);
                            
                            // Step 3: Execute merge (Blender's GPU batch creation)
                            try {
                                console.log('🔨 Calling BufferGeometryUtils.mergeGeometries...');
                                
                                // mergeGeometries(geometries, useGroups)
                                // useGroups=false: single material (our hologram shader)
                                mergedGeometry = BufferGeometryUtils.mergeGeometries(
                                    geometriesToMerge, 
                                    false  // No material groups needed
                                );
                                
                                if (!mergedGeometry) {
                                    throw new Error('mergeGeometries returned null');
                                }
                                
                                console.log('═══════════════════════════════════════');
                                console.log('✅ MERGE SUCCESSFUL!');
                                console.log('   Method: BufferGeometryUtils.mergeGeometries');
                                console.log('   Result:', {
                                    totalVertices: mergedGeometry.attributes.position.count,
                                    hasNormals: !!mergedGeometry.attributes.normal,
                                    hasIndex: !!mergedGeometry.index,
                                    drawMode: mergedGeometry.drawMode
                                });
                                console.log('═══════════════════════════════════════');
                                
                            } catch (error) {
                                console.error('═══════════════════════════════════════');
                                console.error('❌ MERGE FAILED!');
                                console.error('   Error:', error.message);
                                console.error('   Stack:', error.stack);
                                console.error('═══════════════════════════════════════');
                                console.error('⚠️  Falling back to first geometry only');
                                mergedGeometry = geometriesToMerge[0] || meshes[0].geometry.clone();
                            }
                        }
                    }
                    
                    // ============================================
                    // PHASE 3: GEOMETRY FINALIZATION
                    // ============================================
                    console.log('🔧 Finalizing merged geometry...');
                    
                    // Ensure normals are computed
                    if (!mergedGeometry.attributes.normal) {
                        console.log('  Computing vertex normals...');
                        mergedGeometry.computeVertexNormals();
                    }
                    
                    // Compute bounding box (required for adaptive scaling)
                    mergedGeometry.computeBoundingBox();
                    const bbox = mergedGeometry.boundingBox;
                    
                    console.log('📐 Bounding Box:', {
                        min: {
                            x: bbox.min.x.toFixed(2),
                            y: bbox.min.y.toFixed(2),
                            z: bbox.min.z.toFixed(2)
                        },
                        max: {
                            x: bbox.max.x.toFixed(2),
                            y: bbox.max.y.toFixed(2),
                            z: bbox.max.z.toFixed(2)
                        },
                        size: {
                            x: (bbox.max.x - bbox.min.x).toFixed(2),
                            y: (bbox.max.y - bbox.min.y).toFixed(2),
                            z: (bbox.max.z - bbox.min.z).toFixed(2)
                        }
                    });
                    
                    setGeometryBounds(bbox);
                    
                    // ============================================
                    // PHASE 4: HOLOGRAM MATERIAL APPLICATION
                    // ============================================
                    console.log('🎨 Creating hologram material...');
                    const hologramMaterial = createHologramMaterial();
                    
                    // Create final mesh (Blender's GPU batch equivalent)
                    const hologramMesh = new THREE.Mesh(mergedGeometry, hologramMaterial);
                    
                    console.log('✅ Hologram mesh created');
                    
                    // ============================================
                    // PHASE 5: ADAPTIVE SCALING
                    // ============================================
                    console.log('═══════════════════════════════════════');
                    console.log('🎯 Applying Adaptive Scaling System');
                    console.log('═══════════════════════════════════════');
                    
                    const scalingInfo = setupModelScaling(hologramMesh, cameraRef.current);
                    
                    console.log('═══════════════════════════════════════');
                    console.log('✅ GLB MODEL READY FOR DISPLAY');
                    console.log('═══════════════════════════════════════');
                    console.log('📊 Final Statistics:', {
                        meshCount: meshes.length,
                        totalVertices: mergedGeometry.attributes.position.count,
                        scale: scalingInfo.scale.toFixed(6),
                        radius: scalingInfo.radius.toFixed(2),
                        viewportFill: Math.round(scalingInfo.viewportOccupancy * 100) + '%'
                    });
                    console.log('═══════════════════════════════════════');
                    console.log('🎉 LOADING COMPLETE - READY TO RENDER');
                    console.log('═══════════════════════════════════════');
                    
                    // Set the final model
                    setModel(hologramMesh);
                    setLoading(false);
                },
                
                // PROGRESS CALLBACK
                (progress) => {
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total) * 100;
                        console.log(`📊 Loading GLB: ${percent.toFixed(0)}%`);
                    }
                },
                
                // ERROR CALLBACK
                (error) => {
                    console.error('═══════════════════════════════════════');
                    console.error('❌ GLB LOADING FAILED');
                    console.error('═══════════════════════════════════════');
                    console.error('Error:', error);
                    console.error('Message:', error.message);
                    console.error('Stack:', error.stack);
                    console.error('═══════════════════════════════════════');
                    setError('Failed to load GLB: ' + error.message);
                    setLoading(false);
                }
            );
            
        } else {
            // ============================================
            // OBJ LOADER - Blender-Inspired Multi-Mesh System
            // ============================================
            console.log('📦 Using OBJ Loader with Multi-Mesh Support');
            const objLoader = new OBJLoader();
            
            objLoader.load(
                modelUrl,
                // SUCCESS CALLBACK
                (object) => {
                    console.log('═══════════════════════════════════════');
                    console.log('🎨 OBJ LOADING START - BLENDER METHOD');
                    console.log('═══════════════════════════════════════');
                    console.log('📦 Root object type:', object.type);
                    console.log('📦 Direct children:', object.children.length);
                    
                    // ============================================
                    // PHASE 1: MESH COLLECTION (Blender's Scene Traversal)
                    // Based on: source/blender/draw/intern/draw_manager.cc
                    // ============================================
                    const meshes = [];
                    let totalVerticesBeforeMerge = 0;
                    
                    console.log('🔍 Starting recursive mesh collection...');
                    
                    // Recursive traversal (Blender's scene graph pattern)
                    object.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const vertCount = child.geometry.attributes.position?.count || 0;
                            
                            if (vertCount === 0) {
                                console.warn(`⚠️  Skipping mesh "${child.name}" - no vertices`);
                                return;
                            }
                            
                            meshes.push(child);
                            totalVerticesBeforeMerge += vertCount;
                            
                            console.log(`  ✓ Mesh ${meshes.length}: "${child.name || 'unnamed'}"`, {
                                vertices: vertCount,
                                hasNormals: !!child.geometry.attributes.normal,
                                hasUVs: !!child.geometry.attributes.uv,
                                position: {
                                    x: child.position.x.toFixed(2),
                                    y: child.position.y.toFixed(2),
                                    z: child.position.z.toFixed(2)
                                }
                            });
                        }
                    });
                    
                    console.log('═══════════════════════════════════════');
                    console.log('✅ Mesh Collection Complete');
                    console.log(`   Total meshes found: ${meshes.length}`);
                    console.log(`   Total vertices: ${totalVerticesBeforeMerge}`);
                    console.log('═══════════════════════════════════════');
                    
                    // Validation
                    if (meshes.length === 0) {
                        console.error('❌ CRITICAL: No meshes found in OBJ file!');
                        setError('No 3D geometry found in OBJ file');
                        setLoading(false);
                        return;
                    }
                    
                    // ============================================
                    // PHASE 2: GEOMETRY MERGING (Blender's GPU Batch System)
                    // Based on: source/blender/gpu/GPU_batch.hh
                    // ============================================
                    let mergedGeometry;
                    
                    if (meshes.length === 1) {
                        // Single mesh - direct use (no merge needed)
                        console.log('📦 Single mesh detected - using directly');
                        mergedGeometry = meshes[0].geometry.clone();
                        
                    } else {
                        // Multi-mesh - Professional merging (Blender's approach)
                        console.log('═══════════════════════════════════════');
                        console.log(`🔨 MERGING ${meshes.length} MESHES`);
                        console.log('   Using Blender-inspired batching system');
                        console.log('═══════════════════════════════════════');
                        
                        // Step 1: Verify BufferGeometryUtils availability
                        if (typeof BufferGeometryUtils === 'undefined' || 
                            typeof BufferGeometryUtils.mergeGeometries === 'undefined') {
                            console.error('❌ CRITICAL: BufferGeometryUtils not available!');
                            console.error('   Import statement missing or failed');
                            console.error('   Falling back to first mesh only');
                            mergedGeometry = meshes[0].geometry.clone();
                        } else {
                            console.log('✅ BufferGeometryUtils available');
                            
                            // Step 2: Prepare geometries with world transforms
                            // (Blender applies model matrix before batching)
                            const geometriesToMerge = [];
                            
                            meshes.forEach((mesh, index) => {
                                console.log(`  Processing mesh ${index + 1}/${meshes.length}...`);
                                
                                // Clone geometry to avoid modifying original
                                const geo = mesh.geometry.clone();
                                
                                // CRITICAL: Apply world transform
                                // (Blender does this in draw_manager before GPU submission)
                                mesh.updateMatrixWorld(true);
                                geo.applyMatrix4(mesh.matrixWorld);
                                
                                // Validate geometry has required attributes
                                if (!geo.attributes.position) {
                                    console.warn(`  ⚠️  Mesh ${index + 1} missing position attribute - SKIPPING`);
                                    return;
                                }
                                
                                // Ensure normals exist (Blender always provides normals)
                                if (!geo.attributes.normal) {
                                    console.log(`  🔧 Computing normals for mesh ${index + 1}...`);
                                    geo.computeVertexNormals();
                                }
                                
                                geometriesToMerge.push(geo);
                                
                                console.log(`  ✅ Mesh ${index + 1} prepared:`, {
                                    vertices: geo.attributes.position.count,
                                    hasNormals: !!geo.attributes.normal,
                                    transformed: true
                                });
                            });
                            
                            console.log(`📦 Geometries ready for merge: ${geometriesToMerge.length}`);
                            
                            // Step 3: Execute merge (Blender's GPU batch creation)
                            try {
                                console.log('🔨 Calling BufferGeometryUtils.mergeGeometries...');
                                
                                // mergeGeometries(geometries, useGroups)
                                // useGroups=false: single material (our hologram shader)
                                mergedGeometry = BufferGeometryUtils.mergeGeometries(
                                    geometriesToMerge, 
                                    false  // No material groups needed
                                );
                                
                                if (!mergedGeometry) {
                                    throw new Error('mergeGeometries returned null');
                                }
                                
                                console.log('═══════════════════════════════════════');
                                console.log('✅ MERGE SUCCESSFUL!');
                                console.log('   Method: BufferGeometryUtils.mergeGeometries');
                                console.log('   Result:', {
                                    totalVertices: mergedGeometry.attributes.position.count,
                                    hasNormals: !!mergedGeometry.attributes.normal,
                                    hasIndex: !!mergedGeometry.index,
                                    drawMode: mergedGeometry.drawMode
                                });
                                console.log('═══════════════════════════════════════');
                                
                            } catch (error) {
                                console.error('═══════════════════════════════════════');
                                console.error('❌ MERGE FAILED!');
                                console.error('   Error:', error.message);
                                console.error('   Stack:', error.stack);
                                console.error('═══════════════════════════════════════');
                                console.error('⚠️  Falling back to first geometry only');
                                mergedGeometry = geometriesToMerge[0] || meshes[0].geometry.clone();
                            }
                        }
                    }
                    
                    // ============================================
                    // PHASE 3: GEOMETRY FINALIZATION
                    // ============================================
                    console.log('🔧 Finalizing merged geometry...');
                    
                    // Ensure normals are computed
                    if (!mergedGeometry.attributes.normal) {
                        console.log('  Computing vertex normals...');
                        mergedGeometry.computeVertexNormals();
                    }
                    
                    // Compute bounding box (required for adaptive scaling)
                    mergedGeometry.computeBoundingBox();
                    const bbox = mergedGeometry.boundingBox;
                    
                    console.log('📐 Bounding Box:', {
                        min: {
                            x: bbox.min.x.toFixed(2),
                            y: bbox.min.y.toFixed(2),
                            z: bbox.min.z.toFixed(2)
                        },
                        max: {
                            x: bbox.max.x.toFixed(2),
                            y: bbox.max.y.toFixed(2),
                            z: bbox.max.z.toFixed(2)
                        },
                        size: {
                            x: (bbox.max.x - bbox.min.x).toFixed(2),
                            y: (bbox.max.y - bbox.min.y).toFixed(2),
                            z: (bbox.max.z - bbox.min.z).toFixed(2)
                        }
                    });
                    
                    setGeometryBounds(bbox);
                    
                    // ============================================
                    // PHASE 4: HOLOGRAM MATERIAL APPLICATION
                    // ============================================
                    console.log('🎨 Creating hologram material...');
                    const hologramMaterial = createHologramMaterial();
                    
                    // Create final mesh (Blender's GPU batch equivalent)
                    const hologramMesh = new THREE.Mesh(mergedGeometry, hologramMaterial);
                    
                    console.log('✅ Hologram mesh created');
                    
                    // ============================================
                    // PHASE 5: ADAPTIVE SCALING
                    // ============================================
                    console.log('═══════════════════════════════════════');
                    console.log('🎯 Applying Adaptive Scaling System');
                    console.log('═══════════════════════════════════════');
                    
                    const scalingInfo = setupModelScaling(hologramMesh, cameraRef.current);
                    
                    console.log('═══════════════════════════════════════');
                    console.log('✅ OBJ MODEL READY FOR DISPLAY');
                    console.log('═══════════════════════════════════════');
                    console.log('📊 Final Statistics:', {
                        meshCount: meshes.length,
                        totalVertices: mergedGeometry.attributes.position.count,
                        scale: scalingInfo.scale.toFixed(6),
                        radius: scalingInfo.radius.toFixed(2),
                        viewportFill: Math.round(scalingInfo.viewportOccupancy * 100) + '%'
                    });
                    console.log('═══════════════════════════════════════');
                    console.log('🎉 LOADING COMPLETE - READY TO RENDER');
                    console.log('═══════════════════════════════════════');
                    
                    // Set the final model
                    setModel(hologramMesh);
                    setLoading(false);
                },
                
                // PROGRESS CALLBACK
                (progress) => {
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total) * 100;
                        console.log(`📊 Loading OBJ: ${percent.toFixed(0)}%`);
                    }
                },
                
                // ERROR CALLBACK
                (error) => {
                    console.error('═══════════════════════════════════════');
                    console.error('❌ OBJ LOADING FAILED');
                    console.error('═══════════════════════════════════════');
                    console.error('Error:', error);
                    console.error('Message:', error.message);
                    console.error('Stack:', error.stack);
                    console.error('═══════════════════════════════════════');
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