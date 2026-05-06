<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class WaBlastConfig extends Model
{
    use HasFactory;

    // Tidak menggunakan SoftDeletes — singleton, tidak dihapus

    protected $fillable = [
        'api_url',
        'api_token_encrypted',
        'sender_number',
        'max_recipients_per_session',
        'max_daily_messages',
        'updated_by',
    ];

    /**
     * Kolom token tidak di-cast secara otomatis agar enkripsi/dekripsi
     * dikelola secara eksplisit via getDecryptedToken().
     */
    protected $hidden = [
        'api_token_encrypted',
    ];

    // ── Relationships ──

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // ── Helpers ──

    /**
     * Dekripsi API token yang tersimpan di database.
     * Token dienkripsi menggunakan Laravel encrypt() (AES-256-CBC via APP_KEY).
     */
    public function getDecryptedToken(): string
    {
        return Crypt::decryptString($this->api_token_encrypted);
    }
}
