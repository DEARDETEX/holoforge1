/**
 * ═══════════════════════════════════════════════════════
 * ResolutionManager - Intelligent Resolution Handling
 * ═══════════════════════════════════════════════════════
 * 
 * Philosophy: Match capabilities to hardware
 * - Detect GPU capability
 * - Recommend optimal settings
 * - Prevent crashes from over-demanding settings
 * 
 * CTO Insight: "Let users CHOOSE quality, but guide them smartly"
 * 
 * Future-Proof: Ray tracing detection for future Three.js features
 */

class ResolutionManager {
    constructor() {
        this.gpuTier = null;
        this.maxTextureSize = null;
        this.presets = this._initializePresets();
        
        // Detect GPU capabilities
        this._detectGPU();
        
        console.log('✅ ResolutionManager initialized');
        console.log(`   GPU Tier: ${this.gpuTier}`);
        console.log(`   Max Texture Size: ${this.maxTextureSize}px`);
    }
    
    /**
     * Detect GPU capabilities
     * 
     * Uses WebGL to query hardware limits
     */
    _detectGPU() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            console.warn('⚠️  WebGL not available, using conservative settings');
            this.gpuTier = 'low';
            this.maxTextureSize = 2048;
            return;
        }
        
        // Get max texture size (proxy for GPU power)
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        // Get GPU info (if available)
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            console.log(`   GPU: ${renderer}`);
            
            // Classify GPU tier based on renderer string
            this.gpuTier = this._classifyGPU(renderer);
        } else {
            // Fallback: classify based on max texture size
            if (this.maxTextureSize >= 16384) {
                this.gpuTier = 'high';
            } else if (this.maxTextureSize >= 8192) {
                this.gpuTier = 'medium';
            } else {
                this.gpuTier = 'low';
            }
        }
    }
    
    /**
     * Classify GPU based on renderer string
     */
    _classifyGPU(renderer) {
        const rendererLower = renderer.toLowerCase();
        
        // High-end GPUs
        if (
            rendererLower.includes('rtx') ||
            rendererLower.includes('radeon rx 6') ||
            rendererLower.includes('radeon rx 7') ||
            rendererLower.includes('m1 pro') ||
            rendererLower.includes('m1 max') ||
            rendererLower.includes('m2') ||
            rendererLower.includes('m3')
        ) {
            return 'high';
        }
        
        // Medium GPUs
        if (
            rendererLower.includes('gtx') ||
            rendererLower.includes('radeon rx 5') ||
            rendererLower.includes('intel iris') ||
            rendererLower.includes('m1')
        ) {
            return 'medium';
        }
        
        // Low-end GPUs (integrated graphics)
        return 'low';
    }
    
    /**
     * Initialize resolution presets
     */
    _initializePresets() {
        return [
            {
                name: '720p HD',
                width: 1280,
                height: 720,
                tier: 'low',
                pixelRatio: 1,
                antialias: false,
                shadowMapSize: 1024,
                recommended: false
            },
            {
                name: '1080p Full HD',
                width: 1920,
                height: 1080,
                tier: 'low',
                pixelRatio: 1,
                antialias: true,
                shadowMapSize: 2048,
                recommended: true
            },
            {
                name: '1440p 2K',
                width: 2560,
                height: 1440,
                tier: 'medium',
                pixelRatio: 1,
                antialias: true,
                shadowMapSize: 2048,
                recommended: false
            },
            {
                name: '2160p 4K',
                width: 3840,
                height: 2160,
                tier: 'high',
                pixelRatio: 1,
                antialias: true,
                shadowMapSize: 4096,
                recommended: false
            },
            {
                name: '4320p 8K',
                width: 7680,
                height: 4320,
                tier: 'ultra',
                pixelRatio: 1,
                antialias: true,
                shadowMapSize: 4096,
                recommended: false,
                experimental: true
            }
        ];
    }
    
    /**
     * Get available presets based on GPU capability
     */
    getAvailablePresets() {
        const tierOrder = { low: 0, medium: 1, high: 2, ultra: 3 };
        const currentTierValue = tierOrder[this.gpuTier] || 0;
        
        return this.presets.filter(preset => {
            const presetTierValue = tierOrder[preset.tier] || 0;
            return presetTierValue <= currentTierValue + 1;
        });
    }
    
    /**
     * Get recommended preset for current GPU
     */
    getRecommendedPreset() {
        const available = this.getAvailablePresets();
        const tierOrder = { low: 0, medium: 1, high: 2, ultra: 3 };
        const currentTierValue = tierOrder[this.gpuTier] || 0;
        
        const recommended = available
            .filter(p => tierOrder[p.tier] <= currentTierValue)
            .sort((a, b) => b.width - a.width)[0];
        
        return recommended || available[available.length - 1];
    }
    
    /**
     * Get optimal renderer settings for resolution
     */
    getOptimalSettings(resolution) {
        const preset = this.presets.find(
            p => p.width === resolution.width && p.height === resolution.height
        ) || this.getRecommendedPreset();
        
        return {
            width: resolution.width,
            height: resolution.height,
            pixelRatio: preset.pixelRatio,
            antialias: preset.antialias,
            shadowMapSize: preset.shadowMapSize,
            shadowMapEnabled: this.gpuTier !== 'low',
            toneMapping: true,
            physicallyCorrectLights: this.gpuTier === 'high' || this.gpuTier === 'ultra'
        };
    }
    
    /**
     * Validate if resolution is safe for current GPU
     */
    validateResolution(width, height) {
        const totalPixels = width * height;
        const maxSafePixels = {
            low: 1920 * 1080,
            medium: 2560 * 1440,
            high: 3840 * 2160,
            ultra: 7680 * 4320
        };
        
        const maxPixels = maxSafePixels[this.gpuTier] || maxSafePixels.low;
        
        if (totalPixels > maxPixels) {
            return {
                valid: false,
                reason: `Resolution too high for ${this.gpuTier} GPU`,
                recommended: this.getRecommendedPreset()
            };
        }
        
        if (width > this.maxTextureSize || height > this.maxTextureSize) {
            return {
                valid: false,
                reason: `Exceeds GPU texture limit (${this.maxTextureSize}px)`,
                recommended: this.getRecommendedPreset()
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Get performance estimate for resolution
     */
    estimatePerformance(width, height) {
        const validation = this.validateResolution(width, height);
        
        if (!validation.valid) {
            return {
                fps: 0,
                quality: 'unsupported',
                warning: validation.reason
            };
        }
        
        const totalPixels = width * height;
        const basePixels = 1920 * 1080;
        const pixelRatio = totalPixels / basePixels;
        
        const baseFPS = {
            low: 30,
            medium: 60,
            high: 90,
            ultra: 120
        };
        
        const estimatedFPS = Math.round(baseFPS[this.gpuTier] / Math.sqrt(pixelRatio));
        
        return {
            fps: estimatedFPS,
            quality: estimatedFPS >= 30 ? 'smooth' : 'choppy',
            recommendation: estimatedFPS < 30 ? 'Lower resolution recommended' : null
        };
    }
}

export default ResolutionManager;
