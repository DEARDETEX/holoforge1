/**
 * ModelLoaderPlugin - Base class for all 3D model loaders
 * 
 * Design Pattern: Abstract Base Class (Template Method Pattern)
 * Purpose: Define contract that all loaders must implement
 * Benefit: Consistent interface, easy testing, swappable implementations
 */

class ModelLoaderPlugin {
    constructor() {
        /**
         * Plugin metadata
         */
        this.name = "";
        this.version = "1.0.0";
        this.supportedFormats = []; // e.g., ['glb', 'gltf']
        this.priority = 100; // Lower = higher priority (for format conflicts)
        
        /**
         * Capabilities (feature detection)
         */
        this.capabilities = {
            supportsMultiMesh: true,
            supportsAnimations: false,
            supportsTextures: true,
            maxFileSize: 100 * 1024 * 1024 // 100MB default
        };
    }
    
    /**
     * Check if this plugin can handle a file extension
     * @param {string} fileExtension - e.g., "glb", "obj"
     * @returns {boolean}
     */
    canHandle(fileExtension) {
        return this.supportedFormats.includes(fileExtension.toLowerCase());
    }
    
    /**
     * Load a 3D model from URL (MUST OVERRIDE)
     * @param {string} url - Model file URL
     * @param {Object} options - Loading options
     * @param {Function} options.onProgress - Progress callback
     * @param {Object} options.config - Additional configuration
     * @returns {Promise<THREE.Object3D>} - Loaded scene
     * @throws {Error} If not implemented by subclass
     */
    async load(url, options = {}) {
        throw new Error(`Plugin "${this.name}" must implement load() method`);
    }
    
    /**
     * Pre-process file before loading (OPTIONAL HOOK)
     * Use case: Validate file, compress, or modify before loading
     * @param {File} file - Original file object
     * @returns {Promise<File>} - Processed file
     */
    async preProcess(file) {
        console.log(`[${this.name}] Pre-processing: ${file.name}`);
        
        // Validate file size
        if (file.size > this.capabilities.maxFileSize) {
            throw new Error(
                `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. ` +
                `Max allowed: ${(this.capabilities.maxFileSize / 1024 / 1024).toFixed(2)}MB`
            );
        }
        
        return file;
    }
    
    /**
     * Post-process loaded scene (OPTIONAL HOOK)
     * Use case: Apply multi-mesh optimization, center model, etc.
     * @param {THREE.Object3D} scene - Loaded scene
     * @param {Object} options - Processing options
     * @returns {Promise<THREE.Object3D>} - Processed scene
     */
    async postProcess(scene, options = {}) {
        console.log(`[${this.name}] Post-processing scene...`);
        
        // Default: just return scene unchanged
        return scene;
    }
    
    /**
     * Get plugin info (for debugging/display)
     * @returns {Object}
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            supportedFormats: this.supportedFormats,
            capabilities: this.capabilities,
            priority: this.priority
        };
    }
    
    /**
     * Validate plugin configuration (called on registration)
     * @throws {Error} If plugin is misconfigured
     */
    validate() {
        if (!this.name) {
            throw new Error("Plugin must have a name");
        }
        
        if (!this.supportedFormats || this.supportedFormats.length === 0) {
            throw new Error(`Plugin "${this.name}" must support at least one format`);
        }
        
        console.log(`✅ Plugin validated: ${this.name} (${this.supportedFormats.join(', ')})`);
    }
}

export default ModelLoaderPlugin;
