import * as fs from 'fs';
const path = 'src/features/master-data/SchoolListPage.tsx';
const content = fs.readFileSync(path, 'utf8');
const updated = content.replace(
    'description="Pastikan file excel Anda memiliki kolom: nsm, nama, kecamatan, alamat, kepala_madrasah."',
    'description="Pastikan file excel Anda memiliki kolom: nama_sekolah, nsm, npsn, kepala_madrasah, akreditasi, npsm_nu, status, kecamatan, alamat, email, no_telepon."'
);
fs.writeFileSync(path, updated);
console.log("SchoolListPage description updated.");
