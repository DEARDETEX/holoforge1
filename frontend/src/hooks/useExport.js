/**
 * ═══════════════════════════════════════════════════════
 * useExport - Production-Grade Export Hook
 * ═══════════════════════════════════════════════════════
 * 
 * Design Pattern: Custom Hook (React Best Practice)
 * Purpose: Encapsulate all export state and logic
 * 
 * Why Hooks?
 * ✅ Reusable across components
 * ✅ Testable in isolation
 * ✅ Handles lifecycle automatically
 * ✅ Prevents memory leaks
 * ✅ Clean component code
 * 
 * Usage Example:
 *   const { startExport, status, progress, download } = useExport();
 *   
 *   <button onClick={() => startExport(options)}>
 *     Export
 *   </button>
 * 
 * Future Extensions:
 * 📅 2025: Add batch export (multiple sources)
 * 📅 2026: Add export queue (background processing)
 * 📅 2027: Add export templates (save settings)
 * 
 * @author Senior Dev Team + CTO Review
 * @version 1.0.0 - Production Ready
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import exportService from '../services/ExportService';

function useExport() {
    // ═══════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════
    
    // Export state
    const [isExporting, setIsExporting] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, exporting, complete, failed
    const [progress, setProgress] = useState(0);
    const [estimatedTime, setEstimatedTime] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    
    // Capabilities (what formats are available)
    const [capabilities, setCapabilities] = useState(null);
    const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
    const [capabilitiesError, setCapabilitiesError] = useState(null);
    
    // Lifecycle management (prevent memory leaks)
    const isMounted = useRef(true);
    const abortController = useRef(null);
    
    // ═══════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Component mount: Load capabilities
     * Component unmount: Cleanup polling
     */
    useEffect(() => {
        console.log('🎣 useExport hook mounted');
        
        // Load capabilities on mount - directly call async function
        const initCapabilities = async () => {
            setCapabilitiesLoading(true);
            try {
                console.log('🔍 Loading export capabilities...');
                const caps = await exportService.getCapabilities();
                
                if (isMounted.current) {
                    setCapabilities(caps);
                    console.log('✅ Capabilities loaded');
                    console.log('   Formats:', Object.keys(caps).join(', '));
                }
            } catch (error) {
                console.error('❌ Failed to load capabilities:', error);
                
                if (isMounted.current) {
                    setCapabilitiesError(error.message);
                    // Set fallback capabilities
                    setCapabilities({
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
                    });
                }
            } finally {
                if (isMounted.current) {
                    setCapabilitiesLoading(false);
                }
            }
        };
        
        initCapabilities();
        
        // Cleanup on unmount (CRITICAL for production!)
        return () => {
            console.log('🎣 useExport hook unmounting - cleanup');
            isMounted.current = false;
            
            // Stop all polling
            exportService.stopAllPolling();
            
            // Cancel any ongoing requests
            if (abortController.current) {
                abortController.current.abort();
            }
        };
    }, []); // Empty deps = run once on mount
    
    // ═══════════════════════════════════════════════════════
    // CAPABILITIES LOADING
    // ═══════════════════════════════════════════════════════
    
    /**
     * Load available export formats
     * 
     * This discovers what backend supports dynamically
     * Future: Could be personalized per user tier
     */
    const loadCapabilities = useCallback(async () => {
        // If already loading, skip
        if (capabilitiesLoading) {
            console.log('📦 Already loading capabilities, skipping');
            return;
        }
        
        setCapabilitiesLoading(true);
        setCapabilitiesError(null);
        
        try {
            console.log('🔍 Loading export capabilities...');
            
            const caps = await exportService.getCapabilities();
            
            if (isMounted.current) {
                setCapabilities(caps);
                setCapabilitiesLoading(false);
                
                console.log('✅ Capabilities loaded');
                console.log('   Formats:', Object.keys(caps).join(', '));
            }
            
        } catch (error) {
            console.error('❌ Failed to load capabilities:', error);
            
            if (isMounted.current) {
                setCapabilitiesError(error.message);
                setCapabilitiesLoading(false);
                
                // Even on error, set fallback capabilities
                setCapabilities({
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
                });
            }
        }
    }, [capabilitiesLoading]);
    
    /**
     * Reload capabilities (call after backend update)
     */
    const reloadCapabilities = useCallback(() => {
        console.log('🔄 Reloading capabilities...');
        setCapabilities(null);
        exportService.clearCapabilitiesCache();
        loadCapabilities();
    }, [loadCapabilities]);
    
    // ═══════════════════════════════════════════════════════
    // EXPORT OPERATIONS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Start export job
     * 
     * This is the main user action!
     * 
     * @param {Object} options - Export configuration
     * @returns {Promise<Object>} Final status when complete
     */
    const startExport = useCallback(async (options) => {
        console.log('═══════════════════════════════════════');
        console.log('🎬 useExport: Starting export');
        console.log('═══════════════════════════════════════');
        console.log('   Options:', options);
        
        // Reset state for new export
        setIsExporting(true);
        setStatus('exporting');
        setProgress(0);
        setError(null);
        setDownloadUrl(null);
        setResult(null);
        setEstimatedTime(null);
        
        // Create abort controller for cancellation
        abortController.current = new AbortController();
        
        try {
            // Step 1: Start export job on backend
            const { jobId, estimatedTime: estTime } = await exportService.startExport(options);
            
            if (!isMounted.current) {
                console.log('⚠️  Component unmounted, aborting');
                return;
            }
            
            setCurrentJobId(jobId);
            setEstimatedTime(estTime);
            
            console.log(`✅ Export job started: ${jobId}`);
            console.log(`   Estimated time: ${estTime}s`);
            
            // Step 2: Poll for completion with progress updates
            const finalStatus = await exportService.pollUntilComplete(
                jobId,
                (statusUpdate) => {
                    // Progress callback (called every 2 seconds)
                    if (!isMounted.current) return;
                    
                    console.log(`📊 Progress: ${statusUpdate.progress}%`);
                    
                    // Update state with latest status
                    setProgress(statusUpdate.progress);
                    setStatus(statusUpdate.status);
                    
                    // Store result if available
                    if (statusUpdate.result) {
                        setResult(statusUpdate.result);
                    }
                }
            );
            
            if (!isMounted.current) {
                console.log('⚠️  Component unmounted during polling');
                return;
            }
            
            // Step 3: Export complete!
            console.log('✅ Export complete!');
            console.log('   Result:', finalStatus.result);
            
            setStatus('complete');
            setProgress(100);
            setDownloadUrl(finalStatus.downloadUrl);
            setResult(finalStatus.result);
            setIsExporting(false);
            
            console.log('═══════════════════════════════════════\n');
            
            return finalStatus;
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            
            if (!isMounted.current) return;
            
            // Handle cancellation vs actual errors
            if (error.message === 'Polling cancelled') {
                setStatus('cancelled');
                setError('Export cancelled by user');
            } else {
                setStatus('failed');
                setError(error.message);
            }
            
            setIsExporting(false);
            
            throw error;
        }
    }, []);
    
    /**
     * Cancel ongoing export
     * 
     * Stops polling and cleans up
     */
    const cancel = useCallback(() => {
        console.log('❌ Cancelling export...');
        
        if (currentJobId) {
            exportService.stopPolling(currentJobId);
        }
        
        if (abortController.current) {
            abortController.current.abort();
        }
        
        setIsExporting(false);
        setStatus('cancelled');
        setError('Export cancelled by user');
        
        console.log('✅ Export cancelled');
    }, [currentJobId]);
    
    /**
     * Download completed export
     * 
     * @param {string} customFilename - Optional custom filename
     */
    const download = useCallback(async (customFilename) => {
        if (!currentJobId) {
            const errorMsg = 'No export job to download';
            console.error('❌', errorMsg);
            throw new Error(errorMsg);
        }
        
        if (status !== 'complete') {
            const errorMsg = 'Export not complete yet';
            console.error('❌', errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            console.log(`📥 Downloading export: ${currentJobId}`);
            
            await exportService.downloadFile(currentJobId, customFilename);
            
            console.log('✅ Download started');
            
        } catch (error) {
            console.error('❌ Download failed:', error);
            setError(error.message);
            throw error;
        }
    }, [currentJobId, status]);
    
    /**
     * Reset export state
     * 
     * Call this to start a new export
     */
    const reset = useCallback(() => {
        console.log('🔄 Resetting export state');
        
        // Stop any ongoing polling
        if (currentJobId) {
            exportService.stopPolling(currentJobId);
        }
        
        // Reset all state
        setIsExporting(false);
        setCurrentJobId(null);
        setStatus('idle');
        setProgress(0);
        setEstimatedTime(null);
        setDownloadUrl(null);
        setError(null);
        setResult(null);
        
        console.log('✅ State reset');
    }, [currentJobId]);
    
    // ═══════════════════════════════════════════════════════
    // RETURN API
    // ═══════════════════════════════════════════════════════
    
    /**
     * Hook returns everything components need
     * 
     * Clean API - components don't need to know implementation
     */
    return {
        // Export state
        isExporting,
        status,
        progress,
        estimatedTime,
        downloadUrl,
        error,
        result,
        jobId: currentJobId,
        
        // Capabilities state
        capabilities,
        capabilitiesLoading,
        capabilitiesError,
        
        // Actions
        startExport,
        cancel,
        download,
        reset,
        reloadCapabilities,
        
        // Service access (for advanced usage)
        service: exportService
    };
}

export default useExport;
