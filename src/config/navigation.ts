import {
  FileText,
  LayoutDashboard,
  School,
  Settings,
  User,
  Users,
  AlertTriangle,
  FileBarChart,
  Trophy,
  Crown,
  Gavel,
  ArrowRightLeft,
  CreditCard,
  Stethoscope,
  FileEdit,
  Activity,
  ScanLine,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  LayoutTemplate,
  MessageSquare,
  CalendarDays,
  CalendarPlus,
  BarChart3,
  LucideIcon
} from "lucide-react";

export type Role = "super_admin" | "admin_yayasan" | "operator" | "staff" | "admin";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[]; // Which roles can see this menu. If undefined, all can see.
  exact?: boolean; // Whether active state requires exact match
  external?: boolean; // External link
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    id: "data_induk",
    title: "Data Induk",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { id: "school_profile", label: "Profil Lembaga", href: "/dashboard/school/profile", icon: School, roles: ["operator"] },
      { id: "school_manage", label: "Data Sekolah", href: "/dashboard/master/schools", icon: School, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "teachers", label: "Data Guru & Tendik", href: "/dashboard/master/teachers", icon: Users },
      { id: "students", label: "Data Siswa", href: "/dashboard/master/students", icon: User },
      { id: "student_stats", label: "Statistik Siswa", href: "/dashboard/student-statistics", icon: BarChart3 },
      { id: "staff_data", label: "Data Staff PCNU", href: "/dashboard/staff", icon: Users, roles: ["super_admin", "staff"] },
    ]
  },
  {
    id: "layanan_sk_sdm",
    title: "Layanan SK & SDM",
    items: [
      { id: "generator", label: "Generator SK", href: "/dashboard/generator", icon: FileText, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sk_submit", label: "Pengajuan SK", href: "/dashboard/sk", icon: FileText },
      { id: "sk_approval", label: "Approval Yayasan", href: "/dashboard/approval/yayasan", icon: Gavel, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sk_revision", label: "Revisi Data SK", href: "/dashboard/sk-revisions", icon: FileEdit },
      { id: "sk_archive", label: "Arsip SK Unit", href: "/dashboard/sk-saya", icon: FileText },
      { id: "sdm_rekom", label: "Rekomendasi Kepala", href: "/dashboard/sdm/rekomendasi-kepala/pengajuan", icon: Crown },
      { id: "sdm_sk_kepala", label: "Pengajuan SK Kepala", href: "/dashboard/sdm/sk-kepala/new", icon: Crown },
      { id: "sdm_mutasi", label: "Mutasi Guru", href: "/dashboard/mutations", icon: ArrowRightLeft },
      { id: "sdm_monitor", label: "Monitoring Kepala", href: "/dashboard/monitoring/headmasters", icon: AlertTriangle, roles: ["super_admin", "admin_yayasan", "admin"] },
    ]
  },
  {
    id: "kehadiran",
    title: "Kehadiran & Absensi",
    items: [
      { id: "att_teacher", label: "Absensi Guru", href: "/dashboard/attendance/teacher", icon: UserCheck, roles: ["operator"] },
      { id: "att_student", label: "Absensi Siswa", href: "/dashboard/attendance/student", icon: GraduationCap, roles: ["operator"] },
      { id: "att_scan", label: "Buka Scanner Publik", href: "/scan", icon: ScanLine, external: true, roles: ["operator"] },
      { id: "att_subject", label: "Mata Pelajaran", href: "/dashboard/attendance/subjects", icon: BookOpen, roles: ["operator"] },
      { id: "att_class", label: "Kelas / Rombel", href: "/dashboard/attendance/classes", icon: School, roles: ["operator"] },
      { id: "att_schedule", label: "Jadwal Jam", href: "/dashboard/attendance/schedule", icon: ClipboardList, roles: ["operator"] },
      { id: "att_report", label: "Laporan Absensi", href: "/dashboard/attendance/report", icon: FileBarChart, roles: ["operator"] },
      { id: "staff_att_report", label: "Absensi Staff PCNU", href: "/dashboard/staff/attendance-report", icon: FileBarChart, roles: ["super_admin"] },
      { id: "att_settings", label: "Pengaturan Absensi", href: "/dashboard/attendance/settings", icon: Settings, roles: ["operator", "super_admin"] },
    ]
  },
  {
    id: "kegiatan_komunikasi",
    title: "Kegiatan & Komunikasi",
    items: [
      { id: "events", label: "Event / Lomba", href: "/dashboard/events", icon: Trophy, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "meetings", label: "Rapat Yayasan", href: "/dashboard/meetings", icon: CalendarDays },
      { id: "wa_list", label: "Daftar WA Blast", href: "/dashboard/wa-blast", icon: MessageSquare, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "wa_template", label: "Template Pesan", href: "/dashboard/wa-blast/templates", icon: LayoutTemplate, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "wa_config", label: "Konfigurasi Go-WA", href: "/dashboard/wa-blast/config", icon: Settings, roles: ["super_admin"] },
    ]
  },
  {
    id: "kartu_laporan",
    title: "Kartu & Laporan",
    items: [
      { id: "kta", label: "Digital KTA", href: "/dashboard/kta", icon: CreditCard },
      { id: "student_card", label: "Kartu Pelajar", href: "/dashboard/student-card", icon: CreditCard },
      { id: "unified_reports", label: "Pusat Laporan", href: "/dashboard/reports", icon: FileBarChart, roles: ["super_admin", "admin_yayasan", "admin"] },
    ]
  },
  {
    id: "system",
    title: "Administrasi Sistem",
    items: [
      { id: "sys_users", label: "Manajemen User", href: "/dashboard/users", icon: Users, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sys_sk_template", label: "Template SK", href: "/dashboard/sk-templates", icon: LayoutTemplate, roles: ["super_admin"] },
      { id: "sys_health", label: "Health Data", href: "/dashboard/audit", icon: Stethoscope, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sys_logs", label: "Log Aktivitas", href: "/dashboard/activity-logs", icon: Activity },
      { id: "sys_settings", label: "Pengaturan", href: "/dashboard/settings", icon: Settings, roles: ["super_admin", "admin_yayasan", "operator"] },
    ]
  }
];

export function getBreadcrumbs(pathname: string): { label: string, href?: string }[] {
  const crumbs = [{ label: 'Dashboard', href: '/dashboard' }];
  
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return crumbs;
  }

  let matchedGroup: NavGroup | null = null;
  let matchedItem: NavItem | null = null;
  let maxMatchLength = -1;

  for (const group of navigationConfig) {
    for (const item of group.items) {
      if (item.href === '/dashboard') continue;
      
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        if (item.href.length > maxMatchLength) {
          maxMatchLength = item.href.length;
          matchedGroup = group;
          matchedItem = item;
        }
      }
    }
  }

  if (matchedGroup && matchedItem) {
    crumbs.push({ label: matchedGroup.title });
    crumbs.push({ label: matchedItem.label, href: matchedItem.href });
  }

  // Deep route labels
  if (pathname.includes('/new') || pathname.includes('/create')) {
    crumbs.push({ label: 'Baru' });
  } else if (pathname.includes('/edit') || pathname.includes('/revision')) {
    crumbs.push({ label: 'Ubah' });
  } else if (pathname.split('/').length > 3 && !pathname.endsWith('/')) {
      const id = pathname.split('/').pop();
      if (id && id !== 'new' && id !== 'create' && id !== 'edit' && id !== 'revision' && id !== 'profile') {
         crumbs.push({ label: 'Detail' });
      }
  }

  return crumbs;
}
