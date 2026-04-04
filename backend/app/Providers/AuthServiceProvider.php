<?php

namespace App\Providers;

use App\Models\Event;
use App\Models\NuptkSubmission;
use App\Models\SkDocument;
use App\Models\Student;
use App\Models\Teacher;
use App\Policies\EventPolicy;
use App\Policies\NuptkSubmissionPolicy;
use App\Policies\SkDocumentPolicy;
use App\Policies\StudentPolicy;
use App\Policies\TeacherPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Teacher::class         => TeacherPolicy::class,
        Student::class         => StudentPolicy::class,
        SkDocument::class      => SkDocumentPolicy::class,
        NuptkSubmission::class => NuptkSubmissionPolicy::class,
        Event::class           => EventPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();
    }
}
