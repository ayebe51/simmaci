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
     * - Super Admin: check uniqueness globally (no school_id filter)
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

        // Operator: scope to their school_id
        if ($user && ! $user->isSuperAdmin() && $user->school_id) {
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
