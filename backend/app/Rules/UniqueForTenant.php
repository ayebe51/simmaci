<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;

class UniqueForTenant implements ValidationRule
{
    public function __construct(
        private string $table,
        private string $column,
        private ?int $ignoreId = null,
        private string $ignoreColumn = 'id'
    ) {}

    /**
     * Run the validation rule.
     *
     * - Operator: check uniqueness within the same school_id
     * - Super Admin & Admin Yayasan: check uniqueness globally (no school_id filter)
     * - Update: exclude the record being updated via ignoreId
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_null($value)) {
            return; // null values are allowed — use 'required' rule separately
        }

        $user = auth()->user();

        $query = DB::table($this->table)
            ->where($this->column, $value)
            ->whereNull('deleted_at');

        if ($this->column === 'nisn') {
            $existing = DB::table($this->table)
                ->where($this->column, $value)
                ->whereNull('deleted_at')
                ->when(! is_null($this->ignoreId), fn($q) => $q->where($this->ignoreColumn, '!=', $this->ignoreId))
                ->first();

            if ($existing) {
                if ($user && $user->school_id && (int) $existing->school_id !== (int) $user->school_id) {
                    $fail("Konflik Kepemilikan Data: Siswa dengan NISN ini sudah terdaftar pada madrasah lain. Mutasi resmi diperlukan.");
                } else {
                    $fail("NISN sudah terdaftar.");
                }
            }
            return;
        }

        // Operator: scope to their school_id
        // Super Admin & Admin Yayasan: no scoping (global uniqueness check)
        if ($user && ! in_array($user->role, ['super_admin', 'admin_yayasan'], true) && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        // Exclude the current record on update
        if (! is_null($this->ignoreId)) {
            $query->where($this->ignoreColumn, '!=', $this->ignoreId);
        }

        if ($query->exists()) {
            $fail("The :attribute has already been taken.");
        }
    }
}
