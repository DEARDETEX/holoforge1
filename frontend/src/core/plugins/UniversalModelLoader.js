/**
 * UniversalModelLoader - Single interface for all 3D model loading
 * 
 * Design Pattern: Facade Pattern + Strategy Pattern
 * Purpose: Hide complexity, provide simple API
 * Benefit: One method to load ANY format
 */

import PluginRegistry from './PluginRegistry';

class UniversalModelLoader {
    constructor() {
        this.registry = new PluginRegistry();
        this.loadingCache = new Map(); // Cache loaded models
        this.stats = {
            totalLoads: 0,
            successfulLoads: 0,
            failedLoads: 0,
            cacheHits: 0
        };
        
        console.log('═══════════════════════════════════════');
        console.log('🎨 UniversalModelLoader Initialized');
        console.log('═══════════════════════════════════════\n');
    }
    
    /**
     * Setup default plugins (called automatically)
     * NOTE: Actual plugin imports happen in setupDefaultPlugins()
     */
    async setupDefaultPlugins() {
        console.log('📦 Loading default plugins...\n');
        
        // Import plugins dynamically
        const GLBLoaderPlugin = (await import('../loaders/GLBLoaderPlugin')).default;
        const OBJLoaderPlugin = (await import('../loaders/OBJLoaderPlugin')).default;
        
        // Register plugins
        this.registry.register(new GLBLoaderPlugin());
        this.registry.register(new OBJLoaderPlugin());
        
        console.log('✅ Default plugins loaded\n');
        console.log(this.registry.getStats());
    }
    
    /**
     * Load a 3D model (MAIN PUBLIC API)
     * @param {string} url - Model file URL
     * @param {Object} options - Loading options
     * @param {Function} options.onProgress - Progress callback (0-100)
     * @param {boolean} options.useCache - Enable caching (default: true)
     * @param {Object} options.config - Additional config passed to plugin
     * @returns {Promise<THREE.Object3D>}
     */
    async load(url, options = {}) {
        console.log('═══════════════════════════════════════');
        console.log('🎬 UNIVERSAL LOADER - START');
        console.log('═══════════════════════════════════════');
        console.log(`📄 File: ${url}`);
        
        this.stats.totalLoads++;
        
        const startTime = performance.now();
        
        try {
            // Extract file extension
            const extension = this.extractExtension(url);
            console.log(`📦 Detected format: .${extension}`);
            
            // Check cache
            if (options.useCache !== false && this.loadingCache.has(url)) {
                console.log('⚡ Cache hit! Returning cached model');
                this.stats.cacheHits++;
                return this.loadingCache.get(url);
            }
            
            // Get appropriate loader
            const loader = this.registry.getLoader(extension);
            
            if (!loader) {
                throw new Error(
                    `Unsupported file format: .${extension}\n` +
                    `Supported formats: ${this.registry.getSupportedFormats().join(', ')}\n` +
                    `To add support, create a new plugin that extends ModelLoaderPlugin`
                );
            }
            
            console.log(`✅ Using: ${loader.name} (v${loader.version})`);
            console.log(`   Priority: ${loader.priority}`);
            console.log(`   Capabilities:`, loader.capabilities);
            
            // Pre-processing hook (if file object provided)
            if (options.file && loader.preProcess) {
                console.log('🔧 Running pre-processing...');
                await loader.preProcess(options.file);
            }
            
            // Load the model
            console.log('📥 Loading model...');
            
            const scene = await loader.load(url, {
                onProgress: (progress) => {
                    if (options.onProgress) {
                        options.onProgress(progress);
                    }
                    
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total) * 100;
                        console.log(`   Progress: ${percent.toFixed(1)}%`);
                    }
                },
                config: options.config || {}
            });
            
            if (!scene) {
                throw new Error('Loader returned null/undefined scene');
            }
            
            console.log('✅ Model loaded successfully');
            console.log(`   Type: ${scene.type}`);
            console.log(`   Children: ${scene.children.length}`);
            
            // Post-processing hook
            let processedScene = scene;
            
            if (loader.postProcess) {
                console.log('🔧 Running post-processing...');
                processedScene = await loader.postProcess(scene, options.config || {});
            }
            
            // Cache the result
            if (options.useCache !== false) {
                this.loadingCache.set(url, processedScene);
                console.log('💾 Model cached for future use');
            }
            
            const loadTime = performance.now() - startTime;
            console.log('═══════════════════════════════════════');
            console.log('🎉 LOADING COMPLETE');
            console.log(`   Time: ${loadTime.toFixed(2)}ms`);
            console.log('═══════════════════════════════════════\n');
            
            this.stats.successfulLoads++;
            
            return processedScene;
            
        } catch (error) {
            this.stats.failedLoads++;
            
            console.error('═══════════════════════════════════════');
            console.error('❌ LOADING FAILED');
            console.error('═══════════════════════════════════════');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
            console.error('URL:', url);
            console.error('═══════════════════════════════════════\n');
            
            throw error;
        }
    }
    
    /**
     * Extract file extension from URL/path
     * @param {string} url
     * @returns {string}
     */
    extractExtension(url) {
        // Remove query parameters
        const cleanUrl = url.split('?')[0];
        
        // Get extension
        const parts = cleanUrl.split('.');
        const extension = parts[parts.length - 1].toLowerCase();
        
        return extension;
    }
    
    /**
     * Register a new plugin (public API for extensibility)
     * @param {ModelLoaderPlugin} plugin
     */
    registerPlugin(plugin) {
        this.registry.register(plugin);
    }
    
    /**
     * Clear loading cache
     */
    clearCache() {
        this.loadingCache.clear();
        console.log('🗑️  Loading cache cleared');
    }
    
    /**
     * Get loader stats (for monitoring)
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.loadingCache.size,
            successRate: this.stats.totalLoads > 0
                ? ((this.stats.successfulLoads / this.stats.totalLoads) * 100).toFixed(2) + '%'
                : 'N/A',
            registry: this.registry.getStats()
        };
    }
}

export default UniversalModelLoader;
