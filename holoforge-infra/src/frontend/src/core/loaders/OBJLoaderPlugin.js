/**
 * OBJLoaderPlugin - Loads OBJ files with multi-mesh support
 * 
 * Based on proven multi-mesh optimization (already working)
 * Identical pattern to GLB loader
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import ModelLoaderPlugin from '../plugins/ModelLoaderPlugin';

class OBJLoaderPlugin extends ModelLoaderPlugin {
    constructor() {
        super();
        
        // Plugin metadata
        this.name = "OBJ Loader";
        this.version = "2.0.0";
        this.supportedFormats = ['obj'];
        this.priority = 90; // Slightly lower priority than GLB
        
        // Capabilities
        this.capabilities = {
            supportsMultiMesh: true,
            supportsAnimations: false,
            supportsTextures: true,
            maxFileSize: 100 * 1024 * 1024 // 100MB
        };
        
        // Three.js loader instance
        this.loader = new OBJLoader();
        
        console.log(`✅ ${this.name} initialized`);
    }
    
    /**
     * Load OBJ file
     * @param {string} url
     * @param {Object} options
     * @returns {Promise<THREE.Object3D>}
     */
    async load(url, options = {}) {
        console.log('═══════════════════════════════════════');
        console.log('🎨 OBJ LOADING START - MULTI-MESH SYSTEM');
        console.log('═══════════════════════════════════════');
        
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                
                // Success callback
                (object) => {
                    try {
                        console.log('📦 OBJ file parsed successfully');
                        console.log(`   Root type: ${object.type}`);
                        console.log(`   Direct children: ${object.children.length}`);
                        
                        resolve(object);
                        
                    } catch (error) {
                        console.error('❌ Error processing OBJ:', error);
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
                    console.error('❌ OBJ LOADING FAILED');
                    console.error('═══════════════════════════════════════');
                    console.error('Error:', error);
                    console.error('URL:', url);
                    console.error('═══════════════════════════════════════');
                    
                    reject(new Error(`Failed to load OBJ: ${error.message}`));
                }
            );
        });
    }
    
    /**
     * Post-process: Apply multi-mesh optimization
     * @param {THREE.Object3D} object
     * @param {Object} options
     * @returns {Promise<THREE.Object3D>}
     */
    async postProcess(object, options = {}) {
        console.log('═══════════════════════════════════════');
        console.log('🔧 POST-PROCESSING: Multi-Mesh Optimization');
        console.log('═══════════════════════════════════════');
        
        // Collect all meshes
        const meshes = this.collectMeshes(object);
        
        console.log(`✅ Mesh Collection Complete`);
        console.log(`   Total meshes found: ${meshes.length}`);
        
        if (meshes.length === 0) {
            console.warn('⚠️  No meshes found in OBJ file');
            return object;
        }
        
        // Merge geometries (if multiple meshes)
        if (meshes.length > 1 && options.mergeGeometries !== false) {
            const mergedMesh = this.mergeGeometries(meshes);
            
            // Replace object with merged mesh
            const container = new THREE.Group();
            container.add(mergedMesh);
            
            console.log('✅ Multi-mesh optimization complete');
            return container;
        }
        
        console.log('📦 Single mesh - no merging needed');
        return object;
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
        console.log('═══════════════════════════════════════');
        
        const geometriesToMerge = [];
        
        meshes.forEach((mesh, index) => {
            console.log(`  Processing mesh ${index + 1}/${meshes.length}...`);
            
            const geo = mesh.geometry.clone();
            mesh.updateMatrixWorld(true);
            geo.applyMatrix4(mesh.matrixWorld);
            
            if (!geo.attributes.normal) {
                console.log(`  🔧 Computing normals for mesh ${index + 1}...`);
                geo.computeVertexNormals();
            }
            
            geometriesToMerge.push(geo);
            
            console.log(`  ✅ Mesh ${index + 1} prepared`);
        });
        
        try {
            console.log('🔨 Calling BufferGeometryUtils.mergeGeometries...');
            
            const mergedGeometry = BufferGeometryUtils.mergeGeometries(
                geometriesToMerge,
                false
            );
            
            if (!mergedGeometry) {
                throw new Error('mergeGeometries returned null');
            }
            
            console.log('✅ MERGE SUCCESSFUL!');
            console.log('   Total vertices:', mergedGeometry.attributes.position.count);
            
            mergedGeometry.computeBoundingBox();
            mergedGeometry.computeBoundingSphere();
            
            const mergedMesh = new THREE.Mesh(
                mergedGeometry,
                new THREE.MeshStandardMaterial()
            );
            
            // Cleanup
            geometriesToMerge.forEach(geo => geo.dispose());
            
            return mergedMesh;
            
        } catch (error) {
            console.error('❌ MERGE FAILED:', error.message);
            console.error('⚠️  Falling back to first geometry only');
            return meshes[0];
        }
    }
}

export default OBJLoaderPlugin;
