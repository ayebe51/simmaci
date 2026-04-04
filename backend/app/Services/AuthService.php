<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService extends BaseService
{
    /** @var UserRepositoryInterface */
    protected $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
        parent::__construct($userRepository);
    }

    /**
     * Attempt login and return user + token
     */
    public function login(array $credentials, string $ip): array
    {
        $user = $this->userRepository->findByEmail($credentials['email']);

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Kredensial tidak valid.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Akun tidak aktif.'],
            ]);
        }

        // Revoke old tokens (single device)
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;

        ActivityLog::log(
            description: "User {$user->name} logged in from {$ip}",
            event: 'login',
            logName: 'auth',
            causer: $user,
            schoolId: $user->school_id
        );

        return [
            'user' => $this->formatUserResponse($user),
            'token' => $token,
        ];
    }

    /**
     * Logout user
     */
    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    /**
     * Format user for API response (CamelCase)
     */
    public function formatUserResponse(User $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'role' => $user->role,
            'unitKerja' => $user->unit,
            'schoolId' => $user->school_id,
            'isActive' => (bool)$user->is_active,
        ];
    }
}
