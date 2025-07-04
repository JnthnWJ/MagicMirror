"use strict";

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const express = require("express");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const ExifImage = require("exif").ExifImage;
const { v4: uuidv4 } = require('uuid');
if (typeof (fetch) === "undefined") {
  fetch = require("node-fetch");
}

function shuffle(a) {
  var source = a.slice(0);
  var result = [];
  var i, j;

  for (i = a.length; i > 0; --i) {
    j = Math.floor(Math.random() * i);
    result.push(source[j]);
    source[j] = source[i - 1];
  }

  return result;
}

// Enhanced shuffle with seed for reproducible results
function shuffleWithSeed(array, seed) {
  var source = array.slice(0);
  var result = [];

  // Simple seeded random number generator
  function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  for (var i = source.length; i > 0; --i) {
    seed = (seed * 9301 + 49297) % 233280; // Linear congruential generator
    var j = Math.floor(seededRandom(seed) * i);
    result.push(source[j]);
    source[j] = source[i - 1];
  }

  return result;
}

// Get rotating pool based on time and configuration
function getRotatingPool(allPhotos, config) {
  if (!config.rotatingPools || !allPhotos || allPhotos.length === 0) {
    return shuffle(allPhotos).slice(0, config.poolSize || 1000);
  }

  // Calculate which pool we should be showing based on time
  var hoursPerPool = config.poolRotationInterval || 2;
  var millisecondsPerPool = hoursPerPool * 60 * 60 * 1000;
  var poolIndex = Math.floor(Date.now() / millisecondsPerPool);

  // Use pool index as seed for reproducible shuffling
  var shuffledPhotos = shuffleWithSeed(allPhotos, poolIndex);

  // Calculate how many pools we need to cover all photos
  var poolSize = config.poolSize || 1000;
  var totalPools = Math.ceil(allPhotos.length / poolSize);

  // Use modulo to cycle through pools
  var currentPoolIndex = poolIndex % totalPools;
  var startIndex = currentPoolIndex * poolSize;
  var endIndex = Math.min(startIndex + poolSize, shuffledPhotos.length);

  if (config.debugAlbumCombining) {
    console.log(`🔄 Rotating Pool: Using pool ${currentPoolIndex + 1} of ${totalPools} (photos ${startIndex + 1}-${endIndex} from ${allPhotos.length} total)`);
  }

  return shuffledPhotos.slice(startIndex, endIndex);
}

function pick(a) {
  if (Array.isArray(a)) {
    return a[Math.floor(Math.random() * a.length)];
  } else {
    return a;
  }
}

function z(n) {
  return ((0 <= n && n < 10) ? "0" : "") + n;
}

function b62decode(s) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = s.split("").reduce((result, c) => result * 62 + alphabet.indexOf(c), 0);
  if (result.length === 1) {
    result = `0${result}`;
  }
  return result;
}

// US State Abbreviations
const stateAbbreviations = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
    "American Samoa": "AS",
    "Guam": "GU",
    "Northern Mariana Islands": "MP",
    "Puerto Rico": "PR",
    "U.S. Virgin Islands": "VI"
};

module.exports = NodeHelper.create({
  start: function() {
    var self = this;

    self.cache = {};
    self.handlers = {};
    self.chromecast = null;
    self.images = []; // Initialize self.images
  },

  socketNotificationReceived: function(notification, payload) {
    var self = this;

    if (notification === "FETCH_WALLPAPERS") {
      self.fetchWallpapers(payload);
    } else if (notification === "GET_EXIF_DATA") {
        // Ensure self.images is populated before calling getExifData
        if (self.images && self.images.length > 0) {
          self.getExifData(payload);
        }
    }
  },

  fetchWallpapers: function(config) {
    var self = this;

    // Check if source is an array of multiple iCloud albums
    if (Array.isArray(config.source) && config.source.length > 1 &&
        config.source.every(src => typeof src === 'string' && src.toLowerCase().startsWith("icloud:"))) {
      self.fetchMultipleiCloudAlbums(config);
      return;
    }

    // For single sources or non-iCloud arrays, use the original logic
    config.source = pick(config.source);
    const cacheEntry = self.getCacheEntry(config);
    if (config.maximumEntries <= cacheEntry.images.length && Date.now() < cacheEntry.expires) {
      self.images = cacheEntry.images;
      self.sendResult(config);
      return;
    }

    var source = config.source.toLowerCase();
     if (source === "chromecast") {
      if (self.chromecast === null) {
        self.chromecast = JSON.parse(fs.readFileSync(`${__dirname}/chromecast.json`));
      }
      self.cacheResult(config, shuffle(self.chromecast));
    } else if (source.startsWith("icloud:")) {
      const album = config.source.substring(7).trim();
      const partition = b62decode((album[0] === "A") ? album[1] : album.substring(1, 3));
      self.iCloudHost = `p${partition}-sharedstreams.icloud.com`;
      self.iCloudState = "webstream";
      self.request(config, {
        method: "POST",
        url: `https://${self.iCloudHost}/${album}/sharedstreams/webstream`,
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)",
        },
        body: '{"streamCtag":null}',
      });
    } else {
      self.request(config, {
        url: `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${config.maximumEntries}`,
      });
    }
  },

  fetchMultipleiCloudAlbums: function(config) {
    var self = this;

    // Check cache first for the combined albums
    const cacheEntry = self.getCacheEntry(config);
    if (cacheEntry.images.length > 0 && Date.now() < cacheEntry.expires) {
      if (config.debugAlbumCombining) {
        console.log(`💾 Using cached combined collection: ${cacheEntry.images.length} photos`);
      }
      self.sendResult(config);
      return;
    }

    // Performance optimization settings for low-powered devices
    const performanceConfig = {
      albumDelay: config.albumProcessingDelay || 2000, // 2 second delay between albums
      chunkSize: config.photoChunkSize || 50, // Process 50 photos at a time
      chunkDelay: config.chunkProcessingDelay || 100, // 100ms delay between chunks
      maxConcurrentRequests: config.maxConcurrentRequests || 1, // Process albums sequentially
      progressiveLoading: config.progressiveLoading !== false, // Enable by default
      lowPowerMode: config.lowPowerMode || false
    };

    // Adjust settings for low power mode
    if (performanceConfig.lowPowerMode) {
      performanceConfig.albumDelay = Math.max(performanceConfig.albumDelay, 3000);
      performanceConfig.chunkSize = Math.min(performanceConfig.chunkSize, 25);
      performanceConfig.chunkDelay = Math.max(performanceConfig.chunkDelay, 200);
      performanceConfig.maxConcurrentRequests = 1;
    }

    // Track album fetching progress
    self.albumResults = [];
    self.albumsCompleted = 0;
    self.totalAlbums = config.source.length;
    self.currentMultiConfig = config;
    self.performanceConfig = performanceConfig;
    self.currentAlbumIndex = 0;

    // Set a longer timeout for low-powered devices - calculate based on expected processing time
    const estimatedProcessingTime = self.totalAlbums * 60000; // 1 minute per album base time
    const timeoutDuration = Math.max(
      performanceConfig.lowPowerMode ? 300000 : 180000, // Minimum 5 minutes for low power, 3 minutes normal
      estimatedProcessingTime * 2 // Or 2x estimated time, whichever is longer
    );

    if (self.multiAlbumTimeout) {
      clearTimeout(self.multiAlbumTimeout);
    }
    self.multiAlbumTimeout = setTimeout(() => {
      console.log(`⏰ Album processing timeout after ${timeoutDuration/1000}s - combining partial results`);
      // Only combine if we haven't already started cleanup
      if (self.currentMultiConfig) {
        self.combineAlbumResults();
      }
    }, timeoutDuration);

    if (config.debugAlbumCombining) {
      console.log(`🚀 Starting optimized album processing: ${self.totalAlbums} albums`);
      console.log(`⚙️  Performance settings:`, performanceConfig);
    }

    // Send loading started notification
    console.log(`🔄 [LOADING] Sending LOADING_STARTED notification for ${self.totalAlbums} albums`);
    self.sendSocketNotification("LOADING_STARTED", {
      message: `Loading photos from ${self.totalAlbums} album${self.totalAlbums > 1 ? 's' : ''}...`
    });

    // Start sequential album processing
    self.processNextAlbumSequentially();
  },

  processNextAlbumSequentially: function() {
    var self = this;

    console.log(`🔄 [LOADING] processNextAlbumSequentially called - currentAlbumIndex: ${self.currentAlbumIndex}, totalAlbums: ${self.totalAlbums}`);

    if (self.currentAlbumIndex >= self.totalAlbums) {
      // All albums processed
      console.log(`🔄 [LOADING] All albums processed, stopping`);
      return;
    }

    const config = self.currentMultiConfig;
    const albumSource = config.source[self.currentAlbumIndex];
    const albumConfig = Object.assign({}, config);
    albumConfig.source = albumSource;
    albumConfig.albumIndex = self.currentAlbumIndex;

    if (config.debugAlbumCombining) {
      console.log(`📂 Processing album ${self.currentAlbumIndex + 1}/${self.totalAlbums}: ${albumSource}`);
    }

    // Send progress notification when starting to process an album
    // Use a more granular progress calculation: starting = 0.5 steps
    const startProgressPercent = Math.round(((self.currentAlbumIndex + 0.5) / self.totalAlbums) * 100);
    console.log(`🔄 [LOADING] Sending LOADING_PROGRESS notification: Starting album ${self.currentAlbumIndex + 1}/${self.totalAlbums} (${startProgressPercent}%)`);
    self.sendSocketNotification("LOADING_PROGRESS", {
      message: `Processing album ${self.currentAlbumIndex + 1} of ${self.totalAlbums}...`,
      progress: startProgressPercent
    });

    const album = albumSource.substring(7).trim();
    const partition = b62decode((album[0] === "A") ? album[1] : album.substring(1, 3));
    const iCloudHost = `p${partition}-sharedstreams.icloud.com`;

    self.requestMultiAlbum(albumConfig, {
      method: "POST",
      url: `https://${iCloudHost}/${album}/sharedstreams/webstream`,
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)",
      },
      body: '{"streamCtag":null}',
      iCloudHost: iCloudHost,
      album: album
    });
  },

  request: function(config, params) {
    var self = this;

    if (!("headers" in params)) {
      params.headers = {};
    }

    if (!("cache-control" in params.headers)) {
      params.headers["cache-control"] = "no-cache";
    }

    fetch(params.url, params)
      .then((response) => {
        response.text().then((body) => {
          self.processResponse(response, body, config);
        });
      });
  },

  requestMultiAlbum: function(config, params) {
    var self = this;

    if (!("headers" in params)) {
      params.headers = {};
    }

    if (!("cache-control" in params.headers)) {
      params.headers["cache-control"] = "no-cache";
    }

    fetch(params.url, params)
      .then((response) => {
        response.text().then((body) => {
          self.processMultiAlbumResponse(response, body, config, params);
        });
      })
      .catch((error) => {
        console.error(`Error fetching album ${config.albumIndex + 1}:`, error);
        self.handleAlbumComplete(config.albumIndex, []);
      });
  },

  processMultiAlbumResponse: function(response, body, config, params) {
    var self = this;
    var images = [];

    try {
      var source = config.source.toLowerCase();
      if (source.startsWith("icloud:")) {
        images = self.processiCloudDataMulti(response, JSON.parse(body), config, params);
      }
    } catch (error) {
      console.error(`Error processing album ${config.albumIndex + 1}:`, error);
      // Handle error by completing this album with empty results
      self.handleAlbumComplete(config.albumIndex, []);
      return;
    }

    // For asset requests, processiCloudDataMulti now handles completion asynchronously
    // For webstream requests, we still need to handle completion here
    if (!params.isAssetRequest) {
      // This is a webstream request, images will be empty but that's expected
      // The actual completion will happen after the asset request
      if (response.status !== 200) {
        // Error case - complete with empty results
        self.handleAlbumComplete(config.albumIndex, []);
      }
    } else if (images.length > 0) {
      // This is for the case where chunked processing is not used (fallback)
      self.handleAlbumComplete(config.albumIndex, images);
    }
  },

  handleAlbumComplete: function(albumIndex, images) {
    var self = this;
    const config = self.currentMultiConfig;

    // Check if we've already timed out and cleaned up
    if (!config) {
      console.log(`⚠️  Album ${albumIndex + 1} completed after timeout - ignoring results`);
      return;
    }

    // Store the results for this album
    self.albumResults[albumIndex] = images;
    self.albumsCompleted++;

    if (config.debugAlbumCombining) {
      console.log(`✅ Album ${albumIndex + 1} complete: ${images.length} photos (${self.albumsCompleted}/${self.totalAlbums} albums done)`);
    }

    // Send progress notification when an album completes
    const completionPercent = Math.round((self.albumsCompleted / self.totalAlbums) * 100);
    console.log(`🔄 [LOADING] Album ${albumIndex + 1} completed - sending progress update: ${self.albumsCompleted}/${self.totalAlbums} (${completionPercent}%)`);
    self.sendSocketNotification("LOADING_PROGRESS", {
      message: `Completed album ${albumIndex + 1} of ${self.totalAlbums}...`,
      progress: completionPercent
    });

    // Progressive loading: send partial results if enabled and we have enough photos
    if (self.performanceConfig && self.performanceConfig.progressiveLoading &&
        self.albumsCompleted === 1 && images.length > 0) {
      // Send first album results immediately to start displaying photos
      if (config.debugAlbumCombining) {
        console.log(`🚀 Progressive loading: Sending first ${images.length} photos while processing remaining albums`);
      }
      self.sendProgressiveResult(images, config);
    }

    // Check if all albums are complete
    if (self.albumsCompleted === self.totalAlbums) {
      self.combineAlbumResults();
    } else {
      // Move to next album with delay for performance
      self.currentAlbumIndex++;
      const delay = self.performanceConfig ? self.performanceConfig.albumDelay : 2000;

      if (config.debugAlbumCombining) {
        console.log(`⏳ Waiting ${delay}ms before processing next album...`);
      }

      setTimeout(() => {
        // Check if we still have a valid config before proceeding
        if (self.currentMultiConfig) {
          console.log(`🔄 [LOADING] Delay complete, processing next album...`);
          self.processNextAlbumSequentially();
        } else {
          console.log(`⚠️  [LOADING] Config cleared during delay, stopping processing`);
        }
      }, delay);
    }
  },

  sendProgressiveResult: function(initialImages, config) {
    var self = this;

    // Use provided config or fallback to current (with null check)
    const configToUse = config || self.currentMultiConfig;
    if (!configToUse) {
      console.log(`⚠️  Cannot send progressive result - no valid config available`);
      return;
    }

    // Send initial batch to start displaying photos immediately
    self.sendSocketNotification("WALLPAPERS", {
      "source": configToUse.source,
      "orientation": configToUse.orientation,
      "images": initialImages.slice(0, Math.min(100, initialImages.length)), // Send first 100 photos
      "isProgressive": true, // Flag to indicate this is a partial result
    });
  },

  combineAlbumResults: function() {
    var self = this;

    // Store config before clearing it
    const config = self.currentMultiConfig;
    if (!config) {
      console.log(`⚠️  combineAlbumResults called but no config available`);
      return;
    }

    // Clear timeout
    if (self.multiAlbumTimeout) {
      clearTimeout(self.multiAlbumTimeout);
      self.multiAlbumTimeout = null;
    }

    // Combine all images from all albums
    var allImages = [];
    self.albumResults.forEach((albumImages, index) => {
      if (albumImages && albumImages.length > 0) {
        if (config.debugAlbumCombining) {
          console.log(`🔗 Album ${index + 1}: Adding ${albumImages.length} photos to combined collection`);
        }
        allImages = allImages.concat(albumImages);
      } else {
        if (config.debugAlbumCombining) {
          console.log(`⚠️  Album ${index + 1}: No photos to add (${albumImages ? albumImages.length : 'null'} photos)`);
        }
      }
    });

    if (config.debugAlbumCombining) {
      console.log(`📊 Combined total: ${allImages.length} photos from ${self.albumResults.length} albums`);
    }

    // Cache the FULL combined collection (don't apply rotating pools here)
    self.cacheResult(config, allImages);

    // Send loading complete notification
    console.log(`🔄 [LOADING] Sending LOADING_COMPLETE notification: ${allImages.length} photos from ${self.albumResults.length} albums`);
    self.sendSocketNotification("LOADING_COMPLETE", {
      message: `Loaded ${allImages.length} photos from ${self.albumResults.length} albums`
    });

    // Clean up
    self.albumResults = [];
    self.albumsCompleted = 0;
    self.totalAlbums = 0;
    self.currentMultiConfig = null;
    self.performanceConfig = null;
    self.currentAlbumIndex = 0;
  },

  processiCloudDataMulti: function(response, body, config, params) {
    var self = this;
    var album = params.album;
    var iCloudHost = params.iCloudHost;
    var images = [];
    var contributorNames = {};

    if (response.status === 330) {
      // Handle redirect
      const newHost = body["X-Apple-MMe-Host"] || iCloudHost;

      self.requestMultiAlbum(config, {
        method: "POST",
        url: `https://${newHost}/${album}/sharedstreams/webstream`,
        headers: params.headers,
        body: params.body,
        iCloudHost: newHost,
        album: album
      });
      return [];
    } else if (response.status === 200 && !params.isAssetRequest) {
      // Process photos from webstream
      if (body.photos) {
        var photos = body.photos.filter((p) => p != null && p.mediaAssetType !== "video");

        // Limit photos per album to prevent one album from dominating
        var maxPhotosPerAlbum = Math.ceil(config.maximumEntries / self.totalAlbums);

        // For enhanced shuffle, allow more photos per album for better variety
        if (config.enhancedShuffle) {
          if (config.rotatingPools) {
            // For rotating pools, allow much larger per-album limits to access full collections
            maxPhotosPerAlbum = Math.min(10000, photos.length); // Allow up to 10k photos per album
          } else {
            maxPhotosPerAlbum = Math.min(400, Math.ceil(1000 / self.totalAlbums));
          }
        }

        if (config.debugAlbumCombining) {
          console.log(`📸 Album ${config.albumIndex + 1}: Found ${photos.length} photos, limit is ${maxPhotosPerAlbum}`);
        }

        if (photos.length > maxPhotosPerAlbum) {
          photos = photos.slice(0, maxPhotosPerAlbum);
          if (config.debugAlbumCombining) {
            console.log(`✂️  Album ${config.albumIndex + 1}: Trimmed to ${photos.length} photos`);
          }
        }

        var photoGuids = photos.map((p) => { return p.photoGuid; });

        // Store photos for this album instance
        self[`iCloudPhotos_${config.albumIndex}`] = photos;

        self.requestMultiAlbum(config, {
          method: "POST",
          url: `https://${iCloudHost}/${album}/sharedstreams/webasseturls`,
          headers: {
            "Content-Type": "text/plain",
            "User-Agent": "MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)",
          },
          body: JSON.stringify({"photoGuids": photoGuids}),
          iCloudHost: iCloudHost,
          album: album,
          isAssetRequest: true
        });
        return [];
      }
    } else if (response.status === 200 && params.isAssetRequest) {
      // Process asset URLs with chunked processing for better performance
      var photos = self[`iCloudPhotos_${config.albumIndex}`];

      if (photos && body.items) {
        // Use chunked processing for large photo sets
        self.processPhotosInChunks(photos, body, config, contributorNames, (processedImages) => {
          // Clean up stored photos
          delete self[`iCloudPhotos_${config.albumIndex}`];

          // Handle completion with processed images (with error handling)
          try {
            self.handleAlbumComplete(config.albumIndex, processedImages);
          } catch (error) {
            console.error(`Error in handleAlbumComplete for album ${config.albumIndex + 1}:`, error);
            // Continue processing even if one album fails
          }
        });

        // Return empty array since we're handling completion asynchronously
        return [];
      }
    }

    return images;
  },

  processPhotosInChunks: function(photos, body, config, contributorNames, callback) {
    var self = this;
    const chunkSize = self.performanceConfig ? self.performanceConfig.chunkSize : 50;
    const chunkDelay = self.performanceConfig ? self.performanceConfig.chunkDelay : 100;
    var processedImages = [];
    var currentChunk = 0;
    var totalChunks = Math.ceil(photos.length / chunkSize);

    if (config.debugAlbumCombining) {
      console.log(`🔄 Processing ${photos.length} photos in ${totalChunks} chunks of ${chunkSize}`);
    }

    function processChunk() {
      const startIndex = currentChunk * chunkSize;
      const endIndex = Math.min(startIndex + chunkSize, photos.length);
      const chunkPhotos = photos.slice(startIndex, endIndex);

      if (config.debugAlbumCombining && currentChunk % 5 === 0) {
        console.log(`📸 Processing chunk ${currentChunk + 1}/${totalChunks} (photos ${startIndex + 1}-${endIndex})`);
      }

      // Process URL mapping for this chunk
      for (var checksum in body.items) {
        var p = body.items[checksum];
        var loc = body.locations[p.url_location];
        var host = loc.hosts[Math.floor(Math.random() * loc.hosts.length)];

        for (var photo of chunkPhotos) {
          for (var d in photo.derivatives) {
            var m = photo.derivatives[d];
            if (m.checksum === checksum) {
              m.url = `${loc.scheme}://${host}${p.url_path}`;
              break;
            }
          }
          contributorNames[photo.photoGuid] = photo.contributorFullName;
        }
      }

      // Convert chunk to image objects
      const chunkImages = chunkPhotos.map((p) => {
        var result = {
          url: null,
          caption: p.caption,
          variants: [],
          contributorFullName: contributorNames[p.photoGuid]
        };

        for (var i in p.derivatives) {
          var d = p.derivatives[i];
          if (+d.width > 0) {
            result.variants.push({
              url: d.url,
              width: +d.width,
              height: +d.height,
            });
          }
        }

        result.variants.sort((a, b) => { return a.width * a.height - b.width * b.height; });

        if (result.variants.length > 0) {
          result.url = result.variants[result.variants.length - 1].url;
        } else {
          console.warn(`Album ${config.albumIndex + 1}: Variants array is empty for photo:`, p);
          result.url = null;
        }

        return result;
      }).filter(img => img.url !== null);

      // Add processed images to the total
      processedImages = processedImages.concat(chunkImages);
      currentChunk++;

      // Check if we're done
      if (currentChunk >= totalChunks) {
        if (config.debugAlbumCombining) {
          console.log(`✅ Completed chunked processing: ${processedImages.length} valid images from ${photos.length} photos`);
        }
        callback(processedImages);
        return;
      }

      // Schedule next chunk with delay to prevent blocking
      if (chunkDelay > 0) {
        setTimeout(processChunk, chunkDelay);
      } else {
        setImmediate(processChunk);
      }
    }

    // Start processing
    processChunk();
  },

  cacheResult: function(config, images) {
    var self = this;
    var cache = self.getCacheEntry(config);

    cache.expires = Date.now() + config.updateInterval * 0.9;
    cache.images = images;

    self.sendResult(config);
  },

  sendResult: function(config) {
    var self = this;
    var result = self.getCacheEntry(config);
    var imagesToSend = result.images;

    // Apply rotating pool logic for multiple iCloud albums
    if (Array.isArray(config.source) && config.source.length > 1 &&
        config.source.every(src => typeof src === 'string' && src.toLowerCase().startsWith("icloud:"))) {

      if (config.rotatingPools) {
        imagesToSend = getRotatingPool(result.images, config);
        if (config.debugAlbumCombining) {
          console.log(`📤 Sending ${imagesToSend.length} images from rotating pool (from ${result.images.length} total cached)`);
        }
      } else {
        // Apply non-rotating pool logic
        if (config.shuffle) {
          imagesToSend = shuffle(result.images.slice()); // Make a copy before shuffling
        }

        // Limit to maximum entries
        var maxEntries = config.maximumEntries;
        if (config.enhancedShuffle && maxEntries < 500) {
          maxEntries = Math.min(1000, imagesToSend.length);
        }

        if (imagesToSend.length > maxEntries) {
          imagesToSend = imagesToSend.slice(0, maxEntries);
        }
      }
    } else {
      // For single sources, just limit to maximumEntries
      imagesToSend = result.images.slice(0, config.maximumEntries);
    }

    self.images = imagesToSend;

    self.sendSocketNotification("WALLPAPERS", {
      "source": config.source,
      "orientation": config.orientation,
      "images": imagesToSend,
    });
  },

  processResponse: function(response, body, config) {
    var self = this;
    var images;

    var source = config.source.toLowerCase();
    if (source.startsWith("icloud:")) {
      images = self.processiCloudData(response, JSON.parse(body), config);
    } else {
      images = self.processBingData(config, JSON.parse(body));
    }

    if (images.length === 0) {
      return;
    }

    self.cacheResult(config, images);
  },

  processBingData: function(config, data) {
    var self = this;
    var width = (config.orientation === "vertical") ? 1080 : 1920;
    var height = (config.orientation === "vertical") ? 1920 : 1080;
    var suffix = `_${width}x${height}.jpg`;

    var images = [];
    for (var image of data.images) {
      images.push({
        url: `https://www.bing.com${image.urlbase}${suffix}`,
        caption: image.copyright,
      });
    }

    return images;
  },

  processiCloudData: function(response, body, config) {
    var self = this;
    var album = config.source.substring(7).trim();
    var images = [];
    var contributorNames = {}; // Create an object to hold contributor names

    if (self.iCloudState === "webstream") {
      if (response.status === 330) {
        self.iCloudHost = body["X-Apple-MMe-Host"] || self.iCloudHost;
        self.request(config, {
          method: "POST",
          url: `https://${self.iCloudHost}/${album}/sharedstreams/webstream`,
          body: '{"streamCtag":null}'
        });
      } else if (response.status === 200) {
        // Filter out videos first
        var filteredPhotos = body.photos.filter((p) => p != null && p.mediaAssetType !== "video");

        // Use rotating pool system if enabled, otherwise use original logic
        if (config.rotatingPools) {
          self.iCloudPhotos = getRotatingPool(filteredPhotos, config);
        } else {
          if (config.shuffle) {
            filteredPhotos = shuffle(filteredPhotos);
          }

          // For enhanced shuffle, allow larger pools but limit to reasonable size
          var maxEntries = config.maximumEntries;
          if (config.enhancedShuffle && config.maximumEntries < 500) {
            maxEntries = Math.min(1000, filteredPhotos.length); // Allow up to 1000 images for 6+ hour variety
          }

          self.iCloudPhotos = filteredPhotos.slice(0, maxEntries);
        }
        self.iCloudState = "webasseturls";

        var photoGuids = self.iCloudPhotos.map((p) => { return p.photoGuid; });
        self.request(config, {
          method: "POST",
          url: `https://${self.iCloudHost}/${album}/sharedstreams/webasseturls`,
          body: JSON.stringify({"photoGuids": photoGuids}),
        });
      }
    } else if (self.iCloudState === "webasseturls") {
      for (var checksum in body.items) {
        var p = body.items[checksum];
        var loc = body.locations[p.url_location];
        var host = loc.hosts[Math.floor(Math.random() * loc.hosts.length)];

        for (var photo of self.iCloudPhotos) {
          for (var d in photo.derivatives) {
            var m = photo.derivatives[d];
            if (m.checksum === checksum) {
              m.url = `${loc.scheme}://${host}${p.url_path}`;
              break;
            }
          }
          // Store contributor name for each photo
          contributorNames[photo.photoGuid] = photo.contributorFullName;
        }
      }

      images = self.iCloudPhotos.map((p) => {
        var result = {
          url: null,
          caption: p.caption,
          variants: [],
          contributorFullName: contributorNames[p.photoGuid] // Add contributor name to result
        };

        for (var i in p.derivatives) {
          var d = p.derivatives[i];

          if (+d.width > 0) {
            result.variants.push({
              url: d.url,
              width: +d.width,
              height: +d.height,
            });
          }
        }

        result.variants.sort((a, b) => { return a.width * a.height - b.width * b.height; });

          // Make sure the variants array has at least one element
          if (result.variants.length > 0) {
              // Get the last element's URL
              result.url = result.variants[result.variants.length - 1].url;
          } else {
              // Handle the case where the variants array is empty
              console.warn("Variants array is empty for photo:", p);
              result.url = null; // Or some default URL
          }

        return result;
      });
    }

    return images;
  },

  getCacheEntry: function(config) {
    var self = this;

    // Create a cache key that handles both single sources and arrays
    var sourceKey;
    if (Array.isArray(config.source)) {
      // For arrays, sort and join to create a consistent key
      sourceKey = config.source.slice().sort().join("|");
    } else {
      sourceKey = config.source;
    }

    var key = crypto.createHash("sha1").update(`${sourceKey}::${config.orientation}`).digest("hex");

    if (!(key in self.cache)) {
      self.cache[key] = {
        "key": key,
        "expires": Date.now(),
        "images": [],
      };
    }

    return self.cache[key];
  },

  getExifData: function (imageUrl) {
    const self = this;
    const tempPath = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath);
    }
    const tempFileName = `tempImage-${uuidv4()}.jpg`;
    const tempFilePath = path.join(tempPath, tempFileName);

    self.downloadImage(imageUrl, tempFilePath)
      .then(() => {
          new ExifImage({ image: tempFilePath }, function (error, exifData) {
              if (error) {
                  console.log('Error: ' + error.message);
                  self.processExifData({}, imageUrl);
              } else {
                  self.processExifData(exifData, imageUrl);
              }
              // Cleanup: Delete the temporary image file
              fs.unlink(tempFilePath, (err) => {
                  if (err) console.error('Error deleting temporary file:', err);
              });
          });
      })
      .catch(error => {
          console.error('Error downloading image:', error);
          self.processExifData({}, imageUrl);
          // Cleanup: Ensure temp file is deleted even on download failure
          if (fs.existsSync(tempFilePath)) {
              fs.unlink(tempFilePath, (err) => {
                  if (err) console.error('Error deleting temporary file:', err);
              });
          }
      });
  },

  processExifData: function(data, imageUrl) {
    const self = this;

    // Safely get the date
    let createdDate = data.exif && (data.exif.CreateDate || data.image.ModifyDate);
    let createdDateFormatted = "Date not found";

    if (createdDate) {
      // Handle different date formats
      let dateParts = createdDate.split(/[: ]/); // Split by colon or space

      if (dateParts.length >= 3) {
        // Ensure all parts are numbers
        let year = parseInt(dateParts[0]);
        let month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
        let day = parseInt(dateParts[2]);
        let hours = parseInt(dateParts[3]) || 0;
        let minutes = parseInt(dateParts[4]) || 0;
        let seconds = parseInt(dateParts[5]) || 0;

        // Check if we have valid numbers
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          let dateObj = new Date(year, month, day, hours, minutes, seconds);

          // Check if the date object is valid
          if (!isNaN(dateObj.getTime())) {
            createdDateFormatted = dateObj.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
          }
        }
      }
    }

    // Safely get GPS data, check if gps object and properties exist before accessing
    let latitude = "Latitude not found";
    let longitude = "Longitude not found";
    if (data.gps && data.gps.GPSLatitude && data.gps.GPSLatitudeRef && data.gps.GPSLongitude && data.gps.GPSLongitudeRef) {
        const lat = data.gps.GPSLatitude[0] + data.gps.GPSLatitude[1] / 60 + data.gps.GPSLatitude[2] / 3600;
        const lon = data.gps.GPSLongitude[0] + data.gps.GPSLongitude[1] / 60 + data.gps.GPSLongitude[2] / 3600;
        latitude = (data.gps.GPSLatitudeRef === "S" ? -lat : lat).toFixed(6);
        longitude = (data.gps.GPSLongitudeRef === "W" ? -lon : lon).toFixed(6);
    }



    // Find the corresponding image data from self.images to get the contributor name
    const imageData = (self.images) ? self.images.find(image => image.url === imageUrl) : null;
    const contributorFullName = imageData && imageData.contributorFullName ? imageData.contributorFullName : "Contributor not found";

    // Only proceed with reverse geocoding if we have valid lat and lon
    if (latitude !== "Latitude not found" && longitude !== "Longitude not found") {
        self.reverseGeocode(latitude, longitude, contributorFullName, createdDateFormatted);
    } else {
        // If no location data, construct the info string with available data
        const infoString = self.createInfoString(createdDateFormatted, null, contributorFullName);
        self.sendSocketNotification("NEW_INFO_STRING", infoString);
    }
},

  downloadImage: function (url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, function (response) {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', function () {
                    file.close(resolve);
                });
            } else {
                file.close();
                fs.unlink(filePath, () => { }); // Delete the empty or incomplete file
                reject(new Error(`Failed to download image. Status code: ${response.statusCode}`));
            }
        }).on('error', function (err) {
            file.close();
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, () => { }); // Delete the file on error
            }
            reject(err);
        });
    });
  },

 reverseGeocode: function(latitude, longitude, contributorFullName, createdDateFormatted) {
  const self = this;
  const startZoom = 18;

  const attemptReverseGeocode = (zoomLevel) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=${zoomLevel}&addressdetails=1&accept-language=en`;

    fetch(url, {
      headers: {
        'User-Agent': 'MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        let locationName = null;
        let countryCode = null;

        if (data.address) {
          countryCode = data.address.country_code;

          // Prioritize location parts
          if (data.address.tourism) {
            locationName = data.address.tourism;
          } else if (data.address.amenity) {
            locationName = data.address.amenity;
          } else if (data.address.hamlet) {
            locationName = data.address.hamlet;
          } else if (data.address.town) {
            locationName = data.address.town;
          } else if (data.address.city) {
            locationName = data.address.city;
          } else if (data.address.road && data.address.county) {
            locationName = `${data.address.road}, ${data.address.county}`;
          } else if (data.address.village) {
            locationName = data.address.village;
          } else if (data.address.suburb) {
            locationName = data.address.suburb;
          }

          // Handle US locations and territories
          if (countryCode === 'us') {
            if (locationName && data.address.state) {
              // Use abbreviation if we have road and county
              if (locationName.includes(data.address.road) && locationName.includes(data.address.county)) {
                locationName += `, ${stateAbbreviations[data.address.state] || data.address.state}`;
              } else if (!locationName.includes(data.address.state)) {
                // Append state if it's not already present
                locationName += `, ${data.address.state}`;
              }
            }

            // Special handling for US territories
            self.getTerritory(latitude, longitude)
              .then(territory => {
                if (territory) {
                  // Only append if not already present and not the same as state
                  if (locationName && !locationName.includes(territory) && territory !== data.address.state) {
                    locationName += ", " + territory;
                  } else if (!locationName) {
                    locationName = territory;
                  }
                }

                const infoString = self.createInfoString(createdDateFormatted, locationName, contributorFullName);
                self.sendSocketNotification("NEW_INFO_STRING", infoString);
              })
              .catch(error => {
                console.error('Error during territory lookup:', error);
                // Proceed with available locationName even if territory lookup fails
                const infoString = self.createInfoString(createdDateFormatted, locationName, contributorFullName);
                self.sendSocketNotification("NEW_INFO_STRING", infoString);
              });
          } else {
            // Handle non-US locations
            if (locationName && data.address.country && !locationName.includes(data.address.country)) {
              locationName += ", " + data.address.country;
            }

            const infoString = self.createInfoString(createdDateFormatted, locationName, contributorFullName);
            self.sendSocketNotification("NEW_INFO_STRING", infoString);
          }
        } else {
          const infoString = self.createInfoString(createdDateFormatted, null, contributorFullName);
          self.sendSocketNotification("NEW_INFO_STRING", infoString);
        }
      })
      .catch(error => {
        console.error('Error during reverse geocoding:', error);
      });
  };

  attemptReverseGeocode(startZoom);
},

// Helper function to construct the info string
createInfoString: function(createdDate, locationName, contributorFullName) {
    let infoString = "";
    if (createdDate !== "Date not found") {
        infoString += `${createdDate}`;
    }
    if (locationName) {
        infoString += (infoString ? " | " : "") + `${locationName}`;
    }
    if (contributorFullName !== "Contributor not found") {
        infoString += (infoString ? " | " : "") + `Contributor: ${contributorFullName}`;
    }
    return infoString;
},

  // Function to specifically get the territory name for US locations
  getTerritory: function (latitude, longitude) {
    const self = this;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=5&addressdetails=1&accept-language=en`;

    return fetch(url, {
      headers: {
        'User-Agent': 'MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)'
      }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.address && data.address.state) {
                return data.address.state;
            }
            return null;
        })
        .catch(error => {
            console.error('Error during territory lookup:', error);
            return null;
        });
  },
});