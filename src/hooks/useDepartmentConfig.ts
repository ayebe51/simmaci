
export function useDepartmentConfig() {
  // Currently hardcoded to match SettingsPage defaults. 
  // Future: Fetch from DB if 'settings_v2' supports structured JSON.
  const config = {
    schoolName: "Lembaga Pendidikan Ma'arif NU Cilacap",
    schoolAddress: "Jl. Masjid No. 09, Cilacap",
    phone: "0282-123456",
    email: "maarif@cilacap.nu.or.id", // Added likely default
    website: "maarif-cilacap.nu.or.id"
  }

  return { config, isLoading: false }
}
