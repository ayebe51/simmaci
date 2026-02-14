
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
  console.log("Fetching ALL schools and teachers...");
  const schools = await query("schools:list");
  const teachers = await query("sk:debugListAllTeachers");

  // 1. Broad Search for 'Kroya' Schools
  const kroyaSchools = schools.filter(s => s.nama.toLowerCase().includes("kroya"));
  
  // 2. Broad Search for 'Kroya' Teachers
  const kroyaTeachers = teachers.filter(t => t.unitKerja && t.unitKerja.toLowerCase().includes("kroya"));

  const output = {
      schools: kroyaSchools.map(s => ({ _id: s._id, nama: s.nama, nsm: s.nsm })),
      teachers: kroyaTeachers.map(t => ({
          _id: t._id,
          nama: t.nama,
          unitKerja: t.unitKerja,
          schoolId: t.schoolId,
          isVerified: t.isVerified,
          isSkGenerated: t.isSkGenerated
      }))
  };

  fs.writeFileSync('debug_kroya_v2.json', JSON.stringify(output, null, 2));
  console.log("Analysis written to debug_kroya_v2.json");
}

run().catch(console.error);
