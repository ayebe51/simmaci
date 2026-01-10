const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a dummy Excel file (just a text file renamed, xlsx parser might fail but controller log should hit)
// Actually, let's make a minimal valid xlsx if possible, or just a dummy buffer.
// The backend logs "Controller hit" BEFORE parsing, so any file content is fine to test reachability.

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const filePath = 'd:/SIMMACI/test-upload.txt';
fs.writeFileSync(filePath, 'dummy content');

const fileContent = fs.readFileSync(filePath);

const postDataStart = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="file"; filename="test.xlsx"',
  'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '',
  ''
].join('\r\n');

const postDataEnd = `\r\n--${boundary}--`;

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/master-data/teachers/import',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(postDataStart) + fileContent.length + Buffer.byteLength(postDataEnd)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postDataStart);
req.write(fileContent);
req.write(postDataEnd);
req.end();
