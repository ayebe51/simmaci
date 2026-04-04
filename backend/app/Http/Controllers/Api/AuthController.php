<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\School;
use App\Models\User;
use App\Services\AuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    use ApiResponse;

    public function __construct(protected AuthService $authService) {}

    /**
     * POST /api/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $data = $this->authService->login(
            $request->validated(),
            $request->ip()
        );

        return $this->successResponse($data, 'Login sukses.');
    }

    /**
     * POST /api/auth/register
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Resolve school_id from unit name
        $schoolId = null;
        if (isset($validated['unit'])) {
            $school = School::where('nama', $validated['unit'])->first()
                ?? School::where('nsm', $validated['unit'])->first();
            $schoolId = $school?->id;
        }

        $user = User::create([
            'email' => $validated['email'],
            'name' => $validated['name'],
            'password' => $validated['password'],
            'role' => $validated['role'] ?? 'operator',
            'unit' => $validated['unit'] ?? null,
            'school_id' => $schoolId,
            'is_active' => true,
        ]);

        return $this->successResponse([
            'userId' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
        ], 'Registrasi sukses.', 201);
    }

    /**
     * GET /api/auth/user
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        return $this->successResponse($this->authService->formatUserResponse($user));
    }

    /**
     * POST /api/auth/change-password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'old_password' => 'required|string',
            'new_password' => 'required|string|min:6',
        ]);

        $user = $request->user();

        if (! Hash::check($request->old_password, $user->password)) {
            return $this->errorResponse('Password lama salah.', ['old_password' => ['Password lama salah.']], 422);
        }

        $user->update(['password' => $request->new_password]);

        return $this->successResponse(null, 'Password berhasil diubah.');
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return $this->successResponse(null, 'Logout sukses.');
    }
}
