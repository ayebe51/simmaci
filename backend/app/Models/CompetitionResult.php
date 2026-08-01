<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompetitionResult extends Model
{
    protected $fillable = [
        'competition_id',
        'participant_id',
        'rank',
        'score',
        'notes',
        'score_breakdown',
        'certificate_url',
        'certificate_generated',
    ];

    protected $casts = [
        'score_breakdown'        => 'array',
        'certificate_generated'  => 'boolean',
        'score'                  => 'decimal:2',
    ];

    public function competition()
    {
        return $this->belongsTo(Competition::class);
    }

    public function participant()
    {
        return $this->belongsTo(CompetitionParticipant::class, 'participant_id');
    }
}
