<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(Event::orderByDesc('date')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'category' => 'required|string',
            'type' => 'nullable|string',
            'date' => 'required|date',
            'location' => 'nullable|string',
            'description' => 'nullable|string',
        ]);

        return response()->json(Event::create($data), 201);
    }

    public function show(Event $event): JsonResponse
    {
        return response()->json($event);
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate([
            'name' => 'nullable|string',
            'category' => 'nullable|string',
            'type' => 'nullable|string',
            'date' => 'nullable|date',
            'location' => 'nullable|string',
            'description' => 'nullable|string',
        ]);

        $event->update($data);
        return response()->json($event);
    }

    public function destroy(Event $event): JsonResponse
    {
        $event->delete();
        return response()->json(['success' => true]);
    }
}
