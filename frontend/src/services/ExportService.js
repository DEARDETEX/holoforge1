/**
 * ═══════════════════════════════════════════════════════
 * ExportService - Production-Grade API Client
 * ═══════════════════════════════════════════════════════
 * 
 * THIS IS THE FOUNDATION LAYER!
 * 
 * Design Pattern: Service Layer (Martin Fowler)
 * Purpose: Isolate API communication from UI logic
 * 
 * Responsibilities:
 * - Communicate with /api/export endpoints
 * - Handle polling for export status
 * - Manage file downloads
 * - Provide capability discovery
 * - Error handling and retry logic
 * 
 * CTO Philosophy: "Service layer = single source of truth for API"
 * 
 * @author Senior Dev Team + CTO Review
 * @version 1.0.0 - Production Ready
 */

class ExportService {
    constructor() {
        // Configuration
        this.config = {
            baseURL: process.env.REACT_APP_BACKEND_URL + '/api/export' || '/api/export',
            timeout: 30000, // 30 seconds
            retryAttempts: 3,
            retryDelay: 1000, // 1 second
            pollInterval: 2000, // 2 seconds
            cacheDuration: 300000 // 5 minutes
        };
        
        // State management
        this.authToken = null;
        this.capabilities = null;
        this.capabilitiesCache = {
            data: null,
            timestamp: null
        };
        
        // Active polling management (prevent memory leaks)
        this.activePolls = new Map(); // jobId -> { intervalId, abortController }
        
        // Metrics (for monitoring/debugging)
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0
        };
        
        console.log('✅ ExportService initialized');
        console.log('   Base URL:', this.config.baseURL);
        console.log('   Retry attempts:', this.config.retryAttempts);
        console.log('   Poll interval:', this.config.pollInterval, 'ms');
    }
    
    // ═══════════════════════════════════════════════════════
    // AUTHENTICATION
    // ═══════════════════════════════════════════════════════
    
    /**
     * Set authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
        console.log('🔐 Auth token set for ExportService');
    }
    
    /**
     * Clear authentication
     */
    clearAuth() {
        this.authToken = null;
        console.log('🔓 Auth token cleared');
    }
    
    /**
     * Get authorization headers
     */
    _getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        return headers;
    }
    
    // ═══════════════════════════════════════════════════════
    // CAPABILITIES (Format Discovery)
    // ═══════════════════════════════════════════════════════
    
    /**
     * Get available export formats and capabilities
     * 
     * CRITICAL: This is what ExportPanel uses to show format options!
     */
    async getCapabilities() {
        // Check cache first
        if (this._isCacheValid()) {
            console.log('📦 Using cached export capabilities');
            return this.capabilitiesCache.data;
        }
        
        console.log('🔍 Fetching export capabilities from backend...');
        
        try {
            const startTime = Date.now();
            
            const response = await this._fetchWithRetry(
                `${this.config.baseURL}/capabilities`,
                {
                    method: 'GET',
                    headers: this._getAuthHeaders()
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const formats = data.formats || {};
            
            // Cache the result
            this.capabilitiesCache = {
                data: formats,
                timestamp: Date.now()
            };
            
            const elapsed = Date.now() - startTime;
            console.log(`✅ Capabilities loaded (${elapsed}ms)`);
            console.log('   Available formats:', Object.keys(formats).join(', '));
            
            return formats;
            
        } catch (error) {
            console.error('❌ Failed to fetch capabilities:', error);
            
            // Graceful degradation: return fallback capabilities
            console.warn('⚠️  Using fallback capabilities');
            const fallback = this._getFallbackCapabilities();
            
            this.capabilitiesCache = {
                data: fallback,
                timestamp: Date.now()
            };
            
            return fallback;
        }
    }
    
    /**
     * Check if capabilities cache is still valid
     */
    _isCacheValid() {
        if (!this.capabilitiesCache.data || !this.capabilitiesCache.timestamp) {
            return false;
        }
        
        const age = Date.now() - this.capabilitiesCache.timestamp;
        return age < this.config.cacheDuration;
    }
    
    /**
     * Get fallback capabilities (when backend unreachable)
     */
    _getFallbackCapabilities() {
        return {
            mp4: {
                name: "MP4 Export",
                supported_qualities: ["medium", "high"],
                max_resolution: [1920, 1080],
                supports_alpha: false
            },
            gif: {
                name: "GIF Export",
                supported_qualities: ["low", "medium"],
                max_resolution: [640, 640],
                supports_alpha: false
            }
        };
    }
    
    /**
     * Clear capabilities cache
     */
    clearCapabilitiesCache() {
        this.capabilitiesCache = {
            data: null,
            timestamp: null
        };
        console.log('🗑️  Capabilities cache cleared');
    }
    
    // ═══════════════════════════════════════════════════════
    // EXPORT OPERATIONS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Start export job
     * 
     * THIS IS THE CORE FUNCTION that useExport hook calls!
     */
    async startExport(options) {
        console.log('═══════════════════════════════════════');
        console.log('📤 Starting Export Request');
        console.log('═══════════════════════════════════════');
        
        const {
            sourceUrl,
            format,
            quality = 'medium',
            resolution = [1920, 1080],
            fps = 30,
            duration = 15.0,
            alphaChannel = false
        } = options;
        
        console.log(`   Source: ${sourceUrl}`);
        console.log(`   Format: ${format}`);
        console.log(`   Quality: ${quality}`);
        console.log(`   Resolution: ${resolution[0]}x${resolution[1]}`);
        
        // Client-side validation
        const validation = this._validateExportOptions(options);
        if (!validation.valid) {
            console.error('❌ Validation failed:', validation.error);
            throw new Error(validation.error);
        }
        
        try {
            const startTime = Date.now();
            this.metrics.totalRequests++;
            
            const response = await this._fetchWithRetry(
                `${this.config.baseURL}/convert`,
                {
                    method: 'POST',
                    headers: this._getAuthHeaders(),
                    body: JSON.stringify({
                        source_url: sourceUrl,
                        format: format,
                        quality: quality,
                        resolution: resolution,
                        fps: fps,
                        duration: duration,
                        alpha_channel: alphaChannel
                    })
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            const elapsed = Date.now() - startTime;
            this.metrics.successfulRequests++;
            this._updateAverageResponseTime(elapsed);
            
            console.log(`✅ Export job created (${elapsed}ms)`);
            console.log(`   Job ID: ${data.job_id}`);
            console.log(`   Estimated time: ${data.estimated_time_seconds}s`);
            console.log('═══════════════════════════════════════\n');
            
            return {
                jobId: data.job_id,
                estimatedTime: data.estimated_time_seconds,
                message: data.message
            };
            
        } catch (error) {
            this.metrics.failedRequests++;
            console.error('❌ Export request failed:', error);
            throw error;
        }
    }
    
    /**
     * Client-side validation (fail fast)
     */
    _validateExportOptions(options) {
        const { sourceUrl, format, resolution, fps, duration } = options;
        
        if (!sourceUrl || sourceUrl.trim() === '') {
            return { valid: false, error: 'Source URL is required' };
        }
        
        const validFormats = ['mp4', 'gif', 'webm_alpha'];
        if (!validFormats.includes(format)) {
            return {
                valid: false,
                error: `Invalid format '${format}'. Must be: ${validFormats.join(', ')}`
            };
        }
        
        if (!Array.isArray(resolution) || resolution.length !== 2) {
            return { valid: false, error: 'Resolution must be [width, height]' };
        }
        
        const [width, height] = resolution;
        
        if (width < 320 || height < 240) {
            return { valid: false, error: 'Resolution too small (minimum 320x240)' };
        }
        
        if (width > 7680 || height > 4320) {
            return { valid: false, error: 'Resolution too large (maximum 8K)' };
        }
        
        if (fps < 10 || fps > 120) {
            return { valid: false, error: 'FPS must be between 10 and 120' };
        }
        
        if (duration < 0.5 || duration > 300) {
            return { valid: false, error: 'Duration must be between 0.5 and 300 seconds' };
        }
        
        return { valid: true };
    }
    
    // ═══════════════════════════════════════════════════════
    // STATUS POLLING
    // ═══════════════════════════════════════════════════════
    
    /**
     * Check export job status
     */
    async checkStatus(jobId) {
        try {
            const response = await this._fetchWithRetry(
                `${this.config.baseURL}/status/${jobId}`,
                {
                    method: 'GET',
                    headers: this._getAuthHeaders()
                }
            );
            
            if (response.status === 404) {
                throw new Error('Export job not found');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                jobId: data.job_id,
                status: data.status,
                progress: data.progress,
                createdAt: new Date(data.created_at),
                completedAt: data.completed_at ? new Date(data.completed_at) : null,
                downloadUrl: data.download_url,
                error: data.error,
                result: data.result
            };
            
        } catch (error) {
            console.error(`❌ Status check failed for job ${jobId}:`, error);
            throw error;
        }
    }
    
    /**
     * Poll status until job completes or fails
     * 
     * THIS IS CRITICAL for useExport hook!
     */
    async pollUntilComplete(jobId, onProgress, pollInterval = this.config.pollInterval) {
        console.log(`🔄 Starting status polling for job ${jobId}`);
        
        const abortController = new AbortController();
        
        return new Promise((resolve, reject) => {
            let pollCount = 0;
            let consecutiveErrors = 0;
            const maxErrors = 5;
            
            const poll = async () => {
                if (abortController.signal.aborted) {
                    console.log(`⏹️  Polling cancelled for job ${jobId}`);
                    reject(new Error('Polling cancelled'));
                    return;
                }
                
                pollCount++;
                
                try {
                    const status = await this.checkStatus(jobId);
                    consecutiveErrors = 0;
                    
                    console.log(`📊 Poll #${pollCount}: ${status.status} (${status.progress}%)`);
                    
                    // Call progress callback
                    if (onProgress) {
                        try {
                            onProgress(status);
                        } catch (callbackError) {
                            console.error('Error in progress callback:', callbackError);
                        }
                    }
                    
                    // Check if complete
                    if (status.status === 'complete') {
                        console.log(`✅ Export complete! Job ${jobId}`);
                        this.stopPolling(jobId);
                        resolve(status);
                        return;
                    }
                    
                    // Check if failed
                    if (status.status === 'failed') {
                        console.error(`❌ Export failed: ${status.error}`);
                        this.stopPolling(jobId);
                        reject(new Error(status.error || 'Export failed'));
                        return;
                    }
                    
                    // Continue polling
                    if (status.status === 'pending' || status.status === 'processing') {
                        const timeoutId = setTimeout(poll, pollInterval);
                        this.activePolls.set(jobId, { timeoutId, abortController });
                    }
                    
                } catch (error) {
                    consecutiveErrors++;
                    console.error(`❌ Polling error #${consecutiveErrors}:`, error);
                    
                    if (consecutiveErrors >= maxErrors) {
                        console.error(`❌ Too many errors, giving up`);
                        this.stopPolling(jobId);
                        reject(new Error(`Polling failed after ${maxErrors} attempts`));
                        return;
                    }
                    
                    // Retry with exponential backoff
                    const backoffDelay = pollInterval * Math.pow(2, consecutiveErrors - 1);
                    const timeoutId = setTimeout(poll, backoffDelay);
                    this.activePolls.set(jobId, { timeoutId, abortController });
                }
            };
            
            poll();
        });
    }
    
    /**
     * Stop polling for a job
     */
    stopPolling(jobId) {
        if (this.activePolls.has(jobId)) {
            const { timeoutId, abortController } = this.activePolls.get(jobId);
            clearTimeout(timeoutId);
            abortController.abort();
            this.activePolls.delete(jobId);
            console.log(`⏹️  Stopped polling for job ${jobId}`);
        }
    }
    
    /**
     * Stop all active polls (CRITICAL for cleanup!)
     */
    stopAllPolling() {
        if (this.activePolls.size > 0) {
            console.log(`⏹️  Stopping ${this.activePolls.size} active polls`);
            
            this.activePolls.forEach(({ timeoutId, abortController }, jobId) => {
                clearTimeout(timeoutId);
                abortController.abort();
            });
            
            this.activePolls.clear();
        }
    }
    
    // ═══════════════════════════════════════════════════════
    // DOWNLOAD
    // ═══════════════════════════════════════════════════════
    
    /**
     * Download exported file
     */
    async downloadFile(jobId, filename) {
        try {
            console.log(`📥 Downloading export: ${jobId}`);
            
            const response = await fetch(
                `${this.config.baseURL}/download/${jobId}`,
                {
                    method: 'GET',
                    headers: this._getAuthHeaders()
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Generate filename if not provided
            if (!filename) {
                const disposition = response.headers.get('Content-Disposition');
                if (disposition && disposition.includes('filename=')) {
                    filename = disposition.split('filename=')[1].split(';')[0].replace(/"/g, '');
                } else {
                    filename = `hologram_${jobId}`;
                }
            }
            
            // Trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
            
            console.log(`✅ Download started: ${filename}`);
            
        } catch (error) {
            console.error(`❌ Download failed:`, error);
            throw error;
        }
    }
    
    // ═══════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Fetch with automatic retry
     */
    async _fetchWithRetry(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    this.config.timeout
                );
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return response;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.config.retryAttempts) {
                    const delay = this.config.retryDelay * attempt;
                    console.warn(`⚠️  Retry ${attempt}/${this.config.retryAttempts} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Update average response time metric
     */
    _updateAverageResponseTime(responseTime) {
        const total = this.metrics.successfulRequests;
        const currentAvg = this.metrics.averageResponseTime;
        this.metrics.averageResponseTime = ((currentAvg * (total - 1)) + responseTime) / total;
    }
    
    /**
     * Get service metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalRequests > 0
                ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
                : 0,
            activePolls: this.activePolls.size
        };
    }
}

// ═══════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════

const exportService = new ExportService();

// Expose globally for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
    window.exportService = exportService;
}

export default exportService;
