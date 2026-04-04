<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->user()->isOperator() ? $request->user()->school_id : null;

        $settings = Setting::when($schoolId, fn($q) => $q->where('school_id', $schoolId))
            ->get()
            ->keyBy('key');

        return response()->json($settings);
    }

    public function show(string $key, Request $request): JsonResponse
    {
        $schoolId = $request->user()->isOperator() ? $request->user()->school_id : null;

        $value = Setting::getValue($key, $schoolId);

        return response()->json(['key' => $key, 'value' => $value]);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string',
            'value' => 'nullable|string',
        ]);

        $schoolId = $request->user()->isOperator() ? $request->user()->school_id : $request->school_id;

        Setting::setValue($request->key, $request->value, $schoolId);

        return response()->json(['success' => true]);
    }
}
