const fs = require('fs');

async function testImport() {
  console.log('Starting Excel import test...\n');
  
  // Read file
  const fileBuffer = fs.readFileSync('D:/SIMMACI/sample_import_teachers.xlsx');
  const blob = new Blob([fileBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  // Create FormData
  const formData = new FormData();
  formData.append('file', blob, 'sample_import_teachers.xlsx');
  
  try {
    const response = await fetch('http://localhost:3000/master-data/teachers/import', {
      method: 'POST',
      body: formData
    });
    
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    const data = await response.json();
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n✓ Import test completed!');
    return data;
  } catch (error) {
    console.error('\n✗ Import test failed:',  error.message);
    throw error;
  }
}

testImport();
