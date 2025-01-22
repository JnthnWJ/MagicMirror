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
    var key = crypto.createHash("sha1").update(`${config.source}::${config.orientation}`).digest("hex");

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
    const startZoom = 12; // Start at town/borough level

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
                let locationName = null;
                let countryCode = null;

                if (data.address) {
                    locationName = data.address.city || data.address.town || data.address.village || data.address.borough;
                    countryCode = data.address.country_code;

                    if (countryCode === 'us') {
                        // Get the state for US locations
                        if (data.address.state) {
                            locationName = (locationName ? locationName + ", " : "") + data.address.state;
                        }
                        // Special handling for US territories
                        self.getTerritory(latitude, longitude).then(territory => {
                            if (territory && !locationName.includes(territory)) {
                                locationName += ", " + territory;
                            }

                            if (locationName) {
                                // Construct the info string
                                const infoString = self.createInfoString(createdDateFormatted, locationName, contributorFullName);
                                self.sendSocketNotification("NEW_INFO_STRING", infoString);

                            } else if (zoomLevel > 3) {
                                console.log(`No location found at zoom level ${zoomLevel}, retrying with zoom level ${zoomLevel - 1}`);
                                attemptReverseGeocode(zoomLevel - 1);
                            } else {
                                console.log("Location Name: Location not found");
                            }
                        });
                    } else {
                        // For non-US locations, append county and country if available
                        if (data.address.county) {
                            locationName = (locationName ? locationName + ", " : "") + data.address.county;
                        }
                        if (data.address.country) {
                            locationName = (locationName ? locationName + ", " : "") + data.address.country;
                        }

                        if (locationName) {
                          // Construct the info string
                          const infoString = self.createInfoString(createdDateFormatted, locationName, contributorFullName);
                          self.sendSocketNotification("NEW_INFO_STRING", infoString);
                        } else if (zoomLevel > 3) {
                            console.log(`No location found at zoom level ${zoomLevel}, retrying with zoom level ${zoomLevel - 1}`);
                            attemptReverseGeocode(zoomLevel - 1);
                        } else {
                            console.log("Location Name: Location not found");
                        }
                    }
                } else if (zoomLevel > 3) {
                    console.log(`No location found at zoom level ${zoomLevel}, retrying with zoom level ${zoomLevel - 1}`);
                    attemptReverseGeocode(zoomLevel - 1);
                } else {
                    console.log("Location Name: Location not found");
                }
            })
            .catch(error => {
                console.error('Error during reverse geocoding:', error);
            });
    };

    // Start the reverse geocoding process at the initial zoom level
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
        infoString += (infoString ? " | " : "") + `Contributed by ${contributorFullName}`;
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
