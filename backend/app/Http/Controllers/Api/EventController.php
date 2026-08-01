<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Competition;
use App\Models\Event;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EventController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $events = Event::with(['competitions' => function ($q) {
            $q->withCount('participants')->withCount('results');
        }])
            ->orderByDesc('date')
            ->get();

        return $this->success($events);
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
            'registration_end'   => 'nullable|date|after_or_equal:registration_start',
            'video_deadline'     => ['nullable', 'date_format:Y-m-d H:i:s,Y-m-d H:i,Y-m-d\TH:i,Y-m-d'],
            'announcement_date'  => 'nullable|date',
            'announcement_place' => 'nullable|string|max:255',
            'contact_name'       => 'nullable|string|max:100',
            'contact_phone'      => 'nullable|string|max:30',
        ]);

        // Normalize video_deadline to Y-m-d H:i:s for DB storage
        if (! empty($data['video_deadline'])) {
            $data['video_deadline'] = str_replace('T', ' ', $data['video_deadline']);
            if (strlen($data['video_deadline']) === 16) {
                $data['video_deadline'] .= ':00';
            }
        }

        $data['school_id'] = Auth::user()?->school_id;

        $event = Event::create($data);

        return $this->success($event->load('competitions'), 'Event berhasil dibuat', 201);
    }

    public function show(Event $event): JsonResponse
    {
        $event->load([
            'competitions' => function ($q) {
                $q->withCount('participants')->withCount('results')
                  ->orderBy('name');
            },
        ]);

        // Medal tally summary for quick display
        $event->append([]);

        return $this->success($event);
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
            'video_deadline'     => 'nullable|date',
            'announcement_date'  => 'nullable|date',
            'announcement_place' => 'nullable|string|max:255',
            'contact_name'       => 'nullable|string|max:100',
            'contact_phone'      => 'nullable|string|max:30',
        ]);

        $event->update($data);

        return $this->success($event->load('competitions'));
    }

    public function destroy(Event $event): JsonResponse
    {
        $event->delete();
        return $this->success(null, 'Event berhasil dihapus');
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

        return $this->success($tally);
    }
}
