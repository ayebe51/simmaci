
import axios from 'axios';
import fs from 'fs';

const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function query(path, args = {}) {
  try {
      const res = await axios.post(`${CONVEX_URL}/api/query`, {
          path, 
          args
      });
      const json = res.data;
      if (json.status !== "success") {
          throw new Error(`Failed ${path}: ${json.errorMessage}`);
      }
      return json.value;
  } catch (e) {
      console.error(e.response ? e.response.data : e.message);
      throw e;
  }
}

async function run() {
  console.log("Fetching data...");
  const schools = await query("schools:list");
  const sks = await query("sk:debugListAllSk");
  const teachers = await query("sk:debugListAllTeachers");
  const users = await query("auth:listUsers");

  const cimangguSchools = schools.filter(s => s.nama.toLowerCase().includes("cimanggu"));
  // Find EXACT or very close match
  const specificSchool = schools.find(s => s.nama.includes("MTsS Ma'arif Cimanggu") || s.nama.includes("MTsS MA'ARIF CIMANGGU"));
  
  const cimangguSks = sks.filter(sk => sk.unitKerja && sk.unitKerja.toLowerCase().includes("cimanggu"));
  const cimangguTeachers = teachers.filter(t => t.unitKerja && t.unitKerja.toLowerCase().includes("cimanggu"));
  const cimangguUsers = users.filter(u => (u.unitKerja && u.unitKerja.toLowerCase().includes("cimanggu")) || (u.name && u.name.toLowerCase().includes("cimanggu")));

  const output = {
      targetSchool: specificSchool ? { ...specificSchool } : "NOT FOUND",
      matchedSchoolsCount: cimangguSchools.length,
      matchedSchools: cimangguSchools.map(s => ({ _id: s._id, nama: s.nama, nsm: s.nsm })),
      skCount: cimangguSks.length,
      sks: cimangguSks.map(sk => ({
          _id: sk._id,
          nomorSk: sk.nomorSk,
          unitKerja: sk.unitKerja,
          schoolId: sk.schoolId,
          status: sk.status,
          missingSchoolId: !sk.schoolId,
          mismatch: specificSchool && sk.schoolId !== specificSchool._id
      })),
      teacherCount: cimangguTeachers.length,
      teachers: cimangguTeachers.map(t => ({
          _id: t._id,
          nama: t.nama,
          unitKerja: t.unitKerja,
          schoolId: t.schoolId,
          missingSchoolId: !t.schoolId
      })),
      userCount: cimangguUsers.length,
      users: cimangguUsers.map(u => ({
          _id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          unit: u.unitKerja, // auth:listUsers returns unitKerja mapped from unit
          schoolId: u.schoolId, // Note: auth:listUsers might not return schoolId directly unless I verify schema or response
          // Wait, auth:listUsers in auth.ts returns:
          // id, email, name, role, unitKerja (mapped from unit), isActive, createdAt.
          // It does NOT return schoolId.
          // I need to check if unitKerja matches school name.
      }))
  };
  
  fs.writeFileSync('debug_output.json', JSON.stringify(output, null, 2));
  console.log("Wrote result to debug_output.json");
}

run().catch(console.error);
