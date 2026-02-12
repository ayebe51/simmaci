
const https = require('https');

// URL from .env.local: https://successful-bison-83.convex.cloud
const CONVEX_URL = 'https://successful-bison-83.convex.cloud';

// Payload for Ping
const payload = {
    path: "teachers:testPing",
    args: {},
    format: "json"
};

const data = JSON.stringify(payload);

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(`${CONVEX_URL}/api/mutation`, options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log('Body:', responseBody);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
