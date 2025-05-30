// MMM-Wallpaper.js - Jonathan's Version

Module.register("MMM-Wallpaper", {
  // Default module config
  defaults: {
    source: "bing",
    updateInterval: 60 * 60 * 1000,
    slideInterval: 5 * 60 * 1000,
    maximumEntries: 10,
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
    debugPhotoSelection: false,
    // Rotating photo pool options
    rotatingPools: true,
    poolSize: 1000,
    poolRotationInterval: 2, // Hours between pool rotations
  },

  getStyles: function() {
    return ["MMM-Wallpaper.css"];
  },

  start: function() {
    var self = this;

    self.loadNextImageTimer = null;
    self.imageIndex = -1;
    self.infoString = "";

    self.wrapper = document.createElement("div");
    self.wrapper.className = "MMM-Wallpaper";

    self.content = document.createElement("div");
    self.wrapper.appendChild(self.content);

    self.title = document.createElement("div");
    self.title.className = "title";
    self.content.appendChild(self.title);

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

    if (notification === "WALLPAPERS") {
      console.log(`Received WALLPAPERS notification with ${payload.images.length} images`);
      console.log(`Payload source: ${JSON.stringify(payload.source)}`);
      console.log(`Config source: ${JSON.stringify(self.config.source)}`);
      console.log(`Orientation match: ${payload.orientation === self.getOrientation()}`);

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

      console.log(`Source matches: ${sourceMatches}`);

      if (payload.orientation === self.getOrientation() && sourceMatches) {
        console.log(`Processing ${payload.images.length} images`);
        self.images = payload.images.slice(0, self.config.maximumEntries);
        self.imageIndex = self.imageIndex % (self.images.length || 1);

        if (self.imageElement === null && self.images.length > 0) {
          console.log(`Loading first image: ${self.images[0].url}`);
          self.loadNextImage();
        }
      } else {
        console.log("WALLPAPERS notification ignored due to mismatch");
      }
    } else if (notification === "NEW_INFO_STRING") {
        self.infoString = payload;
        self.updateDom(); // Update the DOM to display the new info string
    }
  },

  getData: function() {
    var self = this;
    var config = Object.assign({}, self.config);

    config.orientation = self.getOrientation();
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
      console.log(`onImageLoaded called for: ${imageData.url}`);

      self.resetLoadImageTimer();

      element.className = `wallpaper ${self.config.crossfade ? "crossfade-image" : ""}`;
      element.style.opacity = 1;
      self.title.style.display = "none";

      console.log(`Image element opacity set to 1, className: ${element.className}`);

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

        console.log(`Image transition completed`);
      }, self.config.crossfade ? 1000 : 0);
    };
  },

  createImage: function(imageData) {
    var self = this;
    var img = document.createElement("img");

    console.log(`Creating image element for: ${imageData.url}`);

    img.style.filter = self.config.filter;
    img.style["object-fit"] = self.config.size;
    img.style.opacity = 0;
    img.onload = self.onImageLoaded(imageData, img);
    img.onerror = function() {
      console.error(`Failed to load image: ${imageData.url}`);
    };

    const imageUrl = self.getImageUrl(imageData);
    console.log(`Setting image src to: ${imageUrl}`);
    img.src = imageUrl;

    // Log EXIF data after image is loaded
    img.addEventListener('load', () => {
      console.log(`Image loaded successfully: ${img.src}`);
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

    // Create a div to hold the info string
    self.infoDiv = document.createElement("div");
    self.infoDiv.className = "info-container";
    self.infoDiv.innerHTML = self.infoString; // Set the info string

    // Append the info div to the wrapper
    self.wrapper.appendChild(self.infoDiv);

    return self.wrapper;
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

  // Enhanced Photo Selection System
  initializePhotoSelection: function() {
    var self = this;

    // Initialize recently shown tracking
    self.recentlyShown = [];
    self.photoWeights = new Map();

    if (self.config.debugPhotoSelection) {
      console.log("Enhanced photo selection system initialized");
      console.log(`Selection method: ${self.config.selectionMethod}`);
      console.log(`Recently shown tracking: ${self.config.recentlyShownTracking}`);
      console.log(`Recently shown count: ${self.config.recentlyShownCount}`);
      console.log(`Recently shown cooldown: ${self.config.recentlyShownCooldown} minutes`);
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

    for (var i = 0; i < self.images.length; i++) {
      var weight = self.calculateImageWeight(i);
      weights.push(weight);
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      // Fallback to pure random if all weights are zero
      return self.selectPureRandom();
    }

    // Select based on weighted probability
    var random = Math.random() * totalWeight;
    var currentWeight = 0;

    for (var i = 0; i < weights.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return i;
      }
    }

    // Fallback (should not reach here)
    return self.images.length - 1;
  },

  calculateImageWeight: function(imageIndex) {
    var self = this;
    var baseWeight = 1.0;

    if (!self.config.recentlyShownTracking) {
      return baseWeight;
    }

    // Check if image was recently shown
    var imageUrl = self.images[imageIndex].url;
    var recentEntry = self.recentlyShown.find(entry => entry.url === imageUrl);

    if (!recentEntry) {
      return baseWeight;
    }

    // Calculate time since last shown (in minutes)
    var timeSinceShown = (Date.now() - recentEntry.timestamp) / (1000 * 60);

    if (timeSinceShown < self.config.recentlyShownCooldown) {
      // Reduce weight for recently shown images
      var cooldownFactor = timeSinceShown / self.config.recentlyShownCooldown;
      return baseWeight * cooldownFactor * 0.1; // Heavily reduce weight
    }

    return baseWeight;
  },

  trackRecentlyShown: function(imageIndex) {
    var self = this;

    if (!self.config.recentlyShownTracking || imageIndex < 0 || imageIndex >= self.images.length) {
      return;
    }

    var imageUrl = self.images[imageIndex].url;
    var timestamp = Date.now();

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
      console.log(`Tracked recently shown: ${imageUrl} (total tracked: ${self.recentlyShown.length})`);
    }
  },

  loadNextImage: function() {
    var self = this;

    console.log(`loadNextImage called. Images available: ${self.images.length}, Current index: ${self.imageIndex}`);

    self.resetLoadImageTimer();

    if (self.nextImageElement !== null) {
      self.nextImageElement.onload = null;
      self.content.removeChild(self.nextImageElement);
      self.nextImageElement = null;
    }

    // Use enhanced photo selection if enabled
    if (self.config.enhancedShuffle) {
      self.imageIndex = self.selectNextImageIndex();
    } else {
      // Fallback to original sequential behavior
      self.imageIndex = (self.imageIndex + 1) % self.images.length;
    }

    const nextImageData = self.images[self.imageIndex];
    console.log(`Loading image ${self.imageIndex + 1}/${self.images.length}: ${nextImageData ? nextImageData.url : 'null'}`);

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

    if (self.nextImageElement !== null) {
      self.nextImageElement.onload = null;
      self.content.removeChild(self.nextImageElement);
      self.nextImageElement = null;
    }

    // Use enhanced photo selection if enabled, otherwise use sequential
    if (self.config.enhancedShuffle) {
      // For previous image with enhanced shuffle, just select a new random image
      self.imageIndex = self.selectNextImageIndex();
    } else {
      // Fallback to original sequential behavior
      self.imageIndex = (self.imageIndex - 1 + self.images.length) % self.images.length;
    }

    const previousImageData = self.images[self.imageIndex];
    if (previousImageData !== null) {
      self.nextImageElement = self.createImage(previousImageData);
      self.content.insertBefore(self.nextImageElement, self.title);
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
