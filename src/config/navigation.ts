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
  CreditCard,
  Stethoscope,
  ScanLine,
  LucideIcon,
  MessageSquare,
  BookOpen,
  Crown,
  Award,
  CheckSquare,
  BadgeCheck,
  Archive
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
      { id: "school_manage", label: "Data Satpend", href: "/dashboard/master/schools", icon: School, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "teachers", label: "Data Guru & Tendik", href: "/dashboard/master/teachers", icon: Users },
      { id: "students_center", label: "Data Siswa", href: "/dashboard/students-center", icon: User },
    ]
  },
  {
    id: "layanan_sk_sdm",
    title: "Layanan SK & SDM",
    items: [
      { id: "sk_center", label: "Pusat Layanan SK", href: "/dashboard/sk-center", icon: FileText },
      { id: "sk_arsip", label: "Arsip SK Saya", href: "/dashboard/sk-arsip", icon: Archive },
      { id: "sk_approval_guru", label: "Approval SK Guru & Tendik", href: "/dashboard/sk", icon: CheckSquare, roles: ["super_admin", "admin_yayasan", "admin", "operator"] },
      { id: "sk_generator_center", label: "Generator & Approval SK Kepala", href: "/dashboard/sk-generator-center", icon: BadgeCheck, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sdm_monitor", label: "Monitoring Masa Jabatan", href: "/dashboard/monitoring/headmasters", icon: AlertTriangle, roles: ["super_admin", "admin_yayasan", "admin"] },
    ]
  },
  {
    id: "kehadiran",
    title: "Kehadiran & Absensi",
    items: [
      { id: "attendance_center", label: "Pusat Absensi & Rekap", href: "/dashboard/attendance-center", icon: FileBarChart },
      { id: "academic_config", label: "Konfigurasi Akademik", href: "/dashboard/academic-config", icon: BookOpen, roles: ["operator", "super_admin"] },
      { id: "att_scan", label: "Buka Scanner Publik", href: "/scan", icon: ScanLine, external: true, roles: ["operator", "super_admin"] },
    ]
  },
  {
    id: "kegiatan_komunikasi",
    title: "Kegiatan & Komunikasi",
    items: [
      { id: "events_center", label: "Manajemen Acara", href: "/dashboard/events-center", icon: Trophy },
      { id: "wa_center", label: "WhatsApp Center", href: "/dashboard/wa-center", icon: MessageSquare, roles: ["super_admin", "admin_yayasan", "admin"] },
    ]
  },
  {
    id: "kartu_laporan",
    title: "Kartu & Laporan",
    items: [
      { id: "cards_center", label: "Pusat Cetak Kartu", href: "/dashboard/cards-center", icon: CreditCard },
      { id: "unified_reports", label: "Pusat Laporan", href: "/dashboard/reports", icon: FileBarChart, roles: ["super_admin", "admin_yayasan", "admin"] },
    ]
  },
  {
    id: "system",
    title: "Administrasi & Sistem",
    items: [
      { id: "staff_data", label: "Data Staff PCNU", href: "/dashboard/staff", icon: Users, roles: ["super_admin", "staff"] },
      { id: "sys_users", label: "Manajemen User", href: "/dashboard/users", icon: Users, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "audit_center", label: "Audit & Log Sistem", href: "/dashboard/audit-center", icon: Stethoscope, roles: ["super_admin", "admin_yayasan", "admin"] },
      { id: "sys_settings", label: "Pengaturan Global", href: "/dashboard/settings", icon: Settings, roles: ["super_admin", "admin_yayasan", "operator"] },
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
      
      if (pathname === item.href || pathname.startsWith(item.href + '/') || pathname.startsWith(item.href + '?')) {
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
  } else if (pathname.includes('/edit')) {
    crumbs.push({ label: 'Ubah' });
  } else if (pathname.includes('/revisi') || pathname.includes('/revision')) {
    crumbs.push({ label: 'Layanan Revisi SK' });
  } else if (pathname.includes('/kamad')) {
    crumbs.push({ label: 'SK Kepala Satpen' });
  } else if (pathname.split('/').length > 3 && !pathname.endsWith('/')) {
    const id = pathname.split('/').pop();
    if (id && !['new', 'create', 'edit', 'revision', 'revisi', 'profile'].includes(id)) {
      crumbs.push({ label: 'Detail' });
    }
  }

  return crumbs;
}
