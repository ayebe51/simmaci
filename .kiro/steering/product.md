# Product: SIMMACI (SIM Maarif NU Cilacap)

**Sistem Informasi Manajemen Pendidikan & Generator SK Digital** — a web-based education management platform for LP Ma'arif NU Cilacap (an Islamic school network in Indonesia).

## Core Purpose
Digitize administrative processes across a network of schools (madrasah), covering master data management and automated official document (SK) generation.

## Key Features
- **Dashboard**: Real-time statistics across all school branches (total schools, teachers, students, document status)
- **Master Data**: Centralized management of schools (lembaga), teachers (guru/GTK), and students (siswa)
- **SK Generator**: Automated generation of official decrees (Surat Keputusan) — appointment, mutation, dismissal — with QR code verification and digital signatures
- **RBAC**: Role-based access control with three roles: `super_admin`, `admin_yayasan`, and `operator`
- **Attendance**: QR-based teacher attendance tracking
- **NUPT Submissions**: Teacher NUPTK credential submission workflow
- **Reports & Exports**: Excel/PDF report generation
- **Headmaster Monitoring**: Tenure tracking and expiry alerts
- **Events & Competitions**: School event management
- **KTA Generator**: Member card (Kartu Tanda Anggota) generation
- **PPDB**: Public student registration portal

## User Roles (RBAC)
- `super_admin` — full access to all data across all schools, system settings, user management
- `admin_yayasan` — foundation-level admin with approval and oversight capabilities across schools
- `operator` — scoped to their own school only (`school_id`), manages data for their unit

## Multi-Tenancy Model
Each school is a tenant. Operators are scoped to their `school_id`. Super admins and admin yayasan have broader access. See `structure.md` for the technical implementation details.

## Language Context
The application domain uses Indonesian language for field names, messages, and UI labels (e.g., `nama`, `sekolah`, `guru`, `siswa`, `jabatan`). Backend validation messages and API responses are in Indonesian.
