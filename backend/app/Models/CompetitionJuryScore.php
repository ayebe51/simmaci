<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompetitionJuryScore extends Model
{
    protected $fillable = [
        'competition_id',
        'participant_id',
        'anugerah_registration_id',
        'jury_name',
        'score',
        'score_breakdown',
        'notes',
    ];

    protected $casts = [
        'score'           => 'decimal:2',
        'score_breakdown' => 'array',
    ];

    public function competition()
    {
        return $this->belongsTo(Competition::class);
    }

    public function participant()
    {
        return $this->belongsTo(CompetitionParticipant::class, 'participant_id');
    }

    public function anugerahRegistration()
    {
        return $this->belongsTo(AnugerahRegistration::class, 'anugerah_registration_id');
    }
}
