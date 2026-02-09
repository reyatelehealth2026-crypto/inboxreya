/**
 * Test Script - Verify Groups API Authentication Fix
 * 
 * This script tests that the Next.js API routes are now working correctly
 * after fixing the authentication imports.
 * 
 * Run: node test-groups-auth-fix.js
 */

const https = require('https');

const BASE_URL = 'https://inbox-iota-inky.vercel.app';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function testEndpoint(name, path) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Testing: ${name}`, 'blue');
  log(`Path: ${path}`, 'blue');
  log('='.repeat(60), 'blue');
  
  try {
    const response = await makeRequest(path);
    
    log(`Status Code: ${response.statusCode}`, 
      response.statusCode === 200 ? 'green' : 
      response.statusCode === 401 ? 'yellow' : 'red'
    );
    
    const contentType = response.headers['content-type'] || '';
    log(`Content-Type: ${contentType}`, 
      contentType.includes('application/json') ? 'green' : 'red'
    );
    
    // Check if response is JSON
    let isJson = false;
    let jsonData = null;
    
    try {
      jsonData = JSON.parse(response.body);
      isJson = true;
      log('✓ Response is valid JSON', 'green');
    } catch (e) {
      log('✗ Response is NOT JSON (likely HTML error page)', 'red');
      log(`First 200 chars: ${response.body.substring(0, 200)}`, 'red');
    }
    
    // Check for expected response structure
    if (isJson) {
      if (response.statusCode === 401) {
        log('✓ Unauthorized (expected - no session cookie)', 'yellow');
        log(`Response: ${JSON.stringify(jsonData, null, 2)}`, 'yellow');
      } else if (jsonData.success !== undefined) {
        log('✓ Response has "success" field', 'green');
        log(`Success: ${jsonData.success}`, jsonData.success ? 'green' : 'yellow');
        
        if (jsonData.data) {
          log('✓ Response has "data" field', 'green');
        }
        
        if (jsonData.error) {
          log(`Error: ${jsonData.error}`, 'yellow');
        }
      } else {
        log('⚠ Response structure unexpected', 'yellow');
        log(`Response: ${JSON.stringify(jsonData, null, 2)}`, 'yellow');
      }
    }
    
    return {
      name,
      success: isJson && contentType.includes('application/json'),
      statusCode: response.statusCode,
      isJson,
    };
    
  } catch (error) {
    log(`✗ Request failed: ${error.message}`, 'red');
    return {
      name,
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('LINE Group Chat - Authentication Fix Verification', 'blue');
  log('='.repeat(60), 'blue');
  log('\nNote: 401 Unauthorized is EXPECTED (no session cookie)', 'yellow');
  log('The important thing is that responses are JSON, not HTML\n', 'yellow');
  
  const tests = [
    {
      name: 'Groups List',
      path: '/api/inbox/groups',
    },
    {
      name: 'Group Stats',
      path: '/api/inbox/groups/stats',
    },
    {
      name: 'Group Detail',
      path: '/api/inbox/groups/1',
    },
    {
      name: 'Group Members',
      path: '/api/inbox/groups/1/members',
    },
    {
      name: 'Group Messages',
      path: '/api/inbox/groups/1/messages',
    },
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.path);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('TEST SUMMARY', 'blue');
  log('='.repeat(60), 'blue');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    const color = result.success ? 'green' : 'red';
    log(`${status} - ${result.name}`, color);
  });
  
  log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`, 
    failed === 0 ? 'green' : 'red'
  );
  
  if (failed === 0) {
    log('\n✓ All endpoints return JSON responses!', 'green');
    log('✓ Authentication fix is working correctly!', 'green');
    log('\nNext step: Login to the app and test with a valid session', 'yellow');
  } else {
    log('\n✗ Some endpoints still returning HTML', 'red');
    log('Check the Next.js server logs for errors', 'yellow');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'blue');
}

// Run tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
