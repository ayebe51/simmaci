<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $query = ActivityLog::with(['causer', 'school', 'subject']);

        // Implement tenant isolation logic
        if ($user->isOperator() && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }
        
        // Optional search by description or log_name
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('log_name', 'like', "%{$search}%")
                  ->orWhere('event', 'like', "%{$search}%");
            });
        }
        
        // Optional filter by event
        if ($request->filled('event')) {
            $query->where('event', $request->event);
        }

        $logs = $query->latest()->paginate($request->get('per_page', 15));

        return response()->json($logs);
    }
}
