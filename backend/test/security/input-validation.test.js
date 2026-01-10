/**
 * Security Input Validation Tests for Import Endpoints
 * Tests malformed data, missing required fields, injection attempts, and oversized data
 */

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with valid token

// Helper to create test Excel file buffer
const XLSX = require('xlsx');

/**
 * Test Case 1: Missing Required Fields
 * Expected: Should reject or handle gracefully
 */
async function testMissingRequiredFields() {
    console.log('\n=== TEST 1: Missing Required Fields ===');
    
    const invalidData = [
        {
            NISN: '123456789',
            // Missing Nama (required field)
            'Jenis Kelamin': 'L',
        },
        {
            // Missing NISN
            Nama: 'Test Student',
            'Jenis Kelamin': 'P',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(invalidData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        // EXPECTED: Should either reject completely or report errors for missing fields
        if (response.ok && result.errors && result.errors.length > 0) {
            console.log('✅ PASS: Errors reported for missing fields');
        } else if (!response.ok) {
            console.log('✅ PASS: Request rejected');
        } else {
            console.log('❌ FAIL: Accepted invalid data without errors');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 2: SQL Injection Attempts
 * Expected: Should sanitize or reject
 */
async function testSQLInjection() {
    console.log('\n=== TEST 2: SQL Injection Attempts ===');
    
    const maliciousData = [
        {
            NISN: "'; DROP TABLE students; --",
            Nama: "Robert'; DROP TABLE students; --",
            'Jenis Kelamin': 'L',
        },
        {
            NISN: "1 OR 1=1",
            Nama: "' OR '1'='1",
            'Jenis Kelamin': 'P',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(maliciousData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        // EXPECTED: Should sanitize inputs (TypeORM should help with this)
        console.log('⚠️  MANUAL CHECK: Verify data was sanitized, not executed');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 3: XSS Attempts
 * Expected: Should sanitize HTML/JS
 */
async function testXSS() {
    console.log('\n=== TEST 3: XSS Attempts ===');
    
    const xssData = [
        {
            NISN: '1234567890',
            Nama: '<script>alert("XSS")</script>',
            'Jenis Kelamin': '<img src=x onerror=alert(1)>',
        },
        {
            NISN: '9876543210',
            Nama: '<iframe src="javascript:alert(1)">',
            Alamat: '<svg onload=alert(1)>',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(xssData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        console.log('⚠️  MANUAL CHECK: Verify XSS tags were sanitized/escaped');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 4: Extra/Unknown Fields
 * Expected: Should ignore or strip extra fields
 */
async function testExtraFields() {
    console.log('\n=== TEST 4: Extra/Unknown Fields ===');
    
    const dataWithExtras = [
        {
            NISN: '1234567890',
            Nama: 'Test Student',
            'Jenis Kelamin': 'L',
            // Extra fields not in schema:
            'admin': true,
            'isDeleted': false,
            'role': 'admin',
            'password': 'hacked123',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(dataWithExtras);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        console.log('⚠️  MANUAL CHECK: Verify extra fields were ignored, not saved to DB');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 5: Oversized Data
 * Expected: Should reject or truncate
 */
async function testOversizedData() {
    console.log('\n=== TEST 5: Oversized Data ===');
    
    const oversizedData = [
        {
            NISN: '1234567890',
            Nama: 'A'.repeat(10000), // Very long name
            Alamat: 'B'.repeat(50000), // Huge address
            'Jenis Kelamin': 'L',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(oversizedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        if (!response.ok || (result.errors && result.errors.length > 0)) {
            console.log('✅ PASS: Oversized data handled');  
        } else {
            console.log('❌ FAIL: Accepted oversized data');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 6: Invalid Data Types
 * Expected: Should validate and reject incorrect types
 */
async function testInvalidDataTypes() {
    console.log('\n=== TEST 6: Invalid Data Types ===');
    
    const invalidTypes = [
        {
            NISN: 12345, // Number instead of string
            Nama: true, // Boolean instead of string
            'Jenis Kelamin': 999, // Number instead of L/P
            'Tanggal Lahir': 'invalid-date',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(invalidTypes);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        console.log('⚠️  MANUAL CHECK: Verify type coercion is safe or rejected');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 7: Empty File
 * Expected: Should reject gracefully
 */
async function testEmptyFile() {
    console.log('\n=== TEST 7: Empty File ===');
    
    const emptyData = [];
    const worksheet = XLSX.utils.json_to_sheet(emptyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'test.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        if (!response.ok || result.total === 0) {
            console.log('✅ PASS: Empty file handled gracefully');
        } else {
            console.log('⚠️  WARNING: Empty file accepted');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Test Case 8: Malformed File (Non-Excel)
 * Expected: Should reject non-Excel files
 */
async function testMalformedFile() {
    console.log('\n=== TEST 8: Malformed/Non-Excel File ===');
    
    const textContent = 'This is not an Excel file';
    const buffer = Buffer.from(textContent);

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'fake.xlsx');

    try {
        const response = await fetch(`${BASE_URL}/master-data/students/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });
        
        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', result);
        
        if (!response.ok) {
            console.log('✅ PASS: Malformed file rejected');
        } else {
            console.log('❌ FAIL: Malformed file accepted');
        }
    } catch (error) {
        console.log('✅ PASS: Malformed file caused error (rejected)');
    }
}

// Run all tests
async function runAllTests() {
    console.log('========================================');
    console.log('  INPUT VALIDATION SECURITY TESTS');
    console.log('========================================');
    
    await testMissingRequiredFields();
    await testSQLInjection();
    await testXSS();
    await testExtraFields();
    await testOversizedData();
    await testInvalidDataTypes();
    await testEmptyFile();
    await testMalformedFile();
    
    console.log('\n========================================');
    console.log('  TESTS COMPLETED');
    console.log('========================================');
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testMissingRequiredFields,
        testSQLInjection,
        testXSS,
        testExtraFields,
        testOversizedData,
        testInvalidDataTypes,
        testEmptyFile,
        testMalformedFile,
    };
}
