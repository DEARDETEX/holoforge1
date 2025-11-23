/**
 * PluginRegistry - Manages all loader plugins
 * 
 * Design Pattern: Registry Pattern + Dependency Injection
 * Purpose: Centralized plugin management, automatic routing
 * Benefit: Single source of truth, easy to extend
 */

import ModelLoaderPlugin from './ModelLoaderPlugin';

class PluginRegistry {
    constructor() {
        // Map: format -> array of plugins (sorted by priority)
        this.plugins = new Map();
        
        // Map: plugin name -> plugin instance (for direct access)
        this.pluginsByName = new Map();
        
        // Plugin lifecycle hooks
        this.hooks = {
            beforeRegister: [],
            afterRegister: [],
            beforeLoad: [],
            afterLoad: []
        };
    }
    
    /**
     * Register a new plugin
     * @param {ModelLoaderPlugin} plugin - Plugin instance
     * @throws {Error} If plugin is invalid
     */
    register(plugin) {
        console.log('═══════════════════════════════════════');
        console.log('📦 Registering Plugin');
        console.log('═══════════════════════════════════════');
        
        // Validate plugin
        if (!(plugin instanceof ModelLoaderPlugin)) {
            throw new Error(
                "Plugin must extend ModelLoaderPlugin base class. " +
                "Check that your plugin inherits correctly."
            );
        }
        
        // Run validation
        plugin.validate();
        
        // Call beforeRegister hooks
        this.hooks.beforeRegister.forEach(hook => hook(plugin));
        
        // Register for each supported format
        plugin.supportedFormats.forEach(format => {
            const formatLower = format.toLowerCase();
            
            if (!this.plugins.has(formatLower)) {
                this.plugins.set(formatLower, []);
            }
            
            this.plugins.get(formatLower).push(plugin);
            
            console.log(`  ✓ Registered: .${formatLower} → ${plugin.name}`);
        });
        
        // Sort by priority (lower number = higher priority)
        plugin.supportedFormats.forEach(format => {
            const formatLower = format.toLowerCase();
            this.plugins.get(formatLower).sort((a, b) => a.priority - b.priority);
        });
        
        // Store by name for direct access
        this.pluginsByName.set(plugin.name, plugin);
        
        // Call afterRegister hooks
        this.hooks.afterRegister.forEach(hook => hook(plugin));
        
        console.log(`✅ Plugin registered successfully: ${plugin.name}`);
        console.log(`   Priority: ${plugin.priority}`);
        console.log(`   Formats: ${plugin.supportedFormats.join(', ')}`);
        console.log('═══════════════════════════════════════\n');
        
        return this; // Chainable
    }
    
    /**
     * Get the best plugin for a file extension
     * @param {string} fileExtension - e.g., "glb"
     * @returns {ModelLoaderPlugin|null}
     */
    getLoader(fileExtension) {
        const formatLower = fileExtension.toLowerCase();
        const loaders = this.plugins.get(formatLower);
        
        if (!loaders || loaders.length === 0) {
            console.warn(`⚠️  No loader found for .${fileExtension} files`);
            return null;
        }
        
        // Return highest priority (first in sorted array)
        const loader = loaders[0];
        console.log(`✅ Selected loader: ${loader.name} for .${fileExtension}`);
        
        return loader;
    }
    
    /**
     * Get plugin by name
     * @param {string} name - Plugin name
     * @returns {ModelLoaderPlugin|null}
     */
    getPluginByName(name) {
        return this.pluginsByName.get(name) || null;
    }
    
    /**
     * Get all loaders for a format (including lower priority)
     * @param {string} fileExtension
     * @returns {Array<ModelLoaderPlugin>}
     */
    getAllLoaders(fileExtension) {
        const formatLower = fileExtension.toLowerCase();
        return this.plugins.get(formatLower) || [];
    }
    
    /**
     * Get all supported formats
     * @returns {Array<string>}
     */
    getSupportedFormats() {
        return Array.from(this.plugins.keys());
    }
    
    /**
     * Get all registered plugins
     * @returns {Array<ModelLoaderPlugin>}
     */
    getAllPlugins() {
        return Array.from(this.pluginsByName.values());
    }
    
    /**
     * Check if format is supported
     * @param {string} fileExtension
     * @returns {boolean}
     */
    isSupported(fileExtension) {
        return this.plugins.has(fileExtension.toLowerCase());
    }
    
    /**
     * Unregister a plugin (for testing or dynamic loading)
     * @param {string} pluginName
     */
    unregister(pluginName) {
        const plugin = this.pluginsByName.get(pluginName);
        
        if (!plugin) {
            console.warn(`⚠️  Plugin not found: ${pluginName}`);
            return;
        }
        
        // Remove from format maps
        plugin.supportedFormats.forEach(format => {
            const formatLower = format.toLowerCase();
            const loaders = this.plugins.get(formatLower);
            
            if (loaders) {
                const filtered = loaders.filter(p => p.name !== pluginName);
                
                if (filtered.length === 0) {
                    this.plugins.delete(formatLower);
                } else {
                    this.plugins.set(formatLower, filtered);
                }
            }
        });
        
        // Remove from name map
        this.pluginsByName.delete(pluginName);
        
        console.log(`✅ Plugin unregistered: ${pluginName}`);
    }
    
    /**
     * Add lifecycle hook
     * @param {string} hookName - beforeRegister, afterRegister, etc.
     * @param {Function} callback
     */
    addHook(hookName, callback) {
        if (!this.hooks[hookName]) {
            throw new Error(`Unknown hook: ${hookName}`);
        }
        
        this.hooks[hookName].push(callback);
    }
    
    /**
     * Get registry stats (for debugging)
     * @returns {Object}
     */
    getStats() {
        return {
            totalPlugins: this.pluginsByName.size,
            supportedFormats: this.getSupportedFormats(),
            pluginsList: this.getAllPlugins().map(p => p.getInfo())
        };
    }
}

export default PluginRegistry;
