// Example: How to use Convex in React components

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

// EXAMPLE 1: Real-time Dashboard Stats
export function DashboardStats() {
  // This automatically updates when data changes!
  const stats = useQuery(api.dashboard.getStats);
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Real-time Stats</h2>
      <p>Total Guru: {stats.totalTeachers}</p>
      <p>Total Siswa: {stats.totalStudents}</p>
      <p>Total Sekolah: {stats.totalSchools}</p>
    </div>
  );
}

// EXAMPLE 2: Teacher List with Filters
export function TeacherList() {
  // Real-time teacher list
  const teachers = useQuery(api.teachers.list, { 
    unitKerja: "all",
    kecamatan: "all" 
  });
  
  // Mutations for create/update
  const createTeacher = useMutation(api.teachers.create);
  const updateTeacher = useMutation(api.teachers.update);
  const deleteTeacher = useMutation(api.teachers.remove);
  
  const handleCreate = async (data: any) => {
    try {
      await createTeacher(data);
      // UI updates automatically!
    } catch (error) {
      console.error("Failed to create teacher:", error);
    }
  };
  
  if (!teachers) return <div>Loading...</div>;
  
  return (
    <div>
      {teachers.map(teacher => (
        <div key={teacher._id}>
          <h3>{teacher.nama}</h3>
          <p>NUPTK: {teacher.nuptk}</p>
          <p>Unit: {teacher.unitKerja}</p>
          <button onClick={() => deleteTeacher({ id: teacher._id })}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

// EXAMPLE 3: Get Single Teacher
export function TeacherDetail({ teacherId }: { teacherId: string }) {
  const teacher = useQuery(api.teachers.get, { id: teacherId as any });
  const update = useMutation(api.teachers.update);
  
  if (!teacher) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>{teacher.nama}</h2>
      <button onClick={() => update({ 
        id: teacher._id, 
        nama: "Updated Name" 
      })}>
        Update
      </button>
    </div>
  );
}

/*
KEY BENEFITS OF CONVEX:

1. REAL-TIME UPDATES
   - No need to refetch
   - UI automatically syncs with database
   - Multiple users see changes instantly

2. TYPE-SAFE
   - Auto-generated types from schema
   - Full TypeScript support
   - Autocomplete in IDE

3. OPTIMISTIC UPDATES
   - UI updates immediately
   - Reverts if mutation fails
   - Great UX

4. SIMPLE API
   - useQuery for reads
   - useMutation for writes
   - No axios, no manual state management

MIGRATION GUIDE:

Old (Axios):
  const [teachers, setTeachers] = useState([]);
  useEffect(() => {
    api.getTeachers().then(setTeachers);
  }, []);

New (Convex):
  const teachers = useQuery(api.teachers.list);
  // That's it! Auto-updates!

*/
