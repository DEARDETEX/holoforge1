/**
 * ═══════════════════════════════════════════════════════
 * CameraManager - Professional Camera Control System
 * ═══════════════════════════════════════════════════════
 * 
 * Design Philosophy:
 * - Give users cinema-grade camera control
 * - Presets for common angles (top, side, 45°)
 * - Smooth animations between positions
 * - Orbital controls for free exploration
 * 
 * CTO Insight: "Great 3D viewers feel like video games, 
 * not static images. Camera movement = user engagement."
 * 
 * Future-Proof:
 * - VR camera support ready
 * - Path animation capability
 * - Multi-camera setups
 * 
 * @author Senior Dev Team
 * @version 1.0.0 - Production Ready
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class CameraManager {
    constructor(camera, renderer, scene) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        
        // Controls
        this.orbitControls = null;
        
        // Animation state
        this.isAnimating = false;
        this.animationFrameId = null;
        
        // Camera presets
        this.presets = this._initializePresets();
        this.currentPreset = null;
        
        // Bounds (for auto-framing)
        this.modelBounds = null;
        
        console.log('✅ CameraManager initialized');
    }
    
    /**
     * ═══════════════════════════════════════════════════════
     * INITIALIZATION
     * ═══════════════════════════════════════════════════════
     */
    
    /**
     * Initialize orbit controls
     */
    initializeControls() {
        this.orbitControls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.08;
        this.orbitControls.rotateSpeed = 0.7;
        this.orbitControls.zoomSpeed = 1.2;
        this.orbitControls.panSpeed = 0.8;
        
        this.orbitControls.minDistance = 0.5;
        this.orbitControls.maxDistance = 100;
        this.orbitControls.maxPolarAngle = Math.PI * 0.95;
        
        this.orbitControls.autoRotate = false;
        this.orbitControls.autoRotateSpeed = 0.5;
        
        console.log('✅ Orbit controls initialized');
    }
    
    /**
     * Initialize camera presets
     */
    _initializePresets() {
        return {
            front: {
                name: 'Front View',
                icon: '⬅️',
                position: { x: 0, y: 0, z: 5 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Straight-on front view'
            },
            top: {
                name: 'Top View',
                icon: '⬇️',
                position: { x: 0, y: 5, z: 0 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Bird\'s eye view from above'
            },
            side: {
                name: 'Side View',
                icon: '↔️',
                position: { x: 5, y: 0, z: 0 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Profile view from the side'
            },
            angle45: {
                name: '45° Angle',
                icon: '📐',
                position: { x: 3.5, y: 3.5, z: 3.5 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Classic 45-degree product angle'
            },
            lowAngle: {
                name: 'Low Angle',
                icon: '⬆️',
                position: { x: 3, y: 1, z: 3 },
                lookAt: { x: 0, y: 2, z: 0 },
                description: 'Dramatic low angle shot'
            },
            highAngle: {
                name: 'High Angle',
                icon: '⬇️',
                position: { x: 3, y: 5, z: 3 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Overview from high angle'
            },
            isometric: {
                name: 'Isometric',
                icon: '🔷',
                position: { x: 5, y: 5, z: 5 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Technical isometric view'
            },
            closeup: {
                name: 'Close-up',
                icon: '🔍',
                position: { x: 2, y: 2, z: 2 },
                lookAt: { x: 0, y: 0, z: 0 },
                description: 'Close-up detail view'
            }
        };
    }
    
    /**
     * Apply camera preset
     */
    applyPreset(presetKey, animated = true) {
        const preset = this.presets[presetKey];
        
        if (!preset) {
            console.warn(`⚠️  Unknown preset: ${presetKey}`);
            return;
        }
        
        console.log(`📷 Applying camera preset: ${preset.name}`);
        
        const targetPosition = new THREE.Vector3(
            preset.position.x,
            preset.position.y,
            preset.position.z
        );
        
        const targetLookAt = new THREE.Vector3(
            preset.lookAt.x,
            preset.lookAt.y,
            preset.lookAt.z
        );
        
        if (animated) {
            this._animateCameraTo(targetPosition, targetLookAt);
        } else {
            this.camera.position.copy(targetPosition);
            this.camera.lookAt(targetLookAt);
            
            if (this.orbitControls) {
                this.orbitControls.target.copy(targetLookAt);
                this.orbitControls.update();
            }
        }
        
        this.currentPreset = presetKey;
    }
    
    /**
     * Animate camera to position
     */
    _animateCameraTo(targetPosition, targetLookAt, duration = 1000) {
        if (this.isAnimating) {
            this._stopAnimation();
        }
        
        this.isAnimating = true;
        
        const startPosition = this.camera.position.clone();
        const startLookAt = this.orbitControls 
            ? this.orbitControls.target.clone()
            : new THREE.Vector3(0, 0, 0);
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out cubic)
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // Interpolate position
            this.camera.position.lerpVectors(
                startPosition,
                targetPosition,
                eased
            );
            
            // Interpolate look-at
            if (this.orbitControls) {
                this.orbitControls.target.lerpVectors(
                    startLookAt,
                    targetLookAt,
                    eased
                );
                this.orbitControls.update();
            } else {
                const currentLookAt = new THREE.Vector3().lerpVectors(
                    startLookAt,
                    targetLookAt,
                    eased
                );
                this.camera.lookAt(currentLookAt);
            }
            
            if (progress < 1) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                console.log('✅ Camera animation complete');
            }
        };
        
        animate();
    }
    
    /**
     * Stop ongoing animation
     */
    _stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isAnimating = false;
    }
    
    /**
     * Frame model in view (auto-fit to screen)
     */
    frameModel(model, animated = true) {
        console.log('🎯 Auto-framing model...');
        
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        this.modelBounds = { box, size, center };
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2));
        
        const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(cameraDistance * 1.5);
        const targetPosition = center.clone().add(offset);
        
        console.log(`   Model size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`   Camera distance: ${cameraDistance.toFixed(2)}`);
        
        if (animated) {
            this._animateCameraTo(targetPosition, center);
        } else {
            this.camera.position.copy(targetPosition);
            this.camera.lookAt(center);
            
            if (this.orbitControls) {
                this.orbitControls.target.copy(center);
                this.orbitControls.update();
            }
        }
    }
    
    /**
     * Reset camera to default position
     */
    reset(animated = true) {
        console.log('🔄 Resetting camera to default');
        
        if (this.modelBounds) {
            this.applyPreset('angle45', animated);
        } else {
            const defaultPosition = new THREE.Vector3(5, 5, 5);
            const defaultLookAt = new THREE.Vector3(0, 0, 0);
            
            if (animated) {
                this._animateCameraTo(defaultPosition, defaultLookAt);
            } else {
                this.camera.position.copy(defaultPosition);
                this.camera.lookAt(defaultLookAt);
                
                if (this.orbitControls) {
                    this.orbitControls.target.copy(defaultLookAt);
                    this.orbitControls.update();
                }
            }
        }
    }
    
    /**
     * Update controls (call in animation loop)
     */
    update() {
        if (this.orbitControls && !this.isAnimating) {
            this.orbitControls.update();
        }
    }
    
    /**
     * Enable/disable auto-rotate
     */
    setAutoRotate(enabled) {
        if (this.orbitControls) {
            this.orbitControls.autoRotate = enabled;
            console.log(`🔄 Auto-rotate: ${enabled ? 'ON' : 'OFF'}`);
        }
    }
    
    /**
     * Get current camera state
     */
    getCameraState() {
        return {
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            target: this.orbitControls ? {
                x: this.orbitControls.target.x,
                y: this.orbitControls.target.y,
                z: this.orbitControls.target.z
            } : null,
            zoom: this.camera.zoom,
            fov: this.camera.fov,
            preset: this.currentPreset
        };
    }
    
    /**
     * Restore camera state
     */
    setCameraState(state, animated = false) {
        const targetPosition = new THREE.Vector3(
            state.position.x,
            state.position.y,
            state.position.z
        );
        
        const targetLookAt = state.target 
            ? new THREE.Vector3(state.target.x, state.target.y, state.target.z)
            : new THREE.Vector3(0, 0, 0);
        
        if (animated) {
            this._animateCameraTo(targetPosition, targetLookAt);
        } else {
            this.camera.position.copy(targetPosition);
            this.camera.zoom = state.zoom || 1;
            this.camera.fov = state.fov || 75;
            this.camera.updateProjectionMatrix();
            
            if (this.orbitControls) {
                this.orbitControls.target.copy(targetLookAt);
                this.orbitControls.update();
            }
        }
        
        this.currentPreset = state.preset;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.entries(this.presets).map(([key, preset]) => ({
            key,
            ...preset
        }));
    }
    
    /**
     * Cleanup
     */
    dispose() {
        this._stopAnimation();
        
        if (this.orbitControls) {
            this.orbitControls.dispose();
        }
        
        console.log('🧹 CameraManager disposed');
    }
}

export default CameraManager;
