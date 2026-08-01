<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Event extends Model
{
    use HasTenantScope, AuditLogTrait, SoftDeletes;

    protected $fillable = [
        'school_id',
        'name',
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

    public function competitions()
    {
        return $this->hasMany(Competition::class);
    }

    public function anugerahRegistrations()
    {
        return $this->hasMany(AnugerahRegistration::class);
    }
}
