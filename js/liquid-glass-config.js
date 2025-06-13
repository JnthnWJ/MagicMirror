/**
 * Liquid Glass Configuration
 * Customize the liquid glass effects for your MagicMirror
 */

window.LiquidGlassConfig = {
    // Enable/disable the entire liquid glass system
    enabled: true,
    
    // Visual effect settings
    effects: {
        // Backdrop blur intensity (0-20px recommended)
        blurAmount: 12,
        
        // Distortion effect strength (0-100)
        distortionScale: 50,
        
        // Noise frequency for organic texture (0.001-0.02)
        noiseFrequency: 0.008,
        
        // Glass transparency (0-1)
        glassOpacity: 0.15,
        
        // Highlight intensity (0-1)
        highlightIntensity: 0.4,
        
        // Border radius (0-50px)
        borderRadius: 20,
        
        // Shadow intensity (0-1)
        shadowIntensity: 0.3
    },
    
    // Interactive behavior
    interaction: {
        // Enable mouse tracking for dynamic distortion
        enableMouseTracking: false,

        // Elasticity of mouse-based distortion (0-1)
        elasticity: 0.15,

        // Enable hover effects
        enableHoverEffects: false,

        // Hover lift distance (0-10px)
        hoverLift: 3,

        // Hover scale factor (1.0-1.1)
        hoverScale: 1.02
    },

    // Animation settings
    animation: {
        // Enable shimmer animation
        enableShimmer: false,

        // Shimmer duration in seconds
        shimmerDuration: 8,

        // Enable border pulse animation
        enableBorderPulse: false,

        // Border pulse duration in seconds
        borderPulseDuration: 6,

        // Transition timing function
        timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',

        // Transition duration in milliseconds
        transitionDuration: 300
    },
    
    // Module-specific settings
    modules: {
        // Apply effects to these module types
        targetModules: ['.module.clock', '.module.weather', '.module.MMM-MQTT', '.MMM-Wallpaper .info-container'],
        
        // Module-specific overrides
        overrides: {
            '.module.clock': {
                borderRadius: 25,
                glassOpacity: 0.2
            },
            '.module.weather': {
                borderRadius: 20,
                distortionScale: 40
            },
            '.module.MMM-MQTT': {
                borderRadius: 15,
                highlightIntensity: 0.3
            },
            '.MMM-Wallpaper .info-container': {
                borderRadius: 15,
                glassOpacity: 0.2,
                distortionScale: 30,
                highlightIntensity: 0.4
            }
        }
    },
    
    // Performance settings
    performance: {
        // Use hardware acceleration
        useHardwareAcceleration: true,
        
        // Throttle mouse tracking updates (milliseconds)
        mouseTrackingThrottle: 16, // ~60fps
        
        // Disable effects on low-end devices
        disableOnLowEnd: false,
        
        // Maximum number of modules to enhance
        maxModules: 10
    },
    
    // Browser compatibility
    compatibility: {
        // Fallback for browsers without backdrop-filter support
        fallbackBackground: 'rgba(0, 0, 0, 0.6)',
        
        // Disable SVG filters on unsupported browsers
        disableSVGFiltersOnUnsupported: true,
        
        // Minimum browser versions (for feature detection)
        minVersions: {
            chrome: 76,
            firefox: 70,
            safari: 14,
            edge: 79
        }
    },
    
    // Debug settings
    debug: {
        // Enable console logging
        enableLogging: false,
        
        // Show performance metrics
        showPerformanceMetrics: false,
        
        // Highlight enhanced modules
        highlightEnhancedModules: false
    }
};

/**
 * Apply configuration to liquid glass system
 */
function applyLiquidGlassConfig() {
    if (window.LiquidGlass && window.LiquidGlassConfig.enabled) {
        // Update the liquid glass instance with new configuration
        window.LiquidGlass.updateConfig({
            distortionScale: window.LiquidGlassConfig.effects.distortionScale,
            blurAmount: window.LiquidGlassConfig.effects.blurAmount,
            noiseFrequency: window.LiquidGlassConfig.effects.noiseFrequency,
            elasticity: window.LiquidGlassConfig.interaction.elasticity,
            enableMouseTracking: window.LiquidGlassConfig.interaction.enableMouseTracking,
            enableDistortion: window.LiquidGlassConfig.effects.distortionScale > 0
        });
        
        // Apply CSS custom properties
        const root = document.documentElement;
        root.style.setProperty('--lg-bg-color', `rgba(255, 255, 255, ${window.LiquidGlassConfig.effects.glassOpacity})`);
        root.style.setProperty('--lg-highlight', `rgba(255, 255, 255, ${window.LiquidGlassConfig.effects.highlightIntensity})`);
        root.style.setProperty('--lg-shadow', `rgba(0, 0, 0, ${window.LiquidGlassConfig.effects.shadowIntensity})`);
        
        if (window.LiquidGlassConfig.debug.enableLogging) {
            console.log('Liquid Glass configuration applied:', window.LiquidGlassConfig);
        }
    } else if (!window.LiquidGlassConfig.enabled && window.LiquidGlass) {
        // Disable effects if configuration is disabled
        window.LiquidGlass.toggle(false);
    }
}

// Apply configuration when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLiquidGlassConfig);
} else {
    applyLiquidGlassConfig();
}

// Reapply configuration when liquid glass system is ready
document.addEventListener('liquidGlassReady', applyLiquidGlassConfig);
