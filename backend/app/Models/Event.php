<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'school_id', 'name', 'category', 'type', 'date', 'location', 'description',
    ];
}
