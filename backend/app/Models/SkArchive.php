<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class SkArchive extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['school_id','nomor_sk','title','year','category','storage_id','file_url','uploaded_by'];
    public function school() { return $this->belongsTo(School::class); }
}
