/**
 * GLBLoaderPlugin - Loads GLB/GLTF files with multi-mesh support
 * 
 * Based on proven multi-mesh optimization
 * Implements Blender-inspired geometry merging
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import ModelLoaderPlugin from '../plugins/ModelLoaderPlugin';

class GLBLoaderPlugin extends ModelLoaderPlugin {
    constructor() {
        super();
        
        // Plugin metadata
        this.name = "GLB Loader";
        this.version = "2.0.0";
        this.supportedFormats = ['glb', 'gltf'];
        this.priority = 100; // Standard priority
        
        // Capabilities
        this.capabilities = {
            supportsMultiMesh: true,
            supportsAnimations: true,
            supportsTextures: true,
            maxFileSize: 100 * 1024 * 1024 // 100MB
        };
        
        // Three.js loader instance
        this.loader = new GLTFLoader();
        
        console.log(`✅ ${this.name} initialized`);
    }
    
    /**
     * Load GLB/GLTF file
     * @param {string} url
     * @param {Object} options
     * @returns {Promise<THREE.Object3D>}
     */
    async load(url, options = {}) {
        console.log('═══════════════════════════════════════');
        console.log('🎨 GLB LOADING START - MULTI-MESH SYSTEM');
        console.log('═══════════════════════════════════════');
        
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                
                // Success callback
                (gltf) => {
                    try {
                        console.log('📦 GLB file parsed successfully');
                        console.log(`   Root type: ${gltf.scene.type}`);
                        console.log(`   Direct children: ${gltf.scene.children.length}`);
                        
                        // Return the scene (post-processing will handle optimization)
                        resolve(gltf.scene);
                        
                    } catch (error) {
                        console.error('❌ Error processing GLB:', error);
                        reject(error);
                    }
                },
                
                // Progress callback
                (progress) => {
                    if (options.onProgress) {
                        options.onProgress(progress);
                    }
                },
                
                // Error callback
                (error) => {
                    console.error('═══════════════════════════════════════');
                    console.error('❌ GLB LOADING FAILED');
                    console.error('═══════════════════════════════════════');
                    console.error('Error:', error);
                    console.error('URL:', url);
                    console.error('═══════════════════════════════════════');
                    
                    reject(new Error(`Failed to load GLB: ${error.message}`));
                }
            );
        });
    }
    
    /**
     * Post-process: Apply multi-mesh optimization
     * This is where the Blender-inspired magic happens!
     * @param {THREE.Object3D} scene
     * @param {Object} options
     * @returns {Promise<THREE.Object3D>}
     */
    async postProcess(scene, options = {}) {
        console.log('═══════════════════════════════════════');
        console.log('🔧 POST-PROCESSING: Multi-Mesh Optimization');
        console.log('═══════════════════════════════════════');
        
        // Collect all meshes (Blender-inspired traversal)
        const meshes = this.collectMeshes(scene);
        
        console.log(`✅ Mesh Collection Complete`);
        console.log(`   Total meshes found: ${meshes.length}`);
        
        if (meshes.length === 0) {
            console.warn('⚠️  No meshes found in scene');
            return scene;
        }
        
        // Merge geometries (if multiple meshes)
        if (meshes.length > 1 && options.mergeGeometries !== false) {
            const mergedMesh = this.mergeGeometries(meshes);
            
            // Replace scene with merged mesh
            const container = new THREE.Group();
            container.add(mergedMesh);
            
            console.log('✅ Multi-mesh optimization complete');
            return container;
        }
        
        console.log('📦 Single mesh - no merging needed');
        return scene;
    }
    
    /**
     * Collect all meshes from scene graph
     * @param {THREE.Object3D} object
     * @returns {Array<THREE.Mesh>}
     */
    collectMeshes(object) {
        const meshes = [];
        let totalVertices = 0;
        
        console.log('🔍 Starting recursive mesh collection...');
        
        // Recursive traversal
        object.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const vertCount = child.geometry.attributes.position?.count || 0;
                
                if (vertCount === 0) {
                    console.warn(`⚠️  Skipping mesh "${child.name}" - no vertices`);
                    return;
                }
                
                meshes.push(child);
                totalVertices += vertCount;
                
                console.log(`  ✓ Mesh ${meshes.length}: "${child.name || 'unnamed'}"`, {
                    vertices: vertCount,
                    hasNormals: !!child.geometry.attributes.normal,
                    hasUVs: !!child.geometry.attributes.uv
                });
            }
        });
        
        console.log(`📊 Collection complete: ${meshes.length} meshes, ${totalVertices} vertices`);
        
        return meshes;
    }
    
    /**
     * Merge multiple geometries into one (Blender-inspired)
     * @param {Array<THREE.Mesh>} meshes
     * @returns {THREE.Mesh}
     */
    mergeGeometries(meshes) {
        console.log('═══════════════════════════════════════');
        console.log(`🔨 MERGING ${meshes.length} MESHES`);
        console.log('   Using Blender-inspired batching system');
        console.log('═══════════════════════════════════════');
        
        // Prepare geometries with world transforms
        const geometriesToMerge = [];
        
        meshes.forEach((mesh, index) => {
            console.log(`  Processing mesh ${index + 1}/${meshes.length}...`);
            
            // Clone geometry
            const geo = mesh.geometry.clone();
            
            // Apply world transform (CRITICAL for correct positioning)
            mesh.updateMatrixWorld(true);
            geo.applyMatrix4(mesh.matrixWorld);
            
            // Ensure normals exist
            if (!geo.attributes.normal) {
                console.log(`  🔧 Computing normals for mesh ${index + 1}...`);
                geo.computeVertexNormals();
            }
            
            geometriesToMerge.push(geo);
            
            console.log(`  ✅ Mesh ${index + 1} prepared: {vertices: ${geo.attributes.position.count}, transformed: true}`);
        });
        
        // Execute merge
        try {
            console.log('🔨 Calling BufferGeometryUtils.mergeGeometries...');
            
            const mergedGeometry = BufferGeometryUtils.mergeGeometries(
                geometriesToMerge,
                false // No material groups needed
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
                hasIndex: !!mergedGeometry.index
            });
            console.log('═══════════════════════════════════════');
            
            // Compute bounding box/sphere for scaling
            mergedGeometry.computeBoundingBox();
            mergedGeometry.computeBoundingSphere();
            
            // Create mesh with merged geometry
            const mergedMesh = new THREE.Mesh(
                mergedGeometry,
                new THREE.MeshStandardMaterial() // Placeholder
            );
            
            // Dispose intermediate geometries (memory cleanup)
            geometriesToMerge.forEach(geo => geo.dispose());
            
            console.log('✅ Merged mesh created successfully');
            
            return mergedMesh;
            
        } catch (error) {
            console.error('═══════════════════════════════════════');
            console.error('❌ MERGE FAILED!');
            console.error('   Error:', error.message);
            console.error('═══════════════════════════════════════');
            console.error('⚠️  Falling back to first geometry only');
            
            // Fallback: return first mesh
            return meshes[0];
        }
    }
}

export default GLBLoaderPlugin;
