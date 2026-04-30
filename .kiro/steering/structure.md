# Project Structure

## Root Layout
```
/                        # Frontend (React/Vite)
├── src/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env / .env.local / .env.production
backend/                 # Laravel API
├── app/
├── routes/api.php
├── database/
├── composer.json
├── .env
.kiro/                   # Kiro specs and steering
```

---

## Frontend (`src/`)

```
src/
├── features/            # Feature-based modules (primary organization unit)
│   ├── auth/
│   ├── dashboard/
│   ├── master-data/     # Schools, teachers, students
│   ├── sk-management/   # SK document workflow
│   ├── attendance/
│   ├── approval/
│   ├── events/
│   ├── kta/             # Member card generator
│   ├── monitoring/      # Headmaster tenure
│   ├── mutations/       # Teacher mutations
│   ├── reports/
│   ├── schools/
│   ├── sdm/             # NUPTK submissions
│   ├── settings/
│   ├── users/
│   └── verification/    # Public QR verification
├── components/
│   ├── layout/          # AppShell, ProtectedLayout
│   ├── ui/              # Shadcn/UI base components
│   └── common/          # Shared components (ErrorBoundary, PageTransition, etc.)
├── hooks/               # Custom React hooks
├── lib/
│   ├── api.ts           # Central Axios client (apiClient)
│   └── authHelpers.ts   # RBAC helper functions
├── services/            # API service modules
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

**Conventions:**
- Pages are named `*Page.tsx` (e.g., `TeacherListPage.tsx`)
- Feature folders co-locate pages, components, and hooks for that domain
- All API calls go through `apiClient` from `src/lib/api.ts`
- Auth state stored in `localStorage` (`auth_token`, `user_data`)
- Use `@/` alias for all imports (e.g., `@/lib/api`, `@/components/ui/button`)

---

## Backend (`backend/app/`)

```
app/
├── Http/
│   ├── Controllers/Api/   # One controller per resource
│   ├── Middleware/        # CheckRole, TenantScope, EnsureTenantIsValid, LogApiRequests
│   └── Requests/          # Form Request validation classes (grouped by resource)
├── Models/                # Eloquent models
├── Services/              # Business logic layer
├── Repositories/          # Data access layer (interface + implementation)
│   └── Contracts/         # Repository interfaces
├── Jobs/                  # Queued jobs (export, import, document generation)
├── Traits/
│   ├── ApiResponse.php    # Standardized JSON response methods
│   ├── HasTenantScope.php # Auto-scopes queries to current school_id
│   └── AuditLogTrait.php  # Automatic activity logging on models
├── Rules/
│   └── UniqueForTenant.php # Tenant-aware uniqueness validation
├── Filament/Resources/    # Admin panel resources
├── Policies/              # Authorization policies
└── Console/Commands/      # Artisan commands
```

**Conventions:**
- All API controllers use the `ApiResponse` trait for consistent response shape: `{ success, message, data }`
- Models that are tenant-scoped use `HasTenantScope` + `AuditLogTrait` traits
- All models use `SoftDeletes` (see `tech.md`)
- Validation lives in dedicated `FormRequest` classes under `Http/Requests/{Resource}/`
- Tenant-aware uniqueness uses the `UniqueForTenant` custom rule
- Business logic belongs in `Services/`, not controllers
- Repository pattern used for data access (`Repositories/Contracts/` defines interfaces)
- Routes are all under `routes/api.php`, grouped by `auth:sanctum` middleware
- Role middleware: `role:super_admin` or `role:operator` via `CheckRole`
- Tenant isolation middleware: `TenantScope` sets PostgreSQL session variable for RLS

---

## Multi-Tenancy Pattern

- Every tenant-scoped model has a `school_id` foreign key
- `HasTenantScope` trait auto-applies `where school_id = ?` for operators
- Super admins (`super_admin`) and `admin_yayasan` bypass scoping and see all data
- `operator` role is always scoped to their own school only
- `UniqueForTenant` rule enforces uniqueness within a tenant's scope
- `TenantScope` middleware sets `app.current_school_id` PostgreSQL variable for RLS policies
