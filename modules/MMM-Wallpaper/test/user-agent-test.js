const https = require('https');
const { URL } = require('url');

/**
 * Simple test to verify that the User-Agent header fix works
 * This test specifically checks that:
 * 1. Requests with proper User-Agent headers are accepted
 * 2. Requests without User-Agent headers are blocked (403)
 */

const USER_AGENT = 'MagicMirror:MMM-Wallpaper:v1.0 (by /u/kolbyhack)';
const TEST_COORDINATES = { lat: 40.7128, lon: -74.0060 }; // NYC

function makeRequest(includeUserAgent = true) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${TEST_COORDINATES.lat}&lon=${TEST_COORDINATES.lon}&zoom=18&addressdetails=1&accept-language=en`;
    const urlObj = new URL(url);
    
    const headers = {
      'Accept': 'application/json'
    };
    
    if (includeUserAgent) {
      headers['User-Agent'] = USER_AGENT;
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
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

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testUserAgentFix() {
  console.log('🧪 Testing User-Agent header fix for Nominatim API...\n');
  
  try {
    // Test 1: Request WITHOUT User-Agent (should be blocked)
    console.log('1️⃣  Testing request WITHOUT User-Agent header...');
    try {
      const responseWithoutUA = await makeRequest(false);
      if (responseWithoutUA.statusCode === 403) {
        console.log('   ✅ BLOCKED (403) - This is expected behavior');
      } else {
        console.log(`   ⚠️  Not blocked (${responseWithoutUA.statusCode}) - Nominatim policy may have changed`);
      }
    } catch (error) {
      console.log(`   ⚠️  Request failed: ${error.message}`);
    }
    
    // Wait 1 second to respect rate limiting
    console.log('   ⏳ Waiting 1 second for rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Request WITH User-Agent (should work)
    console.log('2️⃣  Testing request WITH User-Agent header...');
    try {
      const responseWithUA = await makeRequest(true);
      if (responseWithUA.statusCode === 200) {
        const data = JSON.parse(responseWithUA.body);
        console.log('   ✅ SUCCESS (200) - Request accepted');
        console.log(`   📍 Location: ${data.display_name || 'Location data received'}`);
        return true;
      } else {
        console.log(`   ❌ Unexpected status: ${responseWithUA.statusCode}`);
        return false;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function verifyCodeFix() {
  console.log('🔍 Verifying the code fix in node_helper.js...\n');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const nodeHelperPath = path.join(__dirname, '..', 'node_helper.js');
    const content = fs.readFileSync(nodeHelperPath, 'utf8');
    
    // Check if User-Agent headers are present in both functions
    const reverseGeocodeMatch = content.match(/reverseGeocode:[\s\S]*?fetch\(url,\s*\{[\s\S]*?'User-Agent':\s*'[^']+'/);
    const getTerritoryMatch = content.match(/getTerritory:[\s\S]*?fetch\(url,\s*\{[\s\S]*?'User-Agent':\s*'[^']+'/);
    
    if (reverseGeocodeMatch && getTerritoryMatch) {
      console.log('✅ Code fix verified: Both reverseGeocode and getTerritory functions have User-Agent headers');
      return true;
    } else {
      console.log('❌ Code fix incomplete:');
      if (!reverseGeocodeMatch) console.log('   - reverseGeocode function missing User-Agent header');
      if (!getTerritoryMatch) console.log('   - getTerritory function missing User-Agent header');
      return false;
    }
  } catch (error) {
    console.error('❌ Error reading node_helper.js:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 MMM-Wallpaper Reverse Geocoding Fix Test\n');
  console.log('This test verifies that the User-Agent header fix resolves the HTTP 403 errors\n');
  
  const codeFixOk = await verifyCodeFix();
  const apiTestOk = await testUserAgentFix();
  
  console.log('\n📊 Test Summary:');
  console.log(`   Code Fix: ${codeFixOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   API Test: ${apiTestOk ? '✅ PASS' : '❌ FAIL'}`);
  
  if (codeFixOk && apiTestOk) {
    console.log('\n🎉 SUCCESS: The reverse geocoding fix is working correctly!');
    console.log('   The MMM-Wallpaper module should no longer get HTTP 403 errors from Nominatim.');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { testUserAgentFix, verifyCodeFix };
