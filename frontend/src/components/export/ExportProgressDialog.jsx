/**
 * ═══════════════════════════════════════════════════════
 * ExportProgressDialog - Real-Time Export Progress
 * ═══════════════════════════════════════════════════════
 * 
 * Design Philosophy:
 * ✅ Keep users informed (no black box processing)
 * ✅ Show estimated time (manage expectations)
 * ✅ Celebrate success (positive UX)
 * ✅ Handle errors gracefully (clear next steps)
 * 
 * UX Psychology:
 * - Progress bars reduce perceived wait time by 50%
 * - Estimated time remaining reduces anxiety
 * - Success animation creates positive emotion
 * - Clear error messages prevent frustration
 * 
 * Future Extensions:
 * 📅 2025: Add export preview
 * 📅 2026: Add share to social media
 * 📅 2027: Add cloud storage options
 * 
 * @author Senior Frontend Team
 * @version 1.0.0 - Production Ready
 */

import React, { useState, useEffect } from 'react';
import exportService from '../../services/ExportService';
import './ExportProgressDialog.css';

function ExportProgressDialog({
    isOpen,
    onClose,
    status,
    progress,
    format,
    quality,
    downloadUrl,
    error,
    result
}) {
    // ═══════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════
    
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
    
    // ═══════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Track elapsed time during export
     * 
     * Psychology: Showing elapsed time makes users feel progress
     */
    useEffect(() => {
        if (status === 'processing' || status === 'pending') {
            const startTime = Date.now();
            
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                setTimeElapsed(elapsed);
            }, 1000);
            
            return () => clearInterval(interval);
        }
    }, [status]);
    
    /**
     * Estimate time remaining based on progress rate
     * 
     * Formula: remaining_time = (100 - progress) / progress_rate
     */
    useEffect(() => {
        if (status === 'processing' && progress > 0 && progress < 100 && timeElapsed > 0) {
            // Calculate progress rate (% per second)
            const progressRate = progress / timeElapsed;
            
            // Calculate remaining progress
            const remainingProgress = 100 - progress;
            
            // Estimate remaining time
            const estimated = Math.ceil(remainingProgress / progressRate);
            
            setEstimatedTimeRemaining(estimated);
        } else {
            setEstimatedTimeRemaining(null);
        }
    }, [progress, timeElapsed, status]);
    
    // ═══════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Format time display (seconds → human readable)
     */
    const formatTime = (seconds) => {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };
    
    /**
     * Get status icon based on export state
     */
    const getStatusIcon = () => {
        switch (status) {
            case 'pending':
                return '⏳';
            case 'processing':
                return '⚙️';
            case 'complete':
                return '🎉';
            case 'failed':
                return '❌';
            case 'cancelled':
                return '🚫';
            default:
                return '📦';
        }
    };
    
    /**
     * Get status message
     */
    const getStatusMessage = () => {
        switch (status) {
            case 'pending':
                return 'Preparing your export...';
            case 'processing':
                return 'Creating your hologram video...';
            case 'complete':
                return 'Export complete! 🎊';
            case 'failed':
                return 'Export failed';
            case 'cancelled':
                return 'Export cancelled';
            default:
                return 'Initializing...';
        }
    };
    
    /**
     * Handle download button click
     */
    const handleDownload = async () => {
        if (!downloadUrl) return;
        
        try {
            // Extract job ID from download URL
            const jobId = downloadUrl.split('/').pop();
            
            // Generate filename
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `hologram_${format}_${quality}_${timestamp}.${format === 'webm_alpha' ? 'webm' : format}`;
            
            await exportService.downloadFile(jobId, filename);
            
            console.log('✅ Download initiated:', filename);
            
        } catch (error) {
            console.error('❌ Download failed:', error);
            alert(`Download failed: ${error.message}`);
        }
    };
    
    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════
    
    if (!isOpen) return null;
    
    // Can only close when complete or failed
    const canClose = status === 'complete' || status === 'failed' || status === 'cancelled';
    
    return (
        <div 
            className="dialog-overlay" 
            onClick={canClose ? onClose : undefined}
        >
            <div 
                className={`progress-dialog status-${status}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="dialog-header">
                    <div className="status-icon">
                        {getStatusIcon()}
                    </div>
                    <h2 className="dialog-title">
                        {getStatusMessage()}
                    </h2>
                    
                    {canClose && (
                        <button
                            className="close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    )}
                </div>
                
                {/* Export Details */}
                <div className="export-details">
                    <div className="detail-row">
                        <span className="detail-label">Format:</span>
                        <span className="detail-value">
                            {format.toUpperCase()} ({quality})
                        </span>
                    </div>
                    
                    {result && (
                        <>
                            <div className="detail-row">
                                <span className="detail-label">Resolution:</span>
                                <span className="detail-value">
                                    {result.resolution 
                                        ? `${result.resolution[0]} × ${result.resolution[1]}` 
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">File Size:</span>
                                <span className="detail-value">
                                    {result.file_size_mb 
                                        ? `${result.file_size_mb.toFixed(2)} MB` 
                                        : 'N/A'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Progress Bar (during processing) */}
                {(status === 'processing' || status === 'pending') && (
                    <div className="progress-section">
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progress}%` }}
                            >
                                <span className="progress-text">
                                    {progress}%
                                </span>
                            </div>
                        </div>
                        
                        <div className="progress-info">
                            <span className="time-elapsed">
                                Elapsed: {formatTime(timeElapsed)}
                            </span>
                            {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
                                <span className="time-remaining">
                                    ~{formatTime(estimatedTimeRemaining)} remaining
                                </span>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Processing Animation */}
                {status === 'processing' && (
                    <div className="processing-animation">
                        <div className="hologram-spinner"></div>
                        <p className="processing-text">
                            Creating holographic effects...
                        </p>
                    </div>
                )}
                
                {/* Success State */}
                {status === 'complete' && (
                    <div className="success-section">
                        <div className="success-animation">
                            <div className="success-checkmark">✓</div>
                        </div>
                        
                        <p className="success-message">
                            Your hologram video is ready to download!
                        </p>
                        
                        {result && result.export_time_seconds && (
                            <p className="export-time">
                                Completed in {result.export_time_seconds.toFixed(1)} seconds
                            </p>
                        )}
                        
                        <button
                            className="download-btn"
                            onClick={handleDownload}
                        >
                            <span className="icon">📥</span>
                            Download Video
                        </button>
                    </div>
                )}
                
                {/* Error State */}
                {status === 'failed' && (
                    <div className="error-section">
                        <div className="error-icon">⚠️</div>
                        <p className="error-message">
                            {error || 'An unknown error occurred'}
                        </p>
                        
                        <div className="error-actions">
                            <button
                                className="retry-btn"
                                onClick={() => {
                                    onClose();
                                    // Parent component should handle retry
                                }}
                            >
                                Try Again
                            </button>
                            <button
                                className="close-btn-secondary"
                                onClick={onClose}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Cancelled State */}
                {status === 'cancelled' && (
                    <div className="cancelled-section">
                        <div className="cancelled-icon">🚫</div>
                        <p className="cancelled-message">
                            Export was cancelled
                        </p>
                        <button
                            className="close-btn-secondary"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExportProgressDialog;
