<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'document_id' => 'required',
            'document_type' => 'nullable|string',
        ]);

        $query = ApprovalHistory::where('document_id', $request->document_id);

        if ($request->document_type) {
            $query->where('document_type', $request->document_type);
        }

        return response()->json(
            $query->orderByDesc('performed_at')->get()
        );
    }
}
