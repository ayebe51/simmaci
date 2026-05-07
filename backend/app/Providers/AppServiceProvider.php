<?php

namespace App\Providers;

use App\Repositories\Contracts\MeetingAttendanceRepositoryInterface;
use App\Repositories\Contracts\MeetingParticipantRepositoryInterface;
use App\Repositories\Contracts\MeetingRepositoryInterface;
use App\Repositories\Contracts\StudentRepositoryInterface;
use App\Repositories\Contracts\TeacherRepositoryInterface;
use App\Repositories\Contracts\WaBlastConfigRepositoryInterface;
use App\Repositories\Contracts\WaBlastRecipientRepositoryInterface;
use App\Repositories\Contracts\WaBlastRepositoryInterface;
use App\Repositories\Contracts\WaBlastTemplateRepositoryInterface;
use App\Repositories\MeetingAttendanceRepository;
use App\Repositories\MeetingParticipantRepository;
use App\Repositories\MeetingRepository;
use App\Repositories\StudentRepository;
use App\Repositories\TeacherRepository;
use App\Repositories\WaBlastConfigRepository;
use App\Repositories\WaBlastRecipientRepository;
use App\Repositories\WaBlastRepository;
use App\Repositories\WaBlastTemplateRepository;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(TeacherRepositoryInterface::class, TeacherRepository::class);
        $this->app->bind(StudentRepositoryInterface::class, StudentRepository::class);
        $this->app->bind(\App\Repositories\Contracts\UserRepositoryInterface::class, \App\Repositories\UserRepository::class);

        // WA Blast repositories
        $this->app->bind(WaBlastRepositoryInterface::class, WaBlastRepository::class);
        $this->app->bind(WaBlastRecipientRepositoryInterface::class, WaBlastRecipientRepository::class);
        $this->app->bind(WaBlastTemplateRepositoryInterface::class, WaBlastTemplateRepository::class);
        $this->app->bind(WaBlastConfigRepositoryInterface::class, WaBlastConfigRepository::class);

        // Meeting repositories
        $this->app->bind(MeetingRepositoryInterface::class, MeetingRepository::class);
        $this->app->bind(MeetingParticipantRepositoryInterface::class, MeetingParticipantRepository::class);
        $this->app->bind(MeetingAttendanceRepositoryInterface::class, MeetingAttendanceRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Logic removed to prevent early bootstrapping crash
    }
}
