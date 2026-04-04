<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('school');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('email', 'ilike', "%{$request->search}%");
            });
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->integer('per_page', 25))
        );
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('school'));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => 'nullable|string|in:super_admin,admin_yayasan,operator',
            'unit' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'password' => 'nullable|string|min:6',
        ]);

        if (isset($data['password'])) {
            $data['password'] = $data['password']; // Auto-hashed by User model
        }

        $user->update($data);
        return response()->json($user->fresh());
    }

    public function destroy(User $user): JsonResponse
    {
        $user->update(['is_active' => false]);
        return response()->json(['success' => true]);
    }
}
