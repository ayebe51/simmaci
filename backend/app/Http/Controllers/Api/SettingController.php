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

        $settings = Setting::withoutTenantScope()
            ->when($schoolId, fn($q) => $q->where('school_id', $schoolId))
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

    /**
     * POST /settings — Upsert a setting (store OR update).
     * Accepts: { key, value, school_id? }
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'key'   => 'required|string|max:255',
            'value' => 'nullable',
        ]);

        $schoolId = $request->user()->isOperator()
            ? $request->user()->school_id
            : $request->input('school_id');

        Setting::setValue($request->key, $request->value, $schoolId);

        return response()->json(['success' => true]);
    }

    /**
     * PUT /settings/{setting} — also upsert (legacy route support).
     */
    public function update(Request $request): JsonResponse
    {
        return $this->store($request);
    }
}
