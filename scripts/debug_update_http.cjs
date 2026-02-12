
const https = require('https');

// URL from .env.local: https://successful-bison-83.convex.cloud
const CONVEX_URL = 'https://successful-bison-83.convex.cloud';

// Payload from Screenshot + ID
const payload = {
    path: "teachers:update",
    args: {
        id: "jh7egcag5t34z5v12zt1tdt16h80mv8p", // ID from screenshot
        isCertified: true,
        kecamatan: "Gandrungmangu",
        mapel: "-",
        nama: "MASDUKI BAEHAKI, S.Pd.I",
        nuptk: "654231325",
        pdpkpnu: "Sudah",
        phoneNumber: "081235698789",
        status: "GTY",
        tanggallahir: "1978-02-21",
        tempatlahir: "Cilacap",
        tmt: "2004-07-16",
        token: "c4119541-4dda-41d9-ab4b-d14d4e996ff3",
        unitKerja: "MI Ma'arif Gandrungmanis"
    },
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
        console.log('Headers:', res.headers);
        console.log('Body:', responseBody);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
