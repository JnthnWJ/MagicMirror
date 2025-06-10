const assert = require('assert');
const https = require('https');
const { URL } = require('url');

// Simple helper function to test createInfoString logic
function createInfoString(createdDate, locationName, contributorFullName) {
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
}

// Test configuration
const TEST_COORDINATES = {
  // New York City coordinates
  nyc: { lat: 40.7128, lon: -74.0060 },
  // London coordinates  
  london: { lat: 51.5074, lon: -0.1278 },
  // Tokyo coordinates
  tokyo: { lat: 35.6762, lon: 139.6503 }
};

/**
 * Test helper function to make HTTP requests with proper headers
 */
function makeTestRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Test that Nominatim API accepts requests with proper User-Agent
 */
async function testNominatimUserAgent() {
  console.log('Testing Nominatim API with proper User-Agent header...');
  
  const { lat, lon } = TEST_COORDINATES.nyc;
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
  
  try {
    const response = await makeTestRequest(url);
    
    // Should not get 403 Forbidden
    assert.notStrictEqual(response.statusCode, 403, 'Should not receive 403 Forbidden with proper User-Agent');
    
    // Should get 200 OK
    assert.strictEqual(response.statusCode, 200, 'Should receive 200 OK with proper User-Agent');
    
    // Should return valid JSON
    const data = JSON.parse(response.body);
    assert(data, 'Should return valid JSON data');
    
    console.log('✓ Nominatim API accepts requests with proper User-Agent');
    return true;
  } catch (error) {
    console.error('✗ Nominatim API test failed:', error.message);
    return false;
  }
}

/**
 * Test that requests without User-Agent get blocked
 */
async function testNominatimWithoutUserAgent() {
  console.log('Testing Nominatim API without User-Agent header...');
  
  const { lat, lon } = TEST_COORDINATES.nyc;
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
  
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        // Intentionally omit User-Agent to test blocking
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      // Should get 403 Forbidden without proper User-Agent
      if (res.statusCode === 403) {
        console.log('✓ Nominatim API correctly blocks requests without proper User-Agent');
        resolve(true);
      } else {
        console.log('? Nominatim API did not block request without User-Agent (status:', res.statusCode, ')');
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.error('✗ Request error:', error.message);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.error('✗ Request timeout');
      resolve(false);
    });

    req.end();
  });
}

/**
 * Test reverse geocoding for multiple locations
 */
async function testReverseGeocodingLocations() {
  console.log('Testing reverse geocoding for multiple locations...');
  
  const locations = [
    { name: 'New York City', ...TEST_COORDINATES.nyc },
    { name: 'London', ...TEST_COORDINATES.london },
    { name: 'Tokyo', ...TEST_COORDINATES.tokyo }
  ];
  
  let allPassed = true;
  
  for (const location of locations) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lon}&zoom=18&addressdetails=1&accept-language=en`;
      const response = await makeTestRequest(url);
      
      assert.strictEqual(response.statusCode, 200, `Should get 200 for ${location.name}`);
      
      const data = JSON.parse(response.body);
      assert(data.address, `Should have address data for ${location.name}`);
      
      console.log(`✓ ${location.name}: ${data.display_name}`);
      
      // Add delay to respect rate limiting (1 request per second)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
    } catch (error) {
      console.error(`✗ ${location.name} failed:`, error.message);
      allPassed = false;
    }
  }
  
  return allPassed;
}

/**
 * Test the createInfoString helper function
 */
function testCreateInfoString() {
  console.log('Testing createInfoString helper function...');

  // Test with all parameters
  const result1 = createInfoString('2023-06-10', 'New York, NY', 'John Doe');
  assert.strictEqual(result1, '2023-06-10 | New York, NY | Contributor: John Doe');

  // Test with missing location
  const result2 = createInfoString('2023-06-10', null, 'John Doe');
  assert.strictEqual(result2, '2023-06-10 | Contributor: John Doe');

  // Test with missing contributor
  const result3 = createInfoString('2023-06-10', 'New York, NY', 'Contributor not found');
  assert.strictEqual(result3, '2023-06-10 | New York, NY');

  // Test with only date
  const result4 = createInfoString('2023-06-10', null, 'Contributor not found');
  assert.strictEqual(result4, '2023-06-10');

  console.log('✓ createInfoString helper function works correctly');
  return true;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('Starting reverse geocoding tests...\n');
  
  const tests = [
    { name: 'createInfoString helper', fn: testCreateInfoString },
    { name: 'Nominatim with User-Agent', fn: testNominatimUserAgent },
    { name: 'Nominatim without User-Agent', fn: testNominatimWithoutUserAgent },
    { name: 'Multiple location geocoding', fn: testReverseGeocodingLocations }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    console.log(`\n--- Running: ${test.name} ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✓ ${test.name} PASSED`);
      } else {
        console.log(`✗ ${test.name} FAILED`);
      }
    } catch (error) {
      console.error(`✗ ${test.name} ERROR:`, error.message);
    }
  }
  
  console.log(`\n--- Test Results ---`);
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  testNominatimUserAgent,
  testNominatimWithoutUserAgent,
  testReverseGeocodingLocations,
  testCreateInfoString,
  runTests
};
