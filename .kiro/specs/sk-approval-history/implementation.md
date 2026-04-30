# Implementasi Riwayat Aktivitas SK

## 📋 Ringkasan

Fitur riwayat aktivitas SK telah berhasil diimplementasikan untuk mencatat dan menampilkan timeline persetujuan dokumen SK.

## 🔧 Perubahan Backend

### 1. Controller: `SkDocumentController.php`

**Import yang ditambahkan:**
```php
use App\Models\ApprovalHistory;
```

**Method yang dimodifikasi:**

#### a. `store()` - SK Baru
Menambahkan logging approval history saat SK pertama kali dibuat:
```php
ApprovalHistory::create([
    'school_id'         => $sk->school_id,
    'document_id'       => $sk->id,
    'document_type'     => 'sk_document',
    'action'            => 'submit',
    'from_status'       => null,
    'to_status'         => $data['status'] ?? 'draft',
    'performed_by'      => $request->user()->id,
    'performed_at'      => now(),
    'comment'           => null,
    'metadata'          => [
        'performed_by_name' => $request->user()->name,
        'performed_by_role' => $request->user()->role,
    ],
]);
```

#### b. `update()` - Perubahan Status
Menambahkan logging saat status SK berubah ke `approved` atau `rejected`:
```php
if ($oldStatus !== $newStatus && in_array($newStatus, ['approved', 'rejected'])) {
    $rejectionReason = $request->input('rejection_reason') ?? $skDocument->rejection_reason;
    ApprovalHistory::create([
        'school_id'         => $skDocument->school_id,
        'document_id'       => $skDocument->id,
        'document_type'     => 'sk_document',
        'action'            => $newStatus === 'approved' ? 'approve' : 'reject',
        'from_status'       => $oldStatus,
        'to_status'         => $newStatus,
        'performed_by'      => $request->user()->id,
        'performed_at'      => now(),
        'comment'           => $rejectionReason,
        'metadata'          => [
            'performed_by_name' => $request->user()->name,
            'performed_by_role' => $request->user()->role,
            'rejection_reason'  => $rejectionReason,
        ],
    ]);
}
```

#### c. `batchUpdateStatus()` - Batch Approval/Rejection
Menambahkan logging untuk setiap SK dalam batch operation:
```php
ApprovalHistory::create([
    'school_id'         => $sk->school_id,
    'document_id'       => $sk->id,
    'document_type'     => 'sk_document',
    'action'            => $request->status === 'approved' ? 'approve' : 'reject',
    'from_status'       => $sk->getOriginal('status'),
    'to_status'         => $request->status,
    'performed_by'      => $user->id,
    'performed_at'      => now(),
    'comment'           => $request->rejection_reason,
    'metadata'          => [
        'performed_by_name' => $user->name,
        'performed_by_role' => $user->role,
        'rejection_reason'  => $request->rejection_reason,
    ],
]);
```

#### d. `submitRequest()` - Pengajuan SK Individual
Menambahkan logging saat SK diajukan dengan status `pending`:
```php
ApprovalHistory::create([
    'school_id'         => $schoolId,
    'document_id'       => $sk->id,
    'document_type'     => 'sk_document',
    'action'            => 'submit',
    'from_status'       => null,
    'to_status'         => 'pending',
    'performed_by'      => $request->user()->id,
    'performed_at'      => now(),
    'comment'           => null,
    'metadata'          => [
        'performed_by_name' => $request->user()->name,
        'performed_by_role' => $request->user()->role,
    ],
]);
```

#### e. `bulkRequest()` - Bulk Submission
Menambahkan logging untuk setiap SK dalam bulk submission:
```php
ApprovalHistory::create([
    'school_id'         => $schoolId,
    'document_id'       => $sk->id,
    'document_type'     => 'sk_document',
    'action'            => 'submit',
    'from_status'       => null,
    'to_status'         => 'pending',
    'performed_by'      => $request->user()->id,
    'performed_at'      => now(),
    'comment'           => null,
    'metadata'          => [
        'performed_by_name' => $request->user()->name,
        'performed_by_role' => $request->user()->role,
        'bulk_submission'   => true,
    ],
]);
```

### 2. Model: `ApprovalHistory.php`

Model sudah ada dengan struktur:
```php
protected $fillable = [
    'school_id', 'document_id', 'document_type', 'action',
    'from_status', 'to_status', 'performed_by',
    'performed_at', 'comment', 'metadata',
];
```

### 3. Controller: `ApprovalHistoryController.php`

Endpoint sudah tersedia:
```php
GET /api/approval-history?document_id={id}&document_type=sk_document
```

### 4. Routes: `api.php`

Route sudah terdaftar:
```php
Route::get('approval-history', [ApprovalHistoryController::class, 'index']);
```

## 🎨 Perubahan Frontend

### 1. Komponen: `ApprovalTimeline.tsx`

Komponen sudah ada di `src/components/approval/ApprovalTimeline.tsx` dengan fitur:
- Timeline visual dengan icon untuk setiap aksi (submit, approve, reject)
- Nama user dan role yang melakukan aksi
- Waktu relatif (e.g., "2 jam yang lalu")
- Komentar atau alasan rejection
- Badge status untuk setiap perubahan
- Loading state dan empty state

### 2. Integrasi ke `SkDetailPage.tsx`

**Import yang ditambahkan:**
```typescript
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
```

**Card baru yang ditambahkan:**
```tsx
{/* Riwayat Aktivitas / Approval History */}
<Card className="border-0 shadow-sm rounded-[2.5rem] overflow-hidden">
  <CardHeader className="p-8 pb-6 bg-slate-50/50 border-b">
    <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800">
      Riwayat Aktivitas
    </CardTitle>
    <CardDescription className="text-xs font-medium text-slate-500">
      Timeline persetujuan dan perubahan status dokumen SK
    </CardDescription>
  </CardHeader>
  <CardContent className="p-8">
    <ApprovalTimeline documentId={id!} />
  </CardContent>
</Card>
```

### 3. API Client: `api.ts`

API client sudah ada:
```typescript
export const approvalApi = {
  getHistory: (documentId: string, documentType?: string) =>
    apiClient.get('/approval-history', { 
      params: { document_id: documentId, document_type: documentType } 
    }).then((r) => r.data),
};
```

## 📊 Struktur Data

### Approval History Record

```typescript
{
  id: number
  school_id: number
  document_id: string
  document_type: 'sk_document'
  action: 'submit' | 'approve' | 'reject'
  from_status: string | null
  to_status: string
  performed_by: number
  performed_at: datetime
  comment: string | null
  metadata: {
    performed_by_name: string
    performed_by_role: string
    rejection_reason?: string
    bulk_submission?: boolean
  }
}
```

## 🎯 Aksi yang Dicatat

1. **Submit** - Saat SK pertama kali dibuat atau diajukan
   - `from_status`: null
   - `to_status`: 'draft' atau 'pending'
   - `action`: 'submit'

2. **Approve** - Saat SK disetujui
   - `from_status`: 'pending' atau 'draft'
   - `to_status`: 'approved'
   - `action`: 'approve'

3. **Reject** - Saat SK ditolak
   - `from_status`: 'pending' atau 'draft'
   - `to_status`: 'rejected'
   - `action`: 'reject'
   - `comment`: Alasan penolakan

## 🔍 Cara Menggunakan

### Untuk User

1. Buka halaman detail SK: `/dashboard/sk/{id}`
2. Scroll ke bawah untuk melihat card "Riwayat Aktivitas"
3. Timeline akan menampilkan semua perubahan status SK secara kronologis

### Untuk Developer

**Menambahkan ApprovalTimeline ke halaman lain:**

```tsx
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline"

// Di dalam component
<ApprovalTimeline documentId={skId} />
```

**Query approval history secara manual:**

```typescript
import { approvalApi } from "@/lib/api"

const { data: history } = useQuery({
  queryKey: ['approval-history', documentId],
  queryFn: () => approvalApi.getHistory(documentId, 'sk_document')
})
```

## ✅ Testing

### Manual Testing

1. **Test Submit:**
   - Buat SK baru → Cek riwayat aktivitas → Harus ada entry "Submission"

2. **Test Approve:**
   - Setujui SK → Cek riwayat aktivitas → Harus ada entry "Approval Granted"

3. **Test Reject:**
   - Tolak SK dengan alasan → Cek riwayat aktivitas → Harus ada entry "Request Denied" dengan komentar

4. **Test Batch:**
   - Batch approve/reject beberapa SK → Cek riwayat masing-masing → Semua harus tercatat

### Database Check

```sql
-- Cek approval history untuk SK tertentu
SELECT * FROM approval_histories 
WHERE document_id = 123 
AND document_type = 'sk_document'
ORDER BY performed_at DESC;

-- Cek statistik approval history
SELECT action, COUNT(*) as total
FROM approval_histories
WHERE document_type = 'sk_document'
GROUP BY action;
```

## 🐛 Troubleshooting

### Riwayat tidak muncul

1. **Cek backend:**
   ```bash
   # Cek log Laravel
   tail -f backend/storage/logs/laravel.log
   
   # Cek database
   SELECT COUNT(*) FROM approval_histories;
   ```

2. **Cek frontend:**
   - Buka DevTools → Network → Cek request ke `/api/approval-history`
   - Cek Console untuk error

3. **Cek route:**
   ```bash
   cd backend
   php artisan route:list | grep approval
   ```

### Data lama tidak ada riwayat

Data SK yang dibuat sebelum implementasi ini tidak akan memiliki riwayat aktivitas. Ini normal karena logging baru dimulai setelah implementasi.

## 📝 Catatan

- Approval history hanya dicatat untuk perubahan status yang signifikan (submit, approve, reject)
- Perubahan data lain (seperti edit nama, jabatan) tidak dicatat di approval history, tapi tetap tercatat di `activity_logs`
- Metadata disimpan dalam format JSON untuk fleksibilitas
- Tenant scoping otomatis diterapkan melalui trait `HasTenantScope`

## 🚀 Future Enhancements

1. **Filter & Search** - Tambahkan filter berdasarkan action atau user
2. **Export** - Export riwayat ke PDF atau Excel
3. **Notifications** - Notifikasi real-time saat ada perubahan status
4. **Audit Trail** - Integrasi dengan sistem audit yang lebih komprehensif
5. **Rollback** - Kemampuan untuk rollback status SK ke versi sebelumnya
