<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaffAttendance extends Model
{
    use HasFactory;

    protected $table = 'staff_attendances';

    protected $fillable = [
        'staff_id',
        'tanggal',
        'jam_masuk',
        'jam_pulang',
        'status',
        'latitude',
        'longitude',
        'location_verified',
        'photo_proof',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'latitude' => 'float',
            'longitude' => 'float',
            'location_verified' => 'boolean',
        ];
    }

    public function staff()
    {
        return $this->belongsTo(Staff::class);
    }
}
