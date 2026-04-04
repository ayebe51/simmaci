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
            ->paginate(20);

        // Sanitize output to prevent UTF-8 errors
        $notifications->getCollection()->transform(function ($notification) {
            $data = $notification->data;
            if (is_array($data)) {
                array_walk_recursive($data, function (&$val) {
                    if (is_string($val)) {
                        $val = htmlspecialchars_decode(htmlspecialchars($val, ENT_SUBSTITUTE, 'UTF-8'));
                    }
                });
                $notification->data = $data;
            }
            return $notification;
        });

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
        $notification->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->notifications()->unread()->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }
}
