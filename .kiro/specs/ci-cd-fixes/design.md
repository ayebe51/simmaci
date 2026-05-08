# Design: CI/CD Fixes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Axios Client (src/lib/api.ts)                       │   │
│  │  - Authorization: Bearer {token}                     │   │
│  │  - CORS headers                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP Request
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Laravel 12)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes (routes/api.php)                             │   │
│  │  - GET /sk-templates/active                          │   │
│  │  - GET /sk-templates/{id}/download                   │   │
│  │  - Middleware: auth:sanctum                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                    │   │
│  │  - auth:sanctum (verify token)                       │   │
│  │  - CheckRole (verify role)                           │   │
│  │  - TenantScope (set school_id)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SkTemplateController                                │   │
│  │  - active() — resolve active template                │   │
│  │  - download() — stream file to client                │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SkTemplateService                                   │   │
│  │  - resolveActiveTemplate()                           │   │
│  │  - getDownloadUrl()                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Storage (Laravel Storage)                           │   │
│  │  - Disk: local / S3-compatible                       │   │
│  │  - File path: storage/sk-templates/{id}/{filename}   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP Response
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  - Receive file blob                                        │
│  - Trigger download                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. MeetingRepositoryInterface Fix

### Current State
```php
// Interface
interface MeetingRepositoryInterface extends BaseRepositoryInterface {
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator;
    public function findBySchoolId(int $schoolId): Collection;
}

// Implementation
class MeetingRepository extends BaseRepository implements MeetingRepositoryInterface {
    public function paginate(...) { ... }
    public function findBySchoolId(...) { ... }
    public function findById(...) { ... }  // NOT in interface
    public function create(...) { ... }    // NOT in interface
    public function update(...) { ... }    // NOT in interface
    public function delete(...) { ... }    // NOT in interface
}
```

### Problem
- Interface hanya mendefinisikan 2 method, tapi implementasi memiliki 6 method
- Ini melanggar LSP karena consumer yang expect interface tidak tahu tentang method tambahan
- Namun, ini sebenarnya OK karena method tambahan tidak di-expose di interface

### Solution
- Verifikasi bahwa interface hanya mendefinisikan method yang benar-benar diperlukan
- Verifikasi implementasi tidak override method dari parent interface dengan signature yang berbeda
- Pastikan semua method di interface compatible dengan parent `BaseRepositoryInterface`

### Implementation Details
1. **Verify Interface Compliance**
   - Check `MeetingRepositoryInterface` extends `BaseRepositoryInterface`
   - Check all methods in interface are implemented in `MeetingRepository`
   - Check no method override with different signature

2. **Verify Parent Interface**
   - Check `BaseRepositoryInterface` defines base methods
   - Check `MeetingRepository` extends `BaseRepository` correctly

3. **Verify Service Layer**
   - Check `MeetingService` uses interface correctly
   - Check no direct dependency on implementation

---

## 2. Download Template Surat Permohonan Fix

### Current State
```
Frontend Request:
  GET /api/sk-templates/active?sk_type=SURAT_PERMOHONAN
  Headers: Authorization: Bearer {token}

Backend Response:
  200 OK
  {
    "success": true,
    "data": {
      "id": 1,
      "sk_type": "SURAT_PERMOHONAN",
      "original_filename": "template.docx",
      "file_url": "/api/sk-templates/1/download"
    }
  }

Frontend Request:
  GET /api/sk-templates/1/download
  Headers: Authorization: Bearer {token}

Backend Response:
  200 OK
  Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  Content-Disposition: attachment; filename="template.docx"
  [file content]
```

### Problem Analysis
1. **Authorization Header Handling**
   - Frontend sends: `Authorization: Bearer {token}`
   - Backend expects: Sanctum token in Authorization header
   - Middleware `auth:sanctum` should verify token

2. **CORS Headers**
   - Frontend may be blocked by CORS if Authorization header not allowed
   - Need to verify CORS middleware allows Authorization header

3. **File Storage**
   - File may not exist in storage
   - Path may be incorrect
   - Disk configuration may be wrong

4. **Response Headers**
   - Content-Disposition header must be set correctly for download
   - Content-Type must match file type

### Solution Design

#### Step 1: Verify Routes Protection
```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('sk-templates', [SkTemplateController::class, 'index']);
    Route::get('sk-templates/active', [SkTemplateController::class, 'active']);
    Route::get('sk-templates/{id}/download', [SkTemplateController::class, 'download']);
});
```

#### Step 2: Verify Middleware Stack
```php
// Middleware order:
1. auth:sanctum — verify token
2. CheckRole — verify role (if needed)
3. TenantScope — set school_id (if needed)
```

#### Step 3: Verify Authorization Header Handling
```php
// In SkTemplateController
public function active(Request $request): JsonResponse {
    // $request->user() should return authenticated user
    // If null, token is invalid or missing
    $user = $request->user();
    if (!$user) {
        return $this->errorResponse('Unauthorized', null, 401);
    }
    // ... rest of logic
}
```

#### Step 4: Verify CORS Headers
```php
// In config/cors.php or middleware
'allowed_headers' => ['*'],  // or specific headers
'exposed_headers' => ['Content-Disposition', 'Content-Type'],
```

#### Step 5: Verify File Storage
```php
// In SkTemplateController::download()
$disk = Storage::disk($skTemplate->disk);
if (!$disk->exists($skTemplate->file_path)) {
    return $this->errorResponse('File not found', null, 404);
}
$content = $disk->get($skTemplate->file_path);
```

#### Step 6: Verify Response Headers
```php
// In SkTemplateController::download()
return response($content, 200, [
    'Content-Type' => $mimeType,
    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
    'Content-Length' => strlen($content),
    'Cache-Control' => 'private, no-store',
]);
```

---

## 3. Frontend Implementation

### Axios Client Configuration
```typescript
// src/lib/api.ts
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Authorization header interceptor
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

### Download Template Function
```typescript
// src/features/sk-management/services/skTemplateService.ts
export async function downloadTemplate(templateId: number, filename: string) {
    try {
        const response = await apiClient.get(
            `/sk-templates/${templateId}/download`,
            {
                responseType: 'blob',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                },
            }
        );
        
        // Create blob and trigger download
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
}
```

---

## 4. Testing Strategy

### Backend Tests
```php
// tests/Feature/SkTemplateControllerTest.php
public function test_authenticated_user_can_download_template() {
    $user = User::factory()->create();
    $template = SkTemplate::factory()->create();
    
    $response = $this->actingAs($user, 'sanctum')
        ->get("/api/sk-templates/{$template->id}/download");
    
    $response->assertStatus(200);
    $response->assertHeader('Content-Disposition');
}

public function test_unauthenticated_user_cannot_download_template() {
    $template = SkTemplate::factory()->create();
    
    $response = $this->get("/api/sk-templates/{$template->id}/download");
    
    $response->assertStatus(401);
}
```

### Frontend Tests
```typescript
// src/features/sk-management/__tests__/skTemplateService.test.ts
describe('downloadTemplate', () => {
    it('should download template with valid token', async () => {
        // Mock localStorage
        localStorage.setItem('auth_token', 'valid-token');
        
        // Mock axios
        vi.mocked(apiClient.get).mockResolvedValue({
            data: new Blob(['file content']),
        });
        
        // Call function
        await downloadTemplate(1, 'template.docx');
        
        // Verify
        expect(apiClient.get).toHaveBeenCalledWith(
            '/sk-templates/1/download',
            expect.objectContaining({
                responseType: 'blob',
            })
        );
    });
});
```

### CI/CD Pipeline
```yaml
# .github/workflows/main.yml
- name: Run Backend Tests
  run: php artisan test

- name: Run Frontend Lint
  run: npm run lint

- name: Build Frontend
  run: npm run build
```

---

## 5. Error Handling

### Backend Error Responses
```json
// 401 Unauthorized
{
    "success": false,
    "message": "Unauthorized.",
    "data": null
}

// 403 Forbidden
{
    "success": false,
    "message": "Forbidden: You do not have the required role.",
    "data": null
}

// 404 Not Found
{
    "success": false,
    "message": "File template tidak ditemukan di storage.",
    "data": null
}

// 422 Unprocessable Entity
{
    "success": false,
    "message": "Parameter sk_type wajib diisi.",
    "data": null
}
```

### Frontend Error Handling
```typescript
try {
    await downloadTemplate(templateId, filename);
} catch (error) {
    if (error.response?.status === 401) {
        // Redirect to login
        navigate('/login');
    } else if (error.response?.status === 403) {
        // Show permission error
        toast.error('Anda tidak memiliki akses untuk download template ini');
    } else if (error.response?.status === 404) {
        // Show not found error
        toast.error('Template tidak ditemukan');
    } else {
        // Show generic error
        toast.error('Gagal download template');
    }
}
```

---

## 6. Deployment Checklist

- [ ] Verify MeetingRepositoryInterface compliance
- [ ] Verify routes protected with auth:sanctum
- [ ] Verify CORS headers allow Authorization
- [ ] Verify file storage configuration
- [ ] Verify response headers for download
- [ ] Run backend tests
- [ ] Run frontend tests
- [ ] Run CI/CD pipeline
- [ ] Test download in browser
- [ ] Test with invalid token
- [ ] Test with missing file
- [ ] Monitor logs for errors
