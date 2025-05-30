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

    console.log(`Starting node helper for: ${self.name}`);
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
        } else {
          console.log("Images array not populated yet. Skipping EXIF data retrieval.");
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
    if (config.maximumEntries <= cacheEntry.images.length && Date.now() < cacheEntry.expires) {
      self.images = cacheEntry.images;
      self.sendResult(config);
      return;
    }

    console.log(`Fetching images from ${config.source.length} iCloud albums...`);

    // Track album fetching progress
    self.albumResults = [];
    self.albumsCompleted = 0;
    self.totalAlbums = config.source.length;
    self.currentMultiConfig = config;

    // Set a timeout to handle stuck requests
    if (self.multiAlbumTimeout) {
      clearTimeout(self.multiAlbumTimeout);
    }
    self.multiAlbumTimeout = setTimeout(() => {
      console.log("Multi-album fetch timeout, combining available results...");
      self.combineAlbumResults();
    }, 30000); // 30 second timeout

    // Fetch each album
    config.source.forEach((albumSource, index) => {
      const albumConfig = Object.assign({}, config);
      albumConfig.source = albumSource;
      albumConfig.albumIndex = index;

      const album = albumSource.substring(7).trim();
      const partition = b62decode((album[0] === "A") ? album[1] : album.substring(1, 3));
      const iCloudHost = `p${partition}-sharedstreams.icloud.com`;

      console.log(`Fetching album ${index + 1}/${self.totalAlbums}: ${album}`);

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
    }

    // Only call handleAlbumComplete if we have final results (asset request completed) or error
    if (images.length > 0 || response.status !== 200) {
      self.handleAlbumComplete(config.albumIndex, images);
    }
  },

  handleAlbumComplete: function(albumIndex, images) {
    var self = this;

    // Store the results for this album
    self.albumResults[albumIndex] = images;
    self.albumsCompleted++;

    console.log(`Album ${albumIndex + 1}/${self.totalAlbums} completed with ${images.length} images`);

    // Check if all albums are complete
    if (self.albumsCompleted === self.totalAlbums) {
      self.combineAlbumResults();
    }
  },

  combineAlbumResults: function() {
    var self = this;

    // Clear timeout
    if (self.multiAlbumTimeout) {
      clearTimeout(self.multiAlbumTimeout);
      self.multiAlbumTimeout = null;
    }

    // Combine all images from all albums
    var allImages = [];
    self.albumResults.forEach((albumImages, index) => {
      if (albumImages && albumImages.length > 0) {
        console.log(`Adding ${albumImages.length} images from album ${index + 1}`);
        allImages = allImages.concat(albumImages);
      }
    });

    console.log(`Combined ${allImages.length} total images from ${self.totalAlbums} albums`);

    // Shuffle the combined collection if shuffle is enabled
    if (self.currentMultiConfig.shuffle) {
      allImages = shuffle(allImages);
    }

    // Limit to maximum entries
    if (allImages.length > self.currentMultiConfig.maximumEntries) {
      allImages = allImages.slice(0, self.currentMultiConfig.maximumEntries);
    }

    // Cache and send the results
    self.cacheResult(self.currentMultiConfig, allImages);

    // Clean up
    self.albumResults = [];
    self.albumsCompleted = 0;
    self.totalAlbums = 0;
    self.currentMultiConfig = null;
  },

  processiCloudDataMulti: function(response, body, config, params) {
    var self = this;
    var album = params.album;
    var iCloudHost = params.iCloudHost;
    var images = [];
    var contributorNames = {};

    console.log(`Album ${config.albumIndex + 1}: Response status ${response.status}, isAssetRequest: ${params.isAssetRequest}`);

    if (response.status === 330) {
      // Handle redirect
      const newHost = body["X-Apple-MMe-Host"] || iCloudHost;
      console.log(`Album ${config.albumIndex + 1}: Redirecting to ${newHost}`);

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
        if (photos.length > maxPhotosPerAlbum) {
          photos = photos.slice(0, maxPhotosPerAlbum);
        }

        console.log(`Album ${config.albumIndex + 1}: Processing ${photos.length} photos`);

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
      // Process asset URLs
      var photos = self[`iCloudPhotos_${config.albumIndex}`];
      console.log(`Album ${config.albumIndex + 1}: Processing asset URLs for ${photos ? photos.length : 0} photos`);

      if (photos && body.items) {
        console.log(`Album ${config.albumIndex + 1}: Found ${Object.keys(body.items).length} items in response`);

        // Map URLs to photos
        for (var checksum in body.items) {
          var p = body.items[checksum];
          var loc = body.locations[p.url_location];
          var host = loc.hosts[Math.floor(Math.random() * loc.hosts.length)];

          for (var photo of photos) {
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

        // Convert to image objects
        images = photos.map((p) => {
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
        }).filter(img => img.url !== null); // Filter out images without URLs

        console.log(`Album ${config.albumIndex + 1}: Successfully processed ${images.length} images`);

        // Clean up stored photos
        delete self[`iCloudPhotos_${config.albumIndex}`];
      }
    }

    return images;
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
    self.images = result.images;

    console.log(`Sending WALLPAPERS notification with ${result.images.length} images`);
    console.log(`Source: ${JSON.stringify(config.source)}`);
    console.log(`Orientation: ${config.orientation}`);
    console.log(`First image URL: ${result.images.length > 0 ? result.images[0].url : 'No images'}`);

    self.sendSocketNotification("WALLPAPERS", {
      "source": config.source,
      "orientation": config.orientation,
      "images": result.images.slice(0, config.maximumEntries),
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
        if (config.shuffle) {
          body.photos = shuffle(body.photos);
        }
        self.iCloudPhotos = body.photos.filter((p) => p != null && p.mediaAssetType !== "video").slice(0, config.maximumEntries);
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

    // Log date and GPS information
    console.log("Created Date:", createdDateFormatted);
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);

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

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log("Data from reverse geocode attempt:", data);
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
            console.log("US Location Name before territory check:", locationName);

            // Special handling for US territories
            self.getTerritory(latitude, longitude)
              .then(territory => {
                if (territory) {
                  console.log("US Territory found:", territory);
                  // Only append if not already present and not the same as state
                  if (locationName && !locationName.includes(territory) && territory !== data.address.state) {
                    locationName += ", " + territory;
                  } else if (!locationName) {
                    locationName = territory;
                  }
                }
                console.log("US Location Name after territory check:", locationName);

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
          console.log("Location Name: Location information not available in response.");
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

    return fetch(url)
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