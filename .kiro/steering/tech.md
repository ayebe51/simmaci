# Tech Stack

## Frontend
- **Framework**: React 19 + Vite 6
- **Language**: TypeScript ~5.9
- **Styling**: Tailwind CSS 3 + `tailwind-merge`, `class-variance-authority`
- **UI Components**: Shadcn/UI + Radix UI primitives
- **Routing**: React Router DOM v7
- **Data Fetching**: Axios via a central `apiClient` (`src/lib/api.ts`) + TanStack React Query v5
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Document Generation**: docxtemplater, PizZip, PDFKit, mammoth
- **QR Code**: html5-qrcode, qrcode.react, react-qr-code
- **Notifications**: Sonner (toast)
- **Error Monitoring**: Sentry (`@sentry/react`)
- **PWA**: vite-plugin-pwa
- **Path alias**: `@` maps to `./src`

## Backend
- **Framework**: Laravel 12 (PHP ^8.2)
- **Database**: PostgreSQL 16
- **ORM**: Eloquent with SoftDeletes (all models use soft deletes by default)
- **Auth**: Laravel Sanctum (token-based, single-device — old tokens revoked on login)
- **Admin Panel**: Filament v3
- **Queue**: Database driver (jobs in `app/Jobs/`)
- **Cache/Session**: Database driver
- **File Storage**: Laravel Storage (local or S3-compatible)
- **Document Generation**: PHPWord (`phpoffice/phpword`)
- **Excel Import/Export**: Maatwebsite Excel
- **Activity Logging**: Spatie Laravel Activitylog + custom `ActivityLog` model
- **Permissions**: Spatie Laravel Permission
- **Error Monitoring**: Sentry (`sentry/sentry-laravel`)
- **Code Style**: Laravel Pint

## Infrastructure
- **Containerization**: Docker Compose (postgres:16-alpine, redis:7-alpine)
- **CI/CD**: GitHub Actions — backend PHPUnit tests + frontend ESLint + Vite build
- **E2E Testing**: Playwright

---

## Common Commands

### Frontend
```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run test:e2e     # Playwright E2E tests
```

### Backend (run from `backend/`)
```bash
php artisan serve                    # Dev server (localhost:8000)
php artisan migrate --seed           # Run migrations + seeders
php artisan migrate:fresh --seed     # Reset DB and reseed
php artisan test                     # Run PHPUnit tests
php artisan queue:listen             # Process queued jobs
php artisan tinker                   # REPL
./vendor/bin/pint                    # Format code with Pint
```

### Docker
```bash
docker compose up -d --build                              # Start all services
docker exec -it simmaci-backend php artisan migrate --seed  # Migrate inside container
```

### Full Dev Stack (from `backend/`)
```bash
composer run dev     # Starts Laravel server + queue + pail logs + Vite concurrently
```
