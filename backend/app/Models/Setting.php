<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['key', 'value', 'storage_id', 'mime_type', 'school_id'];

    public function school() { return $this->belongsTo(School::class); }

    public static function getValue(string $key, ?int $schoolId = null): ?string
    {
        return static::withoutTenantScope()
            ->where('key', $key)
            ->when($schoolId, fn($q) => $q->where('school_id', $schoolId))
            ->value('value');
    }

    public static function setValue(string $key, ?string $value, ?int $schoolId = null): void
    {
        static::withoutTenantScope()->updateOrCreate(
            ['key' => $key, 'school_id' => $schoolId],
            ['value' => $value]
        );
    }
}
