const fs = require('fs');

async function run() {
  try {
    console.log("1. Authenticating...");
    const loginRes = await fetch('http://localhost:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@maarif.nu', password: 'admin123' })
    });
    
    if (!loginRes.ok) throw new Error('Login failed');
    const loginData = await loginRes.json();
    const token = loginData.token;

    console.log("2. Generating Mock Excel Data with weird columns...");
    const jsonData = [
      {
        "n_i_s_n": "0011223344",
        "n_i_k": "3301010101010001",
        "nama_santri": "Ahmad Fuzzy Match",
        "tmp_lahir": "Banyumas",
        "tgl_lahir": "2010-05-15",
        "l_p": "L",
        "rombel": "6A",
        "nama_bapak": "Budi",
        "bunda": "Susi",
        "no_hp": "0812345678",
        "asal_sekolah": "MI Negeri 1",
        "status_aktif": "Ya"
      }
    ];

    console.log("3. Sending import request...");
    const importRes = await fetch('http://localhost:8000/api/students/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ students: jsonData })
    });

    const responseText = await importRes.text();
    let importData = JSON.parse(responseText);

    if (!importRes.ok) {
        console.error("API Error Status:", importRes.status);
    } else {
        console.log("✓ Success Response:");
        console.log(JSON.stringify(importData, null, 2));
    }
  } catch (error) {
    console.error('Test script error:', error.message);
  }
}

run();
