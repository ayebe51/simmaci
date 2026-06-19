<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Only super_admin should access this (handled by middleware or policy)
        $query = Staff::with('user');

        if ($request->search) {
            $query->whereRaw('LOWER(nama) LIKE LOWER(?)', ["%{$request->search}%"]);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $staffs = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 25));

        return response()->json($staffs);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nama' => 'required|string|max:255',
            'jabatan' => 'nullable|string|max:255',
            'divisi' => 'nullable|string|max:255',
            'telepon' => 'nullable|string|max:255',
            'email' => 'nullable|email|unique:users,email',
            'password' => 'nullable|string|min:6',
        ]);

        $userId = null;
        if ($request->email && $request->password) {
            $user = User::create([
                'name' => $request->nama,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'staff',
                'is_active' => true,
            ]);
            $userId = $user->id;
        }

        $staff = Staff::create([
            'user_id' => $userId,
            'nama' => $request->nama,
            'jabatan' => $request->jabatan,
            'divisi' => $request->divisi,
            'telepon' => $request->telepon,
            'qr_code' => Str::uuid()->toString(),
        ]);

        return $this->successResponse($staff->load('user'), 'Staff berhasil ditambahkan.', 201);
    }

    public function update(Request $request, Staff $staff): JsonResponse
    {
        $request->validate([
            'nama' => 'required|string|max:255',
            'jabatan' => 'nullable|string|max:255',
            'divisi' => 'nullable|string|max:255',
            'telepon' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $staff->update($request->only(['nama', 'jabatan', 'divisi', 'telepon', 'is_active']));

        if ($staff->user) {
            $staff->user->update([
                'name' => $request->nama,
                'is_active' => $request->boolean('is_active', $staff->is_active),
            ]);
        }

        return $this->successResponse($staff->load('user'), 'Staff berhasil diperbarui.');
    }

    public function destroy(Staff $staff): JsonResponse
    {
        if ($staff->user) {
            $staff->user->delete();
        }
        $staff->delete();

        return $this->successResponse(null, 'Staff berhasil dihapus.');
    }

    public function generateQr(Staff $staff): JsonResponse
    {
        $staff->update(['qr_code' => Str::uuid()->toString()]);
        return $this->successResponse(['qr_code' => $staff->qr_code], 'QR Code berhasil di-generate ulang.');
    }

    public function saveFace(Request $request, Staff $staff): JsonResponse
    {
        $request->validate([
            'face_descriptor' => 'required|array',
        ]);

        $staff->update([
            'face_descriptor' => json_encode($request->face_descriptor),
        ]);

        return $this->successResponse(null, 'Data wajah berhasil disimpan.');
    }
}
