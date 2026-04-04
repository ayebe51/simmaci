<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;

trait AuditLogTrait
{
    public static function bootAuditLogTrait()
    {
        static::created(function ($model) {
            static::logActivity($model, 'created', "Created " . class_basename($model));
        });

        static::updated(function ($model) {
            $changes = $model->getChanges();
            unset($changes['updated_at']);

            if (!empty($changes)) {
                $oldData = array_intersect_key($model->getOriginal(), $changes);
                static::logActivity($model, 'updated', "Updated " . class_basename($model), [
                    'old' => $oldData,
                    'new' => $changes,
                ]);
            }
        });

        static::deleted(function ($model) {
            static::logActivity($model, 'deleted', "Deleted " . class_basename($model), [
                'old' => $model->getOriginal(),
            ]);
        });
    }

    protected static function logActivity($model, string $event, string $description, array $properties = [])
    {
        $user = Auth::user();
        
        ActivityLog::create([
            'school_id' => $model->school_id ?? ($user->school_id ?? null),
            'log_name' => strtolower(class_basename($model)),
            'description' => $description,
            'subject_id' => $model->id,
            'subject_type' => get_class($model),
            'causer_id' => $user->id ?? null,
            'causer_type' => $user ? get_class($user) : null,
            'properties' => $properties,
            'event' => $event,
        ]);
    }
}
