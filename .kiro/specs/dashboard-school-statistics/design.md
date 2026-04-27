# Design Document: Dashboard School Statistics

## Overview

Fitur ini menambahkan dua statistik baru pada dashboard SIMMACI untuk memberikan insight distribusi sekolah berdasarkan **afiliasi** (Jama'ah vs Jam'iyyah) dan **jenjang pendidikan** (MI/SD, MTs/SMP, MA/SMA/SMK). Statistik ini akan ditampilkan sebagai card visual di bawah card statistik existing (Total Sekolah, Total Guru/PTK, Total Siswa, Total SK Terbit).

### Design Goals

1. **Seamless Integration**: Statistik baru harus terintegrasi dengan dashboard existing tanpa mengganggu layout atau performa
2. **Real-time Data**: Statistik dihitung dari database secara real-time dengan query yang efisien
3. **RBAC Compliance**: Menerapkan role-based access control yang sama dengan fitur existing
4. **Performance**: Query aggregation di database, bukan di application layer
5. **Responsive Design**: Layout yang adaptif untuk mobile, tablet, dan desktop

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DashboardPage.tsx                                    │  │
│  │  ├─ Existing Stats Cards (4 cards)                   │  │
│  │  ├─ NEW: SchoolStatisticsCards Component             │  │
│  │  │   ├─ AffiliationCard                              │  │
│  │  │   └─ JenjangCard                                  │  │
│  │  └─ DashboardCharts (existing)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ HTTP GET                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Laravel)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DashboardController.php                             │  │
│  │  ├─ stats() - existing                               │  │
│  │  ├─ schoolStats() - existing                         │  │
│  │  └─ NEW: getSchoolStatistics()                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  School Model + Query Builder                        │  │
│  │  - Aggregation queries with GROUP BY                 │  │
│  │  - Tenant scoping via HasTenantScope trait           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  schools table                                        │  │
│  │  ├─ status_jamiyyah (existing)                       │  │
│  │  └─ jenjang (NEW - needs migration)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User loads dashboard** → Frontend calls `GET /api/dashboard/school-statistics`
2. **Backend receives request** → DashboardController validates user role
3. **Query execution** → Aggregation query with GROUP BY on `status_jamiyyah` and `jenjang`
4. **Tenant scoping** → If operator, filter by `school_id`; if super_admin/admin_yayasan, show all
5. **Response** → JSON with counts for each category
6. **Frontend renders** → Display as card components below existing stats

---

## Components and Interfaces

### Frontend Components

#### 1. SchoolStatisticsCards Component

**Location**: `src/features/dashboard/components/SchoolStatisticsCards.tsx`

**Purpose**: Container component untuk menampilkan statistik afiliasi dan jenjang

**Props**:
```typescript
interface SchoolStatisticsCardsProps {
  data?: SchoolStatisticsData
  loading?: boolean
}

interface SchoolStatisticsData {
  affiliation: {
    jamaah: number
    jamiyyah: number
    undefined: number
  }
  jenjang: {
    mi_sd: number
    mts_smp: number
    ma_sma_smk: number
    lainnya: number
    undefined: number
  }
}
```

**Rendering Logic**:
- Grid layout: 2 columns on desktop, 1 column on mobile
- Each card shows category name, count, and percentage
- Loading state with skeleton
- Error state with fallback message

#### 2. AffiliationCard Sub-component

**Purpose**: Menampilkan statistik afiliasi sekolah

**Visual Design**:
```
┌─────────────────────────────────────────────┐
│ Statistik Afiliasi Sekolah                  │
├─────────────────────────────────────────────┤
│                                             │
│  Jama'ah / Afiliasi        150  (78.9%)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Jam'iyyah                  40  (21.1%)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Tidak Terdefinisi           0  (0%)       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Total: 190 sekolah                         │
└─────────────────────────────────────────────┘
```

**Styling**:
- Consistent with existing dashboard cards
- Tailwind classes: `bg-white`, `shadow-sm`, `rounded-2xl`, `border-slate-200`
- Progress bars with emerald color scheme
- Responsive text sizing

#### 3. JenjangCard Sub-component

**Purpose**: Menampilkan statistik jenjang pendidikan

**Visual Design**:
```
┌─────────────────────────────────────────────┐
│ Statistik Jenjang Pendidikan                │
├─────────────────────────────────────────────┤
│                                             │
│  MI / SD                    80  (42.1%)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  MTs / SMP                  60  (31.6%)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  MA / SMA / SMK             50  (26.3%)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Lainnya                     0  (0%)       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Total: 190 sekolah                         │
└─────────────────────────────────────────────┘
```

### Backend API

#### API Endpoint

**Route**: `GET /api/dashboard/school-statistics`

**Middleware**: `auth:sanctum`, `TenantScope`

**Controller**: `DashboardController@getSchoolStatistics`

**Request Parameters**: None (tenant scoping handled by middleware)

**Response Format**:
```json
{
  "success": true,
  "message": "School statistics retrieved successfully",
  "data": {
    "affiliation": {
      "jamaah": 150,
      "jamiyyah": 40,
      "undefined": 0
    },
    "jenjang": {
      "mi_sd": 80,
      "mts_smp": 60,
      "ma_sma_smk": 50,
      "lainnya": 0,
      "undefined": 0
    },
    "total": 190
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Failed to retrieve school statistics",
  "error": "Error details"
}
```

#### Controller Method

**Location**: `backend/app/Http/Controllers/Api/DashboardController.php`

**Method Signature**:
```php
public function getSchoolStatistics(Request $request): JsonResponse
```

**Implementation Logic**:
1. Get authenticated user
2. Determine tenant scope (operator vs super_admin/admin_yayasan)
3. Build base query with tenant filtering
4. Execute aggregation queries for affiliation and jenjang
5. Format response with counts and totals
6. Return JSON response

**Query Strategy**:
- Use `selectRaw()` with `CASE WHEN` for categorization
- Use `groupBy()` for aggregation
- Single query per statistic type (affiliation, jenjang)
- Leverage database indexes on `status_jamiyyah` and `jenjang`

---

## Data Models

### Database Schema Changes

#### Migration: Add `jenjang` Column to `schools` Table

**File**: `backend/database/migrations/2026_04_XX_XXXXXX_add_jenjang_to_schools_table.php`

**Migration Up**:
```php
Schema::table('schools', function (Blueprint $table) {
    $table->string('jenjang')->nullable()->after('status_jamiyyah');
    $table->index('jenjang'); // For query performance
});
```

**Migration Down**:
```php
Schema::table('schools', function (Blueprint $table) {
    $table->dropIndex(['jenjang']);
    $table->dropColumn('jenjang');
});
```

**Rationale**:
- Field `jenjang` sudah ada di `School` model `$fillable` tapi belum ada di database
- Perlu migration untuk menambahkan column dan index
- Index diperlukan untuk optimasi query aggregation

### School Model Updates

**Location**: `backend/app/Models/School.php`

**No changes needed** - `jenjang` sudah ada di `$fillable` array

**Existing Fillable**:
```php
protected $fillable = [
    'nsm', 'npsn', 'nama', 'alamat',
    'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
    'telepon', 'email', 'kepala_madrasah',
    'akreditasi', 'status', 'status_jamiyyah', 'npsm_nu', 'jenjang', // ← jenjang already here
    'kepala_nim', 'kepala_nuptk', 'kepala_whatsapp',
    'kepala_jabatan_mulai', 'kepala_jabatan_selesai',
];
```

### Data Categorization Logic

#### Afiliasi Categories

**Mapping**:
```
status_jamiyyah value → Category
─────────────────────────────────
"Jama'ah"             → jamaah
"Afiliasi"            → jamaah
"Jam'iyyah"           → jamiyyah
NULL or ""            → undefined
```

**SQL Logic**:
```sql
CASE
  WHEN LOWER(status_jamiyyah) IN ('jama''ah', 'afiliasi') THEN 'jamaah'
  WHEN LOWER(status_jamiyyah) = 'jam''iyyah' THEN 'jamiyyah'
  ELSE 'undefined'
END as category
```

#### Jenjang Categories

**Mapping**:
```
jenjang value (case-insensitive) → Category
────────────────────────────────────────────
Contains "MI" or "SD"             → mi_sd
Contains "MTs" or "SMP"           → mts_smp
Contains "MA" or "SMA" or "SMK"   → ma_sma_smk
NULL or ""                        → undefined
Other values                      → lainnya
```

**SQL Logic**:
```sql
CASE
  WHEN LOWER(jenjang) LIKE '%mi%' OR LOWER(jenjang) LIKE '%sd%' THEN 'mi_sd'
  WHEN LOWER(jenjang) LIKE '%mts%' OR LOWER(jenjang) LIKE '%smp%' THEN 'mts_smp'
  WHEN LOWER(jenjang) LIKE '%ma%' OR LOWER(jenjang) LIKE '%sma%' OR LOWER(jenjang) LIKE '%smk%' THEN 'ma_sma_smk'
  WHEN jenjang IS NULL OR jenjang = '' THEN 'undefined'
  ELSE 'lainnya'
END as category
```

---

## Error Handling

### Frontend Error Handling

**Scenarios**:
1. **API request fails** → Show error toast, display fallback message in cards
2. **Network timeout** → Retry with exponential backoff (React Query default)
3. **Invalid data format** → Log error, show "Data tidak tersedia"
4. **Loading state** → Show skeleton loaders

**Implementation**:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['school-statistics'],
  queryFn: () => dashboardApi.getSchoolStatistics(),
  retry: 2,
  staleTime: 5 * 60 * 1000, // 5 minutes
})

if (error) {
  toast.error('Gagal memuat statistik sekolah')
  return <ErrorFallback />
}
```

### Backend Error Handling

**Scenarios**:
1. **Database query fails** → Log error, return 500 with error message
2. **Unauthorized access** → Return 403 with appropriate message
3. **Invalid tenant scope** → Return 403 with "Access denied"

**Implementation**:
```php
try {
    // Query execution
    $affiliationStats = School::selectRaw(/* ... */)->get();
    
    return $this->successResponse([
        'affiliation' => $affiliationStats,
        // ...
    ]);
} catch (\Exception $e) {
    \Log::error('Failed to get school statistics', [
        'error' => $e->getMessage(),
        'user_id' => $request->user()->id,
    ]);
    
    return $this->errorResponse(
        'Failed to retrieve school statistics',
        500
    );
}
```

---

## Testing Strategy

### Unit Tests

#### Backend Unit Tests

**File**: `backend/tests/Unit/DashboardControllerTest.php`

**Test Cases**:
1. `test_get_school_statistics_returns_correct_structure()`
   - Verify response has `affiliation` and `jenjang` keys
   - Verify all category keys are present
   - Verify values are integers

2. `test_affiliation_categorization_logic()`
   - Create schools with different `status_jamiyyah` values
   - Verify correct categorization (jamaah, jamiyyah, undefined)

3. `test_jenjang_categorization_logic()`
   - Create schools with different `jenjang` values
   - Verify correct categorization (mi_sd, mts_smp, ma_sma_smk, lainnya, undefined)

4. `test_case_insensitive_matching()`
   - Create schools with mixed case jenjang values ("MI", "mi", "Mi")
   - Verify all are categorized correctly

5. `test_tenant_scoping_for_operator()`
   - Login as operator
   - Verify statistics only include operator's school

6. `test_global_access_for_super_admin()`
   - Login as super_admin
   - Verify statistics include all schools

7. `test_handles_null_and_empty_values()`
   - Create schools with NULL and empty string values
   - Verify they are categorized as "undefined"

8. `test_returns_zero_for_empty_categories()`
   - Create schools with only one category
   - Verify other categories return 0

#### Frontend Unit Tests

**File**: `src/features/dashboard/components/SchoolStatisticsCards.test.tsx`

**Test Cases**:
1. `test_renders_loading_state()`
   - Pass `loading={true}`
   - Verify skeleton loaders are displayed

2. `test_renders_affiliation_statistics()`
   - Pass mock data
   - Verify all affiliation categories are rendered
   - Verify counts and percentages are correct

3. `test_renders_jenjang_statistics()`
   - Pass mock data
   - Verify all jenjang categories are rendered
   - Verify counts and percentages are correct

4. `test_handles_zero_values()`
   - Pass data with zero counts
   - Verify "0 (0%)" is displayed correctly

5. `test_calculates_percentages_correctly()`
   - Pass data with known totals
   - Verify percentage calculations are accurate

6. `test_responsive_layout()`
   - Test at different viewport sizes
   - Verify grid layout changes appropriately

### Integration Tests

**File**: `backend/tests/Feature/DashboardStatisticsIntegrationTest.php`

**Test Cases**:
1. `test_end_to_end_statistics_flow()`
   - Seed database with test schools
   - Make API request
   - Verify response matches expected counts

2. `test_statistics_update_in_real_time()`
   - Get initial statistics
   - Create new school
   - Get statistics again
   - Verify count increased by 1

3. `test_performance_with_large_dataset()`
   - Seed 1000 schools
   - Measure API response time
   - Verify response time < 500ms

### Property-Based Testing

**Not applicable** for this feature because:
- This is primarily a data aggregation and display feature
- No complex business logic or transformations
- No universal properties that hold across all inputs
- Testing is better suited for example-based unit tests and integration tests

---

## Performance Considerations

### Database Query Optimization

**Strategy**:
1. **Use aggregation at database level** - `GROUP BY` instead of loading all records
2. **Add indexes** - Index on `status_jamiyyah` and `jenjang` columns
3. **Single query per statistic** - Avoid N+1 queries
4. **Leverage existing tenant scoping** - PostgreSQL RLS policies

**Query Example**:
```php
// Affiliation statistics
$affiliationStats = School::selectRaw("
    CASE
        WHEN LOWER(status_jamiyyah) IN ('jama''ah', 'afiliasi') THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) = 'jam''iyyah' THEN 'jamiyyah'
        ELSE 'undefined'
    END as category,
    COUNT(*) as count
")
->groupBy('category')
->pluck('count', 'category');

// Jenjang statistics
$jenjangStats = School::selectRaw("
    CASE
        WHEN LOWER(jenjang) LIKE '%mi%' OR LOWER(jenjang) LIKE '%sd%' THEN 'mi_sd'
        WHEN LOWER(jenjang) LIKE '%mts%' OR LOWER(jenjang) LIKE '%smp%' THEN 'mts_smp'
        WHEN LOWER(jenjang) LIKE '%ma%' OR LOWER(jenjang) LIKE '%sma%' OR LOWER(jenjang) LIKE '%smk%' THEN 'ma_sma_smk'
        WHEN jenjang IS NULL OR jenjang = '' THEN 'undefined'
        ELSE 'lainnya'
    END as category,
    COUNT(*) as count
")
->groupBy('category')
->pluck('count', 'category');
```

**Performance Targets**:
- API response time: < 500ms for up to 1000 schools
- Database query time: < 100ms
- Frontend render time: < 50ms

### Frontend Performance

**Optimization Strategies**:
1. **React Query caching** - Cache statistics for 5 minutes
2. **Memoization** - Use `useMemo` for percentage calculations
3. **Lazy loading** - Load statistics only when dashboard is visible
4. **Skeleton loaders** - Show loading state immediately

**React Query Configuration**:
```typescript
const { data } = useQuery({
  queryKey: ['school-statistics'],
  queryFn: () => dashboardApi.getSchoolStatistics(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
})
```

### Scalability

**Current Scale**: 190 schools
**Target Scale**: Up to 1000 schools
**Strategy**: Database aggregation ensures O(1) complexity regardless of dataset size

---

## Implementation Plan

### Phase 1: Database Migration
1. Create migration file for `jenjang` column
2. Run migration in development
3. Verify column and index are created
4. Test with sample data

### Phase 2: Backend API
1. Add `getSchoolStatistics()` method to `DashboardController`
2. Implement aggregation queries
3. Add route to `routes/api.php`
4. Write unit tests
5. Test with Postman/Insomnia

### Phase 3: Frontend Components
1. Create `SchoolStatisticsCards.tsx` component
2. Create `AffiliationCard` and `JenjangCard` sub-components
3. Add API service method to `dashboardApi`
4. Integrate into `DashboardPage.tsx`
5. Write component tests

### Phase 4: Integration & Testing
1. Run integration tests
2. Test with different user roles (operator, super_admin)
3. Test with edge cases (NULL values, empty data)
4. Performance testing with large dataset

### Phase 5: Deployment
1. Run migration in staging
2. Deploy backend changes
3. Deploy frontend changes
4. Verify in staging environment
5. Deploy to production

---

## Responsive Design

### Breakpoints

**Mobile** (< 768px):
- Stack cards vertically
- Full width cards
- Smaller font sizes
- Compact progress bars

**Tablet** (768px - 1024px):
- 2-column grid for statistics cards
- Medium font sizes
- Standard progress bars

**Desktop** (> 1024px):
- 2-column grid for statistics cards
- Large font sizes
- Full-width progress bars

### Tailwind Classes

**Container**:
```tsx
<div className="grid gap-6 md:grid-cols-2 mt-8">
  {/* Cards */}
</div>
```

**Card**:
```tsx
<Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
  <CardContent className="p-6 md:p-8">
    {/* Content */}
  </CardContent>
</Card>
```

**Progress Bar**:
```tsx
<div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
  <div 
    className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
    style={{ width: `${percentage}%` }} 
  />
</div>
```

---

## Security Considerations

### RBAC Implementation

**Role-Based Access**:
- **Super Admin**: Can view statistics for all schools
- **Admin Yayasan**: Can view statistics for all schools
- **Operator**: Can only view statistics for their own school

**Middleware Stack**:
```php
Route::get('dashboard/school-statistics', [DashboardController::class, 'getSchoolStatistics'])
    ->middleware(['auth:sanctum', 'TenantScope']);
```

**Tenant Scoping Logic**:
```php
public function getSchoolStatistics(Request $request): JsonResponse
{
    $user = $request->user();
    $query = School::query();
    
    // Apply tenant scoping for operators
    if ($user->role === 'operator' && $user->school_id) {
        $query->where('id', $user->school_id);
    }
    
    // Super admin and admin_yayasan see all schools
    // (no additional filtering needed)
    
    // Execute aggregation queries...
}
```

### Data Validation

**Input Validation**: None required (no user input)

**Output Validation**:
- Ensure all counts are non-negative integers
- Ensure percentages are between 0-100
- Ensure total matches sum of categories

---

## Monitoring and Logging

### Logging Strategy

**Log Events**:
1. API request received
2. Query execution time
3. Errors during query execution
4. Unauthorized access attempts

**Log Format**:
```php
\Log::info('School statistics requested', [
    'user_id' => $user->id,
    'role' => $user->role,
    'school_id' => $user->school_id,
    'execution_time_ms' => $executionTime,
]);
```

### Performance Monitoring

**Metrics to Track**:
- API response time (p50, p95, p99)
- Database query time
- Cache hit rate (React Query)
- Error rate

**Tools**:
- Laravel Telescope (development)
- Sentry (production errors)
- Database slow query log

---

## Deployment Checklist

- [ ] Create and test database migration
- [ ] Run migration in staging environment
- [ ] Implement backend API endpoint
- [ ] Write and run backend unit tests
- [ ] Implement frontend components
- [ ] Write and run frontend component tests
- [ ] Run integration tests
- [ ] Test with different user roles
- [ ] Test responsive design on multiple devices
- [ ] Performance testing with large dataset
- [ ] Code review
- [ ] Deploy to staging
- [ ] QA testing in staging
- [ ] Deploy to production
- [ ] Monitor logs and performance metrics
- [ ] Verify functionality in production

---

## Future Enhancements

### Potential Improvements

1. **Interactive Charts**: Replace progress bars with interactive pie/donut charts
2. **Drill-down Capability**: Click on category to see list of schools
3. **Export Functionality**: Export statistics as PDF/Excel
4. **Historical Trends**: Show statistics over time (monthly/yearly)
5. **Comparison View**: Compare statistics across different time periods
6. **Custom Filters**: Allow filtering by kecamatan, akreditasi, etc.
7. **Real-time Updates**: WebSocket-based real-time statistics updates

### Technical Debt

1. **Add `jenjang` field to school import/export**: Currently not included in Excel import
2. **Standardize jenjang values**: Create enum or validation rule for consistent values
3. **Add data migration script**: Populate `jenjang` for existing schools based on `nama` field

---

## Appendix

### API Contract

**Endpoint**: `GET /api/dashboard/school-statistics`

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response 200 OK**:
```json
{
  "success": true,
  "message": "School statistics retrieved successfully",
  "data": {
    "affiliation": {
      "jamaah": 150,
      "jamiyyah": 40,
      "undefined": 0
    },
    "jenjang": {
      "mi_sd": 80,
      "mts_smp": 60,
      "ma_sma_smk": 50,
      "lainnya": 0,
      "undefined": 0
    },
    "total": 190
  }
}
```

**Response 401 Unauthorized**:
```json
{
  "success": false,
  "message": "Unauthenticated"
}
```

**Response 403 Forbidden**:
```json
{
  "success": false,
  "message": "Access denied"
}
```

**Response 500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Failed to retrieve school statistics",
  "error": "Error details"
}
```

### Component File Structure

```
src/features/dashboard/
├── DashboardPage.tsx (modified)
├── components/
│   ├── DashboardCharts.tsx (existing)
│   ├── DashboardOperator.tsx (existing)
│   └── SchoolStatisticsCards.tsx (NEW)
│       ├── AffiliationCard.tsx (NEW)
│       └── JenjangCard.tsx (NEW)
└── __tests__/
    └── SchoolStatisticsCards.test.tsx (NEW)
```

### Backend File Structure

```
backend/
├── app/
│   ├── Http/
│   │   └── Controllers/
│   │       └── Api/
│   │           └── DashboardController.php (modified)
│   └── Models/
│       └── School.php (no changes)
├── database/
│   └── migrations/
│       └── 2026_04_XX_XXXXXX_add_jenjang_to_schools_table.php (NEW)
├── routes/
│   └── api.php (modified)
└── tests/
    ├── Unit/
    │   └── DashboardControllerTest.php (NEW)
    └── Feature/
        └── DashboardStatisticsIntegrationTest.php (NEW)
```

---

## Summary

Fitur dashboard school statistics menambahkan dua statistik baru (afiliasi dan jenjang) yang ditampilkan sebagai card visual di dashboard. Implementasi menggunakan:

- **Database aggregation** untuk performa optimal
- **Tenant scoping** untuk RBAC compliance
- **Responsive design** untuk semua ukuran layar
- **React Query** untuk caching dan state management
- **Consistent styling** dengan dashboard existing

Fitur ini memerlukan:
1. Database migration untuk menambahkan column `jenjang`
2. Backend API endpoint baru
3. Frontend component baru
4. Unit dan integration tests

Estimasi waktu implementasi: **2-3 hari** (1 hari backend, 1 hari frontend, 0.5-1 hari testing & integration).
