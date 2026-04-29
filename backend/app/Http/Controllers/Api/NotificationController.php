<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn($n) => $this->formatNotification($n));

        return response()->json($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => $request->user()->notifications()->unread()->count()
        ]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        // Ensure user can only mark their own notifications
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $notification->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->notifications()->unread()->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }

    /**
     * Format notification to match frontend expected structure.
     * Frontend reads: notif.data.title, notif.data.message, notif.data.link, notif.read_at
     */
    private function formatNotification(Notification $n): array
    {
        return [
            'id'         => $n->id,
            'type'       => $n->type,
            'read_at'    => $n->is_read ? $n->updated_at->toISOString() : null,
            'created_at' => $n->created_at->toISOString(),
            'data'       => [
                'title'   => $n->title,
                'message' => $n->message,
                'link'    => $this->resolveLink($n),
                'sk_id'   => $n->metadata['sk_id'] ?? null,
            ],
        ];
    }

    /**
     * Resolve navigation link based on notification type and metadata.
     */
    private function resolveLink(Notification $n): string
    {
        $skId = $n->metadata['sk_id'] ?? null;

        return match(true) {
            str_starts_with($n->type, 'sk_') && $skId => "/dashboard/sk/{$skId}",
            str_starts_with($n->type, 'sk_')          => '/dashboard/sk',
            default                                    => '/dashboard',
        };
    }
}
