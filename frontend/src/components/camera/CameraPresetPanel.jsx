/**
 * ═══════════════════════════════════════════════════════
 * CameraPresetPanel - Quick Camera Angle Selection
 * ═══════════════════════════════════════════════════════
 * 
 * Design: Floating panel with icon buttons
 * UX: One-click camera positioning
 */

import React from 'react';
import './CameraPresetPanel.css';

function CameraPresetPanel({ onPresetSelect, currentPreset, disabled }) {
    // Main presets (most commonly used)
    const mainPresets = [
        { key: 'front', icon: '⬅️', name: 'Front' },
        { key: 'side', icon: '↔️', name: 'Side' },
        { key: 'top', icon: '⬇️', name: 'Top' },
        { key: 'angle45', icon: '📐', name: '45°' }
    ];
    
    // Additional presets (expandable)
    const additionalPresets = [
        { key: 'lowAngle', icon: '⬆️', name: 'Low' },
        { key: 'highAngle', icon: '⬇️', name: 'High' },
        { key: 'isometric', icon: '🔷', name: 'Iso' },
        { key: 'closeup', icon: '🔍', name: 'Close' }
    ];
    
    const [showMore, setShowMore] = React.useState(false);
    
    return (
        <div className="camera-preset-panel">
            <div className="panel-header">
                <span className="panel-title">📷 Camera</span>
            </div>
            
            {/* Main presets */}
            <div className="preset-grid">
                {mainPresets.map(preset => (
                    <button
                        key={preset.key}
                        className={`preset-btn ${currentPreset === preset.key ? 'active' : ''}`}
                        onClick={() => onPresetSelect(preset.key)}
                        disabled={disabled}
                        title={preset.name}
                    >
                        <span className="preset-icon">{preset.icon}</span>
                        <span className="preset-name">{preset.name}</span>
                    </button>
                ))}
            </div>
            
            {/* Show more toggle */}
            <button
                className="toggle-more-btn"
                onClick={() => setShowMore(!showMore)}
                disabled={disabled}
            >
                {showMore ? '▲ Less' : '▼ More'}
            </button>
            
            {/* Additional presets */}
            {showMore && (
                <div className="preset-grid additional">
                    {additionalPresets.map(preset => (
                        <button
                            key={preset.key}
                            className={`preset-btn ${currentPreset === preset.key ? 'active' : ''}`}
                            onClick={() => onPresetSelect(preset.key)}
                            disabled={disabled}
                            title={preset.name}
                        >
                            <span className="preset-icon">{preset.icon}</span>
                            <span className="preset-name">{preset.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CameraPresetPanel;
