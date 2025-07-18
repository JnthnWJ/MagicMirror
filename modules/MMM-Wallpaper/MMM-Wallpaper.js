// MMM-Wallpaper.js - Jonathan's Version

Module.register("MMM-Wallpaper", {
  // Default module config
  defaults: {
    source: "bing",
    updateInterval: 60 * 60 * 1000,
    slideInterval: 5 * 60 * 1000,
    maximumEntries: 1000,
    filter: "grayscale(0.5) brightness(0.5)",
    orientation: "auto",
    caption: true,
    crossfade: true,
    maxWidth: Number.MAX_SAFE_INTEGER,
    maxHeight: Number.MAX_SAFE_INTEGER,
    size: "cover",
    shuffle: true,
    addCacheBuster: true,
    userPresenceAction: "none",
    fillRegion: true,
    width: "auto",
    height: "auto",
    fadeEdges: false,
    // Enhanced photo selection options
    enhancedShuffle: true,
    recentlyShownTracking: true,
    recentlyShownCount: 500,
    recentlyShownCooldown: 400,
    selectionMethod: "weighted_random", // "weighted_random", "pure_random", "sequential"
    persistRecentlyShown: false,
    debugPhotoSelection: true,
    // Rotating photo pool options
    rotatingPools: true,
    poolSize: 1000,
    poolRotationInterval: 2, // Hours between pool rotations
    // Intelligent cropping options
    intelligentCropping: true,
    landscapeCroppingMode: "crop", // "crop", "fit", "auto"
    panoramicThreshold: 3.0, // Aspect ratio threshold for panoramic images
    extremeAspectThreshold: 0.3, // Threshold for extremely tall/narrow images
    debugImageCropping: false,
    // Performance optimization options for low-powered devices
    lowPowerMode: false, // Enable aggressive optimizations for low-powered devices
    albumProcessingDelay: 2000, // Delay between processing albums (ms)
    photoChunkSize: 50, // Number of photos to process in each chunk
    chunkProcessingDelay: 100, // Delay between processing chunks (ms)
    maxConcurrentRequests: 1, // Maximum concurrent album requests
    progressiveLoading: true, // Enable progressive loading of photos
  },

  getStyles: function() {
    return ["MMM-Wallpaper.css"];
  },

  start: function() {
    var self = this;

    self.loadNextImageTimer = null;
    self.imageIndex = -1;
    self.infoString = "";
    self.isLoading = false;
    self.loadingProgress = null;
    self.loadingTimeout = null;

    self.wrapper = document.createElement("div");
    self.wrapper.className = "MMM-Wallpaper";

    self.content = document.createElement("div");
    self.wrapper.appendChild(self.content);

    self.title = document.createElement("div");
    self.title.className = "title";
    self.content.appendChild(self.title);

    // Create loading indicator
    self.createLoadingIndicator();

    if (self.config.fadeEdges) {
      self.topGradient = document.createElement("div");
      self.topGradient.className = "top-gradient";
      self.content.appendChild(self.topGradient);

      self.bottomGradient = document.createElement("div");
      self.bottomGradient.className = "bottom-gradient";
      self.content.appendChild(self.bottomGradient);
    }

    if (self.config.fillRegion) {
      self.content.className = "content-fill";
    } else {
      self.content.className = "content";
      self.content.style.width = self.config.width;
      self.content.style.height = self.config.height;
    }

    self.imageElement = null;
    self.nextImageElement = null;

    // Initialize enhanced photo selection system
    self.initializePhotoSelection();

    self.getData();
    self.updateTimer = setInterval(() => self.getData(), self.config.updateInterval);

    // Add keyboard event listener
    document.addEventListener("keydown", function(event) {
      if (event.key === "ArrowLeft") {
        self.loadPreviousImage();
      } else if (event.key === "ArrowRight") {
        self.loadNextImage();
      }
    });
  },

  notificationReceived: function(notification, payload, sender) {
    var self = this;

    if (notification === "MODULE_DOM_CREATED" && self.config.userPresenceAction === "show") {
      self.hide();
    } else if (notification === "LOAD_NEXT_WALLPAPERS") {
      self.loadNextImage();
    } else if (notification === "USER_PRESENCE") {
      if (self.config.userPresenceAction === "show") {
        payload ? self.show() : self.hide();
      } else if (self.config.userPresenceAction === "hide") {
        payload ? self.hide() : self.show();
      }
    } else if (notification === "UPDATE_WALLPAPER_CONFIG") {
      if (payload instanceof String) {
        self.config.source = payload;
      } else {
        Object.assign(self.config, payload);
      }

      clearInterval(self.updateTimer);
      self.getData();
      self.updateTimer = setInterval(() => self.getData(), self.config.updateInterval);
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self = this;

    // Use Log.log to ensure it appears in MagicMirror logs
    Log.log(`🔄 [FRONTEND] Received socket notification: ${notification}`, payload ? Object.keys(payload) : 'no payload');
    console.log(`🔄 [FRONTEND] Received socket notification: ${notification}`, payload ? Object.keys(payload) : 'no payload');

    if (notification === "WALLPAPERS") {
      // Check source matching logic
      var sourceMatches = false;
      if (Array.isArray(self.config.source)) {
        // For multi-album configs, check if payload source is an array or matches any source
        if (Array.isArray(payload.source)) {
          sourceMatches = JSON.stringify(self.config.source.sort()) === JSON.stringify(payload.source.sort());
        } else {
          sourceMatches = self.config.source.includes(payload.source);
        }
      } else {
        sourceMatches = self.config.source === payload.source;
      }

      if (payload.orientation === self.getOrientation() && sourceMatches) {
        if (self.config.debugPhotoSelection) {
          console.log(`📥 Received ${payload.images.length} images from node_helper${payload.isProgressive ? ' (progressive)' : ''}`);
          console.log(`📊 Using maximumEntries: ${self.config.maximumEntries}`);
        }

        // Handle progressive loading
        if (payload.isProgressive) {
          console.log(`🔄 [FRONTEND] Received progressive update, keeping loading indicator visible`);
          // This is a progressive update - merge with existing images
          if (self.images && self.images.length > 0) {
            // Add new images to existing pool, avoiding duplicates
            const existingUrls = new Set(self.images.map(img => img.url));
            const newImages = payload.images.filter(img => !existingUrls.has(img.url));
            self.images = self.images.concat(newImages);

            if (self.config.debugPhotoSelection) {
              console.log(`🔄 Progressive update: Added ${newImages.length} new images, total pool: ${self.images.length}`);
            }
          } else {
            // First progressive batch
            self.images = payload.images.slice(0, self.config.maximumEntries);
            if (self.config.debugPhotoSelection) {
              console.log(`🚀 Progressive start: Initial pool of ${self.images.length} images`);
            }
          }
          // Don't hide loading indicator for progressive updates - wait for LOADING_COMPLETE
        } else {
          // Final complete update
          self.images = payload.images.slice(0, self.config.maximumEntries);
          if (self.config.debugPhotoSelection) {
            console.log(`✅ Final update: Complete pool of ${self.images.length} images`);
          }
        }

        self.imageIndex = self.imageIndex % (self.images.length || 1);

        if (self.config.debugPhotoSelection) {
          console.log(`📋 Current image pool size: ${self.images.length} images`);
        }

        // Start displaying images as soon as we have some
        if (self.imageElement === null && self.images.length > 0) {
          // Only hide loading indicator if this is not a progressive update
          if (!payload.isProgressive) {
            console.log(`🔄 [FRONTEND] Final update received, hiding loading indicator`);
            self.hideLoadingIndicator();
          } else {
            console.log(`🔄 [FRONTEND] Progressive update - starting image display but keeping loading indicator`);
          }
          self.loadNextImage();
        }
      }
    } else if (notification === "NEW_INFO_STRING") {
        self.infoString = payload;
        self.updateDom(); // Update the DOM to display the new info string
    } else if (notification === "LOADING_STARTED") {
        Log.log(`🔄 [FRONTEND] Received LOADING_STARTED:`, payload);
        console.log(`🔄 [FRONTEND] Received LOADING_STARTED:`, payload);
        self.showLoadingIndicator(payload.message || "Loading photos...");
    } else if (notification === "LOADING_PROGRESS") {
        Log.log(`🔄 [FRONTEND] Received LOADING_PROGRESS:`, payload);
        console.log(`🔄 [FRONTEND] Received LOADING_PROGRESS:`, payload);
        self.updateLoadingProgress(payload.message, payload.progress);
    } else if (notification === "LOADING_COMPLETE") {
        Log.log(`🔄 [FRONTEND] Received LOADING_COMPLETE:`, payload);
        console.log(`🔄 [FRONTEND] Received LOADING_COMPLETE:`, payload);
        self.hideLoadingIndicator();
    }
  },

  getData: function() {
    var self = this;
    var config = Object.assign({}, self.config);

    config.orientation = self.getOrientation();

    // Show loading indicator for multi-album configurations
    if (Array.isArray(config.source) && config.source.length > 1 &&
        config.source.every(src => typeof src === 'string' && src.toLowerCase().startsWith("icloud:"))) {
      console.log(`🔄 [FRONTEND] Multi-album config detected, showing loading indicator`);
      self.showLoadingIndicator("Loading photos from albums...");
    } else {
      console.log(`🔄 [FRONTEND] Single album or non-iCloud config, no loading indicator needed`);
    }

    self.sendSocketNotification("FETCH_WALLPAPERS", config);
  },

  getOrientation: function() {
    var self = this;

    if (self.config.orientation === "auto") {
      var viewport = self.getViewport();
      return (viewport.width < viewport.height) ? "vertical" : "horizontal";
    }

    return self.config.orientation;
  },

  onImageLoaded: function(imageData, element) {
    var self = this;

    return () => {
      self.resetLoadImageTimer();

      // Only set className if it wasn't already set by intelligent cropping
      if (!element.className.includes("wallpaper")) {
        element.className = `wallpaper ${self.config.crossfade ? "crossfade-image" : ""}`;
      }
      element.style.opacity = 1;
      self.title.style.display = "none";

      setTimeout(() => {
        var caption = imageData.caption;
        if (self.config.caption && caption) {
          self.title.innerHTML = caption;
          self.title.style.display = "initial";
        }

        if (self.imageElement !== null) {
          self.content.removeChild(self.imageElement);
        }
        self.imageElement = self.nextImageElement;
        self.nextImageElement = null;
      }, self.config.crossfade ? 1000 : 0);
    };
  },

  createImage: function(imageData) {
    var self = this;
    var img = document.createElement("img");

    img.style.filter = self.config.filter;
    img.style.opacity = 0;

    // Set initial object-fit to default, will be updated after image loads
    img.style["object-fit"] = self.config.size;

    img.onload = function() {
      // Apply intelligent cropping after image loads and we have dimensions
      if (self.config.intelligentCropping) {
        var analysis = self.analyzeImageAspectRatio(img.naturalWidth, img.naturalHeight);
        var displayMode = self.determineImageDisplayMode(analysis);

        // Update object-fit based on analysis
        img.style["object-fit"] = displayMode.objectFit;

        // Add appropriate CSS class for additional styling
        img.className = `wallpaper ${displayMode.cssClass} ${self.config.crossfade ? "crossfade-image" : ""}`;

        if (self.config.debugImageCropping) {
          console.log(`🖼️  Applied display mode for ${img.naturalWidth}x${img.naturalHeight} image: ${displayMode.reason}`);
        }
      } else {
        // Use default styling when intelligent cropping is disabled
        img.className = `wallpaper ${self.config.crossfade ? "crossfade-image" : ""}`;
      }

      // Call the original onload handler
      self.onImageLoaded(imageData, img)();
    };

    img.onerror = function() {
      console.error(`Failed to load image: ${imageData.url}`);
    };

    const imageUrl = self.getImageUrl(imageData);
    img.src = imageUrl;

    // Get EXIF data after image is loaded
    img.addEventListener('load', () => {
      self.getExifData(img.src);
    });

    return img;
  },

  getDom: function() {
    const self = this;

    // Clear the previous info div before creating a new one
    if (self.infoDiv) {
      self.wrapper.removeChild(self.infoDiv);
    }

    // Only create and show the info div if there's content to display
    if (self.infoString && self.infoString.trim() !== "") {
      // Create a div to hold the info string
      self.infoDiv = document.createElement("div");
      self.infoDiv.className = "info-container";
      self.infoDiv.innerHTML = self.infoString; // Set the info string

      // Append the info div to the wrapper
      self.wrapper.appendChild(self.infoDiv);
    } else {
      // If no info string, ensure infoDiv is null so it doesn't get displayed
      self.infoDiv = null;
    }

    return self.wrapper;
  },

  createLoadingIndicator: function() {
    var self = this;

    // Create loading container
    self.loadingContainer = document.createElement("div");
    self.loadingContainer.className = "loading-container";
    self.loadingContainer.style.display = "none";

    // Create spinner
    self.loadingSpinner = document.createElement("div");
    self.loadingSpinner.className = "loading-spinner";

    // Create loading text
    self.loadingText = document.createElement("div");
    self.loadingText.className = "loading-text";
    self.loadingText.textContent = "Loading photos...";

    // Create progress text (optional)
    self.loadingProgress = document.createElement("div");
    self.loadingProgress.className = "loading-progress";

    // Assemble loading indicator
    self.loadingContainer.appendChild(self.loadingSpinner);
    self.loadingContainer.appendChild(self.loadingText);
    self.loadingContainer.appendChild(self.loadingProgress);

    // Add to content
    self.content.appendChild(self.loadingContainer);
  },

  showLoadingIndicator: function(message) {
    var self = this;

    if (self.loadingContainer) {
      self.isLoading = true;
      self.loadingText.textContent = message || "Loading photos...";
      self.loadingProgress.textContent = "";
      self.loadingContainer.style.display = "flex";

      // Set a safety timeout to hide the loading indicator if it's been showing too long
      if (self.loadingTimeout) {
        clearTimeout(self.loadingTimeout);
      }
      self.loadingTimeout = setTimeout(() => {
        if (self.isLoading) {
          console.warn("Loading indicator timeout - hiding after 5 minutes");
          self.hideLoadingIndicator();
        }
      }, 300000); // 5 minutes

      Log.log(`🔄 [FRONTEND] Loading indicator shown: ${message}`);
      if (self.config.debugPhotoSelection) {
        console.log(`🔄 Loading indicator shown: ${message}`);
      }
    }
  },

  updateLoadingProgress: function(message, progress) {
    var self = this;

    console.log(`🔄 [FRONTEND] updateLoadingProgress called with message: "${message}", progress: ${progress}, isLoading: ${self.isLoading}`);

    if (self.loadingContainer && self.isLoading) {
      if (message) {
        console.log(`🔄 [FRONTEND] Updating loading text to: "${message}"`);
        self.loadingText.textContent = message;
      }

      if (progress !== undefined && progress !== null) {
        if (typeof progress === 'number') {
          const progressText = `${Math.round(progress)}%`;
          console.log(`🔄 [FRONTEND] Updating progress to: "${progressText}"`);
          self.loadingProgress.textContent = progressText;
        } else {
          console.log(`🔄 [FRONTEND] Updating progress to: "${progress}"`);
          self.loadingProgress.textContent = progress;
        }
      }

      if (self.config.debugPhotoSelection) {
        console.log(`📊 Loading progress updated: ${message} ${progress || ''}`);
      }
    } else {
      console.log(`⚠️ [FRONTEND] Cannot update progress - loadingContainer: ${!!self.loadingContainer}, isLoading: ${self.isLoading}`);
    }
  },

  hideLoadingIndicator: function() {
    var self = this;

    if (self.loadingContainer && self.isLoading) {
      self.isLoading = false;
      self.loadingContainer.style.display = "none";

      // Clear the safety timeout
      if (self.loadingTimeout) {
        clearTimeout(self.loadingTimeout);
        self.loadingTimeout = null;
      }

      Log.log(`🔄 [FRONTEND] Loading indicator hidden`);
      if (self.config.debugPhotoSelection) {
        console.log(`✅ Loading indicator hidden`);
      }
    }
  },

  getViewport: function() {
    var w = window;
    var e = document.documentElement;
    var g = document.body;

    return {
      width: w.innerWidth || e.clientWidth || g.clientWidth,
      height: w.innerHeight || e.clientHeight || g.clientHeight
    };
  },

  getImageUrl: function(image) {
    var viewport = this.getViewport();
    var url = image.url;

    if ("variants" in image) {
      for (var i in image.variants) {
        var variant = image.variants[i];

        if (variant.width > this.config.maxWidth || variant.height > this.config.maxHeight) {
          break;
        }

        url = variant.url;

        if (variant.width >= viewport.width && variant.height >= viewport.height) {
          break;
        }
      }
    }

    return url;
  },

  // Intelligent cropping functions
  analyzeImageAspectRatio: function(imageWidth, imageHeight) {
    var self = this;

    if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
      return {
        aspectRatio: 1.0,
        type: "unknown",
        shouldCrop: false,
        reason: "Invalid dimensions"
      };
    }

    var aspectRatio = imageWidth / imageHeight;
    var viewport = self.getViewport();
    var screenAspectRatio = viewport.width / viewport.height;

    var analysis = {
      aspectRatio: aspectRatio,
      screenAspectRatio: screenAspectRatio,
      imageWidth: imageWidth,
      imageHeight: imageHeight
    };

    // Determine image type and cropping decision
    if (aspectRatio > self.config.panoramicThreshold) {
      // Panoramic image - don't crop to preserve content
      analysis.type = "panoramic";
      analysis.shouldCrop = false;
      analysis.reason = `Panoramic image (${aspectRatio.toFixed(2)} > ${self.config.panoramicThreshold})`;
    } else if (aspectRatio < self.config.extremeAspectThreshold) {
      // Extremely tall/narrow image - don't crop
      analysis.type = "extreme_tall";
      analysis.shouldCrop = false;
      analysis.reason = `Extremely tall image (${aspectRatio.toFixed(2)} < ${self.config.extremeAspectThreshold})`;
    } else if (aspectRatio > 1.0) {
      // Landscape image
      analysis.type = "landscape";
      if (self.config.intelligentCropping && self.config.landscapeCroppingMode === "crop") {
        analysis.shouldCrop = true;
        analysis.reason = "Landscape image with cropping enabled";
      } else if (self.config.landscapeCroppingMode === "auto") {
        // Auto mode: crop if image is significantly wider than screen
        analysis.shouldCrop = aspectRatio > (screenAspectRatio * 1.2);
        analysis.reason = analysis.shouldCrop ?
          `Auto crop: image much wider than screen (${aspectRatio.toFixed(2)} vs ${screenAspectRatio.toFixed(2)})` :
          `Auto fit: image aspect ratio close to screen`;
      } else {
        analysis.shouldCrop = false;
        analysis.reason = "Landscape cropping disabled";
      }
    } else {
      // Portrait or square image - both preserve full content
      analysis.type = aspectRatio === 1.0 ? "square" : "portrait";
      analysis.shouldCrop = false;
      analysis.reason = "Portrait/square image - preserve full content";
    }

    if (self.config.debugImageCropping) {
      console.log(`🖼️  Image analysis:`, analysis);
    }

    return analysis;
  },

  determineImageDisplayMode: function(analysis) {
    var self = this;

    if (!self.config.intelligentCropping) {
      return {
        objectFit: self.config.size,
        cssClass: "wallpaper-default",
        reason: "Intelligent cropping disabled"
      };
    }

    var displayMode = {};

    if (analysis.shouldCrop) {
      displayMode.objectFit = "cover";
      displayMode.cssClass = "wallpaper-crop-landscape";
      displayMode.reason = "Cropping landscape image to fill screen";
    } else {
      switch (analysis.type) {
        case "panoramic":
          displayMode.objectFit = "contain";
          displayMode.cssClass = "wallpaper-fit-panoramic";
          displayMode.reason = "Fitting panoramic image to preserve content";
          break;
        case "extreme_tall":
          displayMode.objectFit = "contain";
          displayMode.cssClass = "wallpaper-fit-extreme";
          displayMode.reason = "Fitting extremely tall image to preserve content";
          break;
        case "portrait":
          displayMode.objectFit = "contain";
          displayMode.cssClass = "wallpaper-fit-portrait";
          displayMode.reason = "Fitting portrait image to preserve content";
          break;
        case "square":
          displayMode.objectFit = "contain";
          displayMode.cssClass = "wallpaper-fit-square";
          displayMode.reason = "Fitting square image to preserve content";
          break;
        default:
          displayMode.objectFit = self.config.size;
          displayMode.cssClass = "wallpaper-default";
          displayMode.reason = "Using default display mode";
      }
    }

    if (self.config.debugImageCropping) {
      console.log(`🎨 Display mode:`, displayMode);
    }

    return displayMode;
  },

  // Enhanced Photo Selection System
  initializePhotoSelection: function() {
    var self = this;

    // Initialize recently shown tracking
    self.recentlyShown = [];
    self.photoWeights = new Map();

    // Initialize navigation history for backward/forward navigation
    self.navigationHistory = [];
    self.navigationIndex = -1;

    if (self.config.debugPhotoSelection) {
      console.log("🚀 Enhanced photo selection system initialized");
      console.log(`📋 Configuration:`);
      console.log(`  - Selection method: ${self.config.selectionMethod}`);
      console.log(`  - Recently shown tracking: ${self.config.recentlyShownTracking}`);
      console.log(`  - Recently shown count: ${self.config.recentlyShownCount}`);
      console.log(`  - Recently shown cooldown: ${self.config.recentlyShownCooldown} minutes`);
      console.log(`  - Maximum entries: ${self.config.maximumEntries}`);
      console.log(`  - Enhanced shuffle: ${self.config.enhancedShuffle}`);
      console.log(`  - Rotating pools: ${self.config.rotatingPools}`);
    }
  },

  selectNextImageIndex: function() {
    var self = this;

    if (!self.images || self.images.length === 0) {
      return -1;
    }

    if (self.images.length === 1) {
      return 0;
    }

    var selectedIndex = -1;

    switch (self.config.selectionMethod) {
      case "pure_random":
        selectedIndex = self.selectPureRandom();
        break;
      case "weighted_random":
        selectedIndex = self.selectWeightedRandom();
        break;
      case "sequential":
        selectedIndex = self.selectSequential();
        break;
      default:
        selectedIndex = self.selectWeightedRandom();
    }

    // Track the selected image
    if (selectedIndex >= 0 && self.config.recentlyShownTracking) {
      self.trackRecentlyShown(selectedIndex);
    }

    if (self.config.debugPhotoSelection) {
      console.log(`Selected image index: ${selectedIndex} (method: ${self.config.selectionMethod})`);
      if (selectedIndex >= 0) {
        console.log(`Selected image URL: ${self.images[selectedIndex].url}`);
      }
    }

    return selectedIndex;
  },

  selectPureRandom: function() {
    var self = this;
    return Math.floor(Math.random() * self.images.length);
  },

  selectSequential: function() {
    var self = this;
    return (self.imageIndex + 1) % self.images.length;
  },

  selectWeightedRandom: function() {
    var self = this;

    // Create weights for all images
    var weights = [];
    var totalWeight = 0;
    var recentlyShownCount = 0;

    if (self.config.debugPhotoSelection) {
      console.log(`🎲 Starting weighted random selection from ${self.images.length} images`);
    }

    for (var i = 0; i < self.images.length; i++) {
      var weight = self.calculateImageWeight(i);
      weights.push(weight);
      totalWeight += weight;

      if (weight < 1.0) {
        recentlyShownCount++;
      }
    }

    if (self.config.debugPhotoSelection) {
      console.log(`📊 Weight summary: ${recentlyShownCount} recently shown images (reduced weight), ${self.images.length - recentlyShownCount} fresh images (full weight)`);
      console.log(`📊 Total weight: ${totalWeight.toFixed(2)}`);
    }

    if (totalWeight === 0) {
      // Fallback to pure random if all weights are zero
      if (self.config.debugPhotoSelection) {
        console.log(`⚠️  All weights are zero, falling back to pure random`);
      }
      return self.selectPureRandom();
    }

    // Select based on weighted probability
    var random = Math.random() * totalWeight;
    var currentWeight = 0;

    if (self.config.debugPhotoSelection) {
      console.log(`🎯 Random target: ${random.toFixed(4)} of ${totalWeight.toFixed(2)}`);
    }

    for (var i = 0; i < weights.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        if (self.config.debugPhotoSelection) {
          console.log(`✅ Selected image ${i} with weight ${weights[i].toFixed(4)} (cumulative: ${currentWeight.toFixed(4)})`);
        }
        return i;
      }
    }

    // Fallback (should not reach here)
    if (self.config.debugPhotoSelection) {
      console.log(`⚠️  Fallback: selecting last image ${self.images.length - 1}`);
    }
    return self.images.length - 1;
  },

  calculateImageWeight: function(imageIndex) {
    var self = this;
    var baseWeight = 1.0;

    if (!self.config.recentlyShownTracking) {
      if (self.config.debugPhotoSelection) {
        console.log(`Image ${imageIndex}: No tracking enabled, weight = ${baseWeight}`);
      }
      return baseWeight;
    }

    // Check if image was recently shown
    var imageUrl = self.images[imageIndex].url;
    var recentEntry = self.recentlyShown.find(entry => entry.url === imageUrl);

    if (!recentEntry) {
      if (self.config.debugPhotoSelection) {
        console.log(`Image ${imageIndex}: Not recently shown, weight = ${baseWeight}`);
      }
      return baseWeight;
    }

    // Calculate time since last shown (in minutes)
    var timeSinceShown = (Date.now() - recentEntry.timestamp) / (1000 * 60);

    if (timeSinceShown < self.config.recentlyShownCooldown) {
      // Reduce weight for recently shown images
      var cooldownFactor = timeSinceShown / self.config.recentlyShownCooldown;
      var reducedWeight = baseWeight * cooldownFactor * 0.1; // Heavily reduce weight

      if (self.config.debugPhotoSelection) {
        console.log(`Image ${imageIndex}: Recently shown ${timeSinceShown.toFixed(1)} min ago (cooldown: ${self.config.recentlyShownCooldown} min), weight reduced from ${baseWeight} to ${reducedWeight.toFixed(4)}`);
      }

      return reducedWeight;
    }

    if (self.config.debugPhotoSelection) {
      console.log(`Image ${imageIndex}: Shown ${timeSinceShown.toFixed(1)} min ago (past cooldown), weight = ${baseWeight}`);
    }

    return baseWeight;
  },

  trackRecentlyShown: function(imageIndex) {
    var self = this;

    if (!self.config.recentlyShownTracking || imageIndex < 0 || imageIndex >= self.images.length) {
      if (self.config.debugPhotoSelection) {
        console.log(`Tracking skipped: recentlyShownTracking=${self.config.recentlyShownTracking}, imageIndex=${imageIndex}, imagesLength=${self.images.length}`);
      }
      return;
    }

    var imageUrl = self.images[imageIndex].url;
    var timestamp = Date.now();

    // Check if this image was already tracked
    var existingEntry = self.recentlyShown.find(entry => entry.url === imageUrl);
    var wasAlreadyTracked = !!existingEntry;

    // Remove existing entry for this image
    self.recentlyShown = self.recentlyShown.filter(entry => entry.url !== imageUrl);

    // Add new entry
    self.recentlyShown.unshift({
      url: imageUrl,
      timestamp: timestamp,
      index: imageIndex
    });

    // Limit the size of recently shown list
    if (self.recentlyShown.length > self.config.recentlyShownCount) {
      self.recentlyShown = self.recentlyShown.slice(0, self.config.recentlyShownCount);
    }

    if (self.config.debugPhotoSelection) {
      var shortUrl = imageUrl.substring(imageUrl.lastIndexOf('/') + 1, imageUrl.lastIndexOf('/') + 20) + '...';
      console.log(`🔄 Tracked image ${imageIndex} (${shortUrl}) - ${wasAlreadyTracked ? 'DUPLICATE' : 'NEW'} - Total tracked: ${self.recentlyShown.length}/${self.config.recentlyShownCount}`);

      if (wasAlreadyTracked) {
        var timeSinceLastShown = (timestamp - existingEntry.timestamp) / (1000 * 60);
        console.log(`⚠️  DUPLICATE DETECTED: Image was shown ${timeSinceLastShown.toFixed(1)} minutes ago (cooldown: ${self.config.recentlyShownCooldown} min)`);
      }
    }
  },

  // Navigation history management for backward/forward navigation
  addToNavigationHistory: function(imageIndex) {
    var self = this;

    if (imageIndex < 0 || imageIndex >= self.images.length) {
      return;
    }

    // If we're not at the end of history (user went back and then forward),
    // remove everything after current position
    if (self.navigationIndex < self.navigationHistory.length - 1) {
      self.navigationHistory = self.navigationHistory.slice(0, self.navigationIndex + 1);
    }

    // Add new entry to history
    self.navigationHistory.push({
      index: imageIndex,
      url: self.images[imageIndex].url,
      timestamp: Date.now()
    });

    // Update navigation index to point to the new entry
    self.navigationIndex = self.navigationHistory.length - 1;

    // Limit history size to prevent memory issues (keep last 100 entries)
    var maxHistorySize = 100;
    if (self.navigationHistory.length > maxHistorySize) {
      var removeCount = self.navigationHistory.length - maxHistorySize;
      self.navigationHistory = self.navigationHistory.slice(removeCount);
      self.navigationIndex -= removeCount;
    }

    if (self.config.debugPhotoSelection) {
      console.log(`Added to navigation history: index ${imageIndex}, history size: ${self.navigationHistory.length}, nav index: ${self.navigationIndex}`);
    }
  },

  getPreviousImageIndex: function() {
    var self = this;

    // Check if we can go back in navigation history
    if (self.navigationIndex > 0) {
      self.navigationIndex--;
      var historyEntry = self.navigationHistory[self.navigationIndex];

      if (self.config.debugPhotoSelection) {
        console.log(`Going back in history to index ${historyEntry.index}, nav index now: ${self.navigationIndex}`);
      }

      return historyEntry.index;
    }

    if (self.config.debugPhotoSelection) {
      console.log("No previous image in navigation history");
    }

    return -1; // No previous image available
  },

  getNextImageIndex: function() {
    var self = this;

    // Check if we can go forward in navigation history
    if (self.navigationIndex < self.navigationHistory.length - 1) {
      self.navigationIndex++;
      var historyEntry = self.navigationHistory[self.navigationIndex];

      if (self.config.debugPhotoSelection) {
        console.log(`Going forward in history to index ${historyEntry.index}, nav index now: ${self.navigationIndex}`);
      }

      return { index: historyEntry.index, isFromHistory: true };
    }

    // If we're at the end of history, select a new image
    var newIndex = self.selectNextImageIndex();
    return { index: newIndex, isFromHistory: false };
  },

  loadNextImage: function() {
    var self = this;

    self.resetLoadImageTimer();

    // Clear metadata immediately when starting to load a new image
    self.infoString = "";
    self.updateDom();

    if (self.nextImageElement !== null) {
      self.nextImageElement.onload = null;
      self.content.removeChild(self.nextImageElement);
      self.nextImageElement = null;
    }

    // Use enhanced photo selection if enabled
    if (self.config.enhancedShuffle) {
      var result = self.getNextImageIndex();
      self.imageIndex = result.index;

      // Only add to navigation history if we selected a new image (not from history)
      if (!result.isFromHistory && self.imageIndex >= 0) {
        self.addToNavigationHistory(self.imageIndex);
      }
    } else {
      // Fallback to original sequential behavior
      self.imageIndex = (self.imageIndex + 1) % self.images.length;
    }

    const nextImageData = self.images[self.imageIndex];

    if (nextImageData !== null) {
      self.nextImageElement = self.createImage(nextImageData);
      self.content.insertBefore(self.nextImageElement, self.title);
    } else {
      console.warn("nextImageData is null");
    }
  },

  // New function to load the previous image
  loadPreviousImage: function() {
    var self = this;

    self.resetLoadImageTimer();

    // Clear metadata immediately when starting to load a new image
    self.infoString = "";
    self.updateDom();

    if (self.nextImageElement !== null) {
      self.nextImageElement.onload = null;
      self.content.removeChild(self.nextImageElement);
      self.nextImageElement = null;
    }

    // Use enhanced photo selection if enabled, otherwise use sequential
    if (self.config.enhancedShuffle) {
      // Try to get previous image from navigation history
      var previousIndex = self.getPreviousImageIndex();
      if (previousIndex >= 0) {
        self.imageIndex = previousIndex;
      } else {
        // No previous image in history, fallback to sequential behavior
        self.imageIndex = (self.imageIndex - 1 + self.images.length) % self.images.length;
      }
    } else {
      // Fallback to original sequential behavior
      self.imageIndex = (self.imageIndex - 1 + self.images.length) % self.images.length;
    }

    const previousImageData = self.images[self.imageIndex];

    if (previousImageData !== null) {
      self.nextImageElement = self.createImage(previousImageData);
      self.content.insertBefore(self.nextImageElement, self.title);
    } else {
      console.warn("previousImageData is null");
    }
  },

  resetLoadImageTimer: function() {
    const self = this;

    if (self.config.slideInterval > 0) {
      clearTimeout(self.loadNextImageTimer);
      self.loadNextImageTimer = setTimeout(() => self.loadNextImage(), self.config.slideInterval);
    }
  },

  getExifData: function(imageUrl) {
    const self = this;
    self.sendSocketNotification("GET_EXIF_DATA", imageUrl);
  },
});
