/**
 * Liquid Glass Effect for MagicMirror
 * Implements Apple-style liquid glass visual effects using CSS and SVG filters
 * Compatible with vanilla JavaScript and existing MagicMirror architecture
 */

class LiquidGlass {
    constructor() {
        this.isInitialized = false;
        this.modules = [];
        this.mousePosition = { x: 0, y: 0 };
        this.animationFrame = null;
        this.browserSupport = this.detectBrowserSupport();

        // Configuration
        this.config = {
            distortionScale: 50,
            blurAmount: 12,
            noiseFrequency: 0.008,
            elasticity: 0.15,
            enableMouseTracking: true,
            enableDistortion: true
        };
    }

    /**
     * Detect browser support for liquid glass features
     */
    detectBrowserSupport() {
        const support = {
            backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
            svgFilters: !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect,
            transforms: CSS.supports('transform', 'translateZ(0)'),
            animations: CSS.supports('animation', 'none')
        };

        support.fullSupport = support.backdropFilter && support.svgFilters && support.transforms;

        return support;
    }

    /**
     * Initialize the liquid glass effect system
     */
    init() {
        if (this.isInitialized) return;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * Setup the liquid glass effect
     */
    setup() {
        this.createSVGFilter();
        this.bindEvents();
        this.findModules();
        this.applyEffects();
        this.isInitialized = true;

        // Emit ready event for configuration system
        document.dispatchEvent(new CustomEvent('liquidGlassReady'));

        console.log('Liquid Glass effects initialized');
    }

    /**
     * Create SVG filter for distortion effects
     */
    createSVGFilter() {
        // Check if filter already exists
        if (document.getElementById('liquid-glass-distortion')) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.display = 'none';
        svg.innerHTML = `
            <defs>
                <filter id="liquid-glass-distortion" x="0%" y="0%" width="100%" height="100%">
                    <feTurbulence 
                        type="fractalNoise" 
                        baseFrequency="${this.config.noiseFrequency} ${this.config.noiseFrequency}" 
                        numOctaves="3" 
                        seed="42" 
                        result="noise" />
                    <feGaussianBlur 
                        in="noise" 
                        stdDeviation="2" 
                        result="blurred" />
                    <feDisplacementMap 
                        in="SourceGraphic" 
                        in2="blurred" 
                        scale="${this.config.distortionScale}" 
                        xChannelSelector="R" 
                        yChannelSelector="G" />
                </filter>
                
                <filter id="liquid-glass-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/> 
                    </feMerge>
                </filter>
            </defs>
        `;
        
        document.body.appendChild(svg);
    }

    /**
     * Bind mouse and touch events for interactive effects
     */
    bindEvents() {
        if (!this.config.enableMouseTracking) return;

        const updateMousePosition = (e) => {
            this.mousePosition.x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            this.mousePosition.y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            this.updateDistortion();
        };

        document.addEventListener('mousemove', updateMousePosition);
        document.addEventListener('touchmove', updateMousePosition);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.findModules();
            this.applyEffects();
        });
    }

    /**
     * Find all modules that should have liquid glass effects
     */
    findModules() {
        this.modules = Array.from(document.querySelectorAll('.module.clock, .module.weather, .module.MMM-MQTT'));
    }

    /**
     * Apply liquid glass effects to modules
     */
    applyEffects() {
        this.modules.forEach(module => {
            this.enhanceModule(module);
        });

        // Force a repaint to ensure effects are visible
        this.forceRepaint();
    }

    /**
     * Force a repaint to ensure backdrop filters are visible
     */
    forceRepaint() {
        // Temporarily modify body to trigger repaint
        const body = document.body;
        const originalTransform = body.style.transform;
        body.style.transform = 'translateZ(0)';

        requestAnimationFrame(() => {
            body.style.transform = originalTransform;
        });
    }

    /**
     * Enhance a single module with liquid glass effects
     */
    enhanceModule(module) {
        // Add liquid glass class if not already present
        if (!module.classList.contains('liquid-glass-enhanced')) {
            module.classList.add('liquid-glass-enhanced');

            // Force a reflow to ensure CSS is applied
            module.offsetHeight;

            // Create specular highlight element
            const specular = document.createElement('div');
            specular.className = 'liquid-glass-specular';
            module.appendChild(specular);

            // Add hover effects
            this.addHoverEffects(module);

            // Ensure backdrop filter is immediately visible
            this.ensureBackdropFilter(module);
        }
    }

    /**
     * Ensure backdrop filter is properly applied
     */
    ensureBackdropFilter(module) {
        // Force backdrop filter application by temporarily modifying the element
        const originalTransform = module.style.transform;
        module.style.transform = 'translateZ(0)';

        // Reset after a frame
        requestAnimationFrame(() => {
            module.style.transform = originalTransform;
        });
    }

    /**
     * Add interactive hover effects
     */
    addHoverEffects(module) {
        let hoverTimeout;

        module.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            module.style.transform = 'translateY(-3px) scale(1.02)';
            // Add glow effect only to the module, distortion stays on ::before
            module.style.filter = 'url(#liquid-glass-glow)';
        });

        module.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => {
                module.style.transform = '';
                // Remove glow effect, distortion remains on ::before via CSS
                module.style.filter = '';
            }, 150);
        });
    }

    /**
     * Update distortion based on mouse position
     */
    updateDistortion() {
        if (!this.config.enableDistortion) return;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.animationFrame = requestAnimationFrame(() => {
            const { x, y } = this.mousePosition;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            // Calculate distance from center (normalized)
            const distanceX = (x - centerX) / centerX;
            const distanceY = (y - centerY) / centerY;
            
            // Apply elastic distortion
            const elasticX = distanceX * this.config.elasticity;
            const elasticY = distanceY * this.config.elasticity;
            
            // Update SVG filter parameters
            const filter = document.getElementById('liquid-glass-distortion');
            if (filter) {
                const turbulence = filter.querySelector('feTurbulence');
                const displacement = filter.querySelector('feDisplacementMap');
                
                if (turbulence && displacement) {
                    // Adjust noise frequency based on mouse position
                    const frequency = this.config.noiseFrequency + (Math.abs(elasticX) + Math.abs(elasticY)) * 0.002;
                    turbulence.setAttribute('baseFrequency', `${frequency} ${frequency}`);
                    
                    // Adjust displacement scale
                    const scale = this.config.distortionScale + (Math.abs(elasticX) + Math.abs(elasticY)) * 20;
                    displacement.setAttribute('scale', scale);
                }
            }
        });
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Recreate SVG filter with new parameters
        const existingFilter = document.getElementById('liquid-glass-distortion');
        if (existingFilter) {
            existingFilter.parentNode.removeChild(existingFilter.parentNode);
        }
        this.createSVGFilter();
    }

    /**
     * Enable/disable effects
     */
    toggle(enabled = true) {
        this.modules.forEach(module => {
            if (enabled) {
                module.classList.add('liquid-glass-enhanced');
            } else {
                module.classList.remove('liquid-glass-enhanced');
                module.style.transform = '';
                module.style.filter = '';
            }
        });
    }

    /**
     * Refresh effects (useful when new modules are added)
     */
    refresh() {
        this.findModules();
        this.applyEffects();
    }
}

// Initialize liquid glass effects when script loads
const liquidGlass = new LiquidGlass();

// Auto-initialize
liquidGlass.init();

// Make available globally for manual control
window.LiquidGlass = liquidGlass;

// Refresh effects when new modules are loaded
document.addEventListener('DOMNodeInserted', () => {
    setTimeout(() => liquidGlass.refresh(), 100);
});
