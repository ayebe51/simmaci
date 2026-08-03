<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Event extends Model
{
    use HasTenantScope, AuditLogTrait, SoftDeletes;

    protected $fillable = [
        'school_id',
        'name',
        'slug',
        'category',
        'type',
        'date',
        'location',
        'description',
        'status',
        'registration_start',
        'registration_end',
        'video_deadline',
        'announcement_date',
        'announcement_place',
        'contact_name',
        'contact_phone',
    ];

    protected $casts = [
        'date'               => 'date',
        'registration_start' => 'date',
        'registration_end'   => 'date',
        'video_deadline'     => 'datetime',
        'announcement_date'  => 'date',
    ];

    /**
     * Auto-generate unique slug when creating if not provided.
     */
    protected static function booted(): void
    {
        static::creating(function (Event $event) {
            if (empty($event->slug)) {
                $event->slug = static::generateUniqueSlug($event->name);
            }
        });

        static::updating(function (Event $event) {
            if ($event->isDirty('name') && empty($event->slug)) {
                $event->slug = static::generateUniqueSlug($event->name);
            }
        });
    }

    public static function generateUniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $i    = 1;

        while (static::withoutTrashed()->where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    public function competitions()
    {
        return $this->hasMany(Competition::class);
    }

    public function anugerahRegistrations()
    {
        return $this->hasMany(AnugerahRegistration::class);
    }
}
