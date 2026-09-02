export type PpdbTrack = 'reguler' | 'prestasi' | 'afirmasi' | 'tahfidz';

export type PpdbStatus = 
  | 'draft' 
  | 'submitted' 
  | 'verified' 
  | 'revision_needed' 
  | 'rejected' 
  | 'accepted' 
  | 'reserved' 
  | 'reregistered' 
  | 'cancelled';

export interface PpdbPeriod {
  id: number;
  school_id?: number | null;
  school?: {
    id: number;
    nama: string;
    npsn?: string;
    jenjang?: string;
  };
  academic_year: string;
  wave_name: string;
  description?: string;
  start_date: string;
  end_date: string;
  announcement_date?: string;
  reregistration_end_date?: string;
  quota: number;
  is_active: boolean;
  available_tracks?: string[];
  required_documents?: string[];
  registrations_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PpdbRegistration {
  id: number;
  registration_number: string;
  school_id: number;
  period_id: number;
  track: PpdbTrack;
  nisn?: string;
  nik: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  asal_sekolah: string;
  no_whatsapp: string;
  email?: string;
  alamat: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan: string;
  kelurahan: string;
  rt_rw?: string;
  kode_pos?: string;
  nama_ayah?: string;
  pekerjaan_ayah?: string;
  nama_ibu?: string;
  pekerjaan_ibu?: string;
  nama_wali?: string;
  no_whatsapp_wali?: string;
  foto_url?: string;
  kk_url?: string;
  akta_url?: string;
  ijazah_url?: string;
  prestasi_url?: string;
  additional_documents?: Record<string, string>;
  status: PpdbStatus;
  verification_notes?: string;
  verified_by?: number;
  verified_at?: string;
  verified_by_user?: {
    id: number;
    name: string;
    role?: string;
  };
  test_score?: number;
  interview_score?: number;
  achievement_score?: number;
  final_score?: number;
  rank?: number;
  selection_notes?: string;
  is_reregistered: boolean;
  reregistered_at?: string;
  student_id?: number;
  student?: {
    id: number;
    nomor_induk_maarif?: string;
    nama?: string;
    status?: string;
    kelas?: string;
  };
  school?: {
    id: number;
    nama: string;
    npsn?: string;
    nsm?: string;
    jenjang?: string;
    kecamatan?: string;
    alamat?: string;
    telepon?: string;
  };
  period?: {
    id: number;
    wave_name: string;
    academic_year: string;
    announcement_date?: string;
  };
  created_at: string;
  updated_at?: string;
}

export interface PpdbStats {
  total_registrations: number;
  submitted: number;
  verified: number;
  revision_needed: number;
  accepted: number;
  reregistered: number;
  rejected: number;
  total_quota: number;
}
