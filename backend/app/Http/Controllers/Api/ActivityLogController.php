<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Traits\SanitizesExportFormulas;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    use SanitizesExportFormulas;
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

    public function export(Request $request)
    {
        $user = $request->user();
        
        $query = ActivityLog::with(['causer', 'school']);

        if ($user->isOperator() && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }
        
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('log_name', 'like', "%{$search}%")
                  ->orWhere('event', 'like', "%{$search}%");
            });
        }
        
        if ($request->filled('event')) {
            $query->where('event', $request->event);
        }

        $logs = $query->latest()->get();

        $filename = "Activity_Logs_" . date('Ymd_His') . ".csv";
        $headers = [
            "Content-type"        => "text/csv",
            "Content-Disposition" => "attachment; filename=$filename",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        $callback = function() use($logs) {
            $file = fopen('php://output', 'w');
            
            // Add UTF-8 BOM for Excel compatibility
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // Use semicolon as delimiter for Excel
            fputcsv($file, ['Tanggal', 'Pelaku', 'Role', 'Sekolah', 'Event', 'Deskripsi Aktivitas'], ';');

            foreach ($logs as $log) {
                fputcsv($file, [
                    $log->created_at->format('Y-m-d H:i:s'),
                    self::sanitizeFormula($log->causer ? $log->causer->name : 'System'),
                    self::sanitizeFormula($log->causer ? $log->causer->role : '-'),
                    self::sanitizeFormula($log->school ? $log->school->nama : '-'),
                    self::sanitizeFormula($log->event ?? 'System'),
                    self::sanitizeFormula($log->description)
                ], ';');
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
