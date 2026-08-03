<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Competition;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * EventController — menggunakan response()->json() langsung
 * (tidak bergantung pada ApiResponse trait agar OPcache tidak jadi masalah)
 */
class EventController extends Controller
{
    private function ok(mixed $data, string $message = '', int $code = 200): JsonResponse
    {
        $body = ['success' => true, 'data' => $data];
        if ($message) {
            $body['message'] = $message;
        }
        return response()->json($body, $code);
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $events = Event::with(['competitions' => function ($q) {
                $q->withCount('participants')->withCount('results');
            }])->orderByDesc('date')->get();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('EventController::index competitions relation failed', ['error' => $e->getMessage()]);
            $events = Event::orderByDesc('date')->get();
        }

        return $this->ok($events);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'               => 'required|string|max:255',
            'category'           => 'required|string|max:100',
            'type'               => 'nullable|string|max:50',
            'date'               => 'required|date',
            'location'           => 'nullable|string|max:255',
            'description'        => 'nullable|string',
            'status'             => 'nullable|string|in:OPEN,CLOSED,FINISHED',
            'registration_start' => 'nullable|date',
            'registration_end'   => 'nullable|date',
            'video_deadline'     => 'nullable|string|max:30',
            'announcement_date'  => 'nullable|date',
            'announcement_place' => 'nullable|string|max:255',
            'contact_name'       => 'nullable|string|max:100',
            'contact_phone'      => 'nullable|string|max:30',
        ]);

        // Normalize video_deadline: "2026-09-11T23:59" -> "2026-09-11 23:59:00"
        if (! empty($data['video_deadline'])) {
            $data['video_deadline'] = str_replace('T', ' ', $data['video_deadline']);
            if (strlen($data['video_deadline']) === 16) {
                $data['video_deadline'] .= ':00';
            }
        }

        $data['school_id'] = Auth::user()?->school_id;

        $event = Event::create($data);

        try {
            $event->load('competitions');
        } catch (\Throwable $e) {
            // competitions table might not exist yet — return without relation
        }

        return $this->ok($event, 'Event berhasil dibuat', 201);
    }

    public function show(Event $event): JsonResponse
    {
        try {
            $event->load([
                'competitions' => function ($q) {
                    $q->withCount('participants')->withCount('results')->orderBy('name');
                },
            ]);
        } catch (\Throwable $e) {
            // graceful fallback
        }

        return $this->ok($event);
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate([
            'name'               => 'nullable|string|max:255',
            'category'           => 'nullable|string|max:100',
            'type'               => 'nullable|string|max:50',
            'date'               => 'nullable|date',
            'location'           => 'nullable|string|max:255',
            'description'        => 'nullable|string',
            'status'             => 'nullable|string|in:OPEN,CLOSED,FINISHED',
            'registration_start' => 'nullable|date',
            'registration_end'   => 'nullable|date',
            'video_deadline'     => 'nullable|string|max:30',
            'announcement_date'  => 'nullable|date',
            'announcement_place' => 'nullable|string|max:255',
            'contact_name'       => 'nullable|string|max:100',
            'contact_phone'      => 'nullable|string|max:30',
        ]);

        $event->update($data);

        try {
            $event->load('competitions');
        } catch (\Throwable $e) {
            // graceful fallback
        }

        return $this->ok($event);
    }

    public function destroy(Event $event): JsonResponse
    {
        $event->delete();
        return $this->ok(null, 'Event berhasil dihapus');
    }

    // ── Medal Tally ────────────────────────────────────────────────────────────

    public function tally(Event $event): JsonResponse
    {
        $tally = Competition::where('event_id', $event->id)
            ->with(['results.participant'])
            ->get()
            ->flatMap(fn ($comp) => $comp->results)
            ->filter(fn ($r) => $r->rank !== null)
            ->groupBy(fn ($r) => $r->participant?->institution ?? 'Unknown')
            ->map(function ($results, $institution) {
                return [
                    'institution' => $institution,
                    'gold'        => $results->where('rank', 1)->count(),
                    'silver'      => $results->where('rank', 2)->count(),
                    'bronze'      => $results->where('rank', 3)->count(),
                    'total'       => $results->whereIn('rank', [1, 2, 3])->count(),
                ];
            })
            ->sortByDesc('gold')
            ->values();

        return $this->ok($tally);
    }
}
