<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    private function isSensitiveKey(string $key): bool
    {
        return (bool) preg_match('/pin|secret|token|password|api_key|private|wa_blast|credential|gateway|master_key|scanner/i', $key);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = $user?->isOperator() ? $user->school_id : null;

        $query = Setting::withoutTenantScope()
            ->when($schoolId, fn($q) => $q->where('school_id', $schoolId));

        $isPrivilegedAdmin = in_array($user?->role, ['super_admin', 'admin_yayasan'], true);

        if (! $isPrivilegedAdmin) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'not ilike' : 'not like';
            $query->where(function ($q) use ($like) {
                $q->where('key', $like, '%pin%')
                  ->where('key', $like, '%secret%')
                  ->where('key', $like, '%token%')
                  ->where('key', $like, '%password%')
                  ->where('key', $like, '%credential%')
                  ->where('key', $like, '%gateway%')
                  ->where('key', $like, '%master_key%')
                  ->where('key', $like, '%api_key%');
            });
        }

        $settings = $query->get()->keyBy('key');

        return response()->json($settings);
    }

    public function show(string $key, Request $request): JsonResponse
    {
        $user = $request->user();
        if ($this->isSensitiveKey($key) && ! in_array($user?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Akses ditolak: Parameter pengaturan ini bersifat rahasia.');
        }

        $schoolId = $user?->isOperator() ? $user->school_id : null;

        $value = Setting::getValue($key, $schoolId);

        return response()->json(['key' => $key, 'value' => $value]);
    }

    /**
     * POST /settings — Upsert a setting (store OR update).
     * Accepts: { key, value, school_id? }
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'key'   => 'required|string|max:255',
            'value' => 'nullable',
        ]);

        $user = $request->user();
        if (! in_array($user?->role, ['super_admin', 'admin_yayasan'], true) && $this->isSensitiveKey($request->key)) {
            abort(403, 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah konfigurasi rahasia.');
        }

        $schoolId = $user?->isOperator()
            ? $user->school_id
            : $request->input('school_id');

        Setting::setValue($request->key, $request->value, $schoolId);

        return response()->json(['success' => true]);
    }

    /**
     * PUT /settings/{setting} — also upsert (legacy route support).
     */
    public function update(Request $request): JsonResponse
    {
        return $this->store($request);
    }
}
