<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Staff;
use App\Models\StaffAttendance;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StaffAttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $query = StaffAttendance::with('staff');

        if ($request->start_date && $request->end_date) {
            $query->whereBetween('tanggal', [$request->start_date, $request->end_date]);
        } elseif ($request->tanggal) {
            $query->where('tanggal', $request->tanggal);
        } else {
            $query->where('tanggal', Carbon::today()->toDateString());
        }

        $attendances = $query->orderByDesc('tanggal')->orderByDesc('jam_masuk')->get();

        return $this->successResponse($attendances);
    }

    public function storeManual(Request $request): JsonResponse
    {
        $request->validate([
            'staff_id' => 'required|exists:staffs,id',
            'tanggal' => 'required|date',
            'status' => 'required|string',
            'jam_masuk' => 'nullable|date_format:H:i',
            'jam_pulang' => 'nullable|date_format:H:i',
        ]);

        $attendance = StaffAttendance::updateOrCreate(
            [
                'staff_id' => $request->staff_id,
                'tanggal' => $request->tanggal,
            ],
            [
                'status' => $request->status,
                'jam_masuk' => $request->jam_masuk,
                'jam_pulang' => $request->jam_pulang,
                'location_verified' => true, // Manual entry is implicitly verified
            ]
        );

        return $this->successResponse($attendance, 'Kehadiran manual berhasil dicatat.');
    }

    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'qr_code' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'photo' => 'nullable|string', // base64 image if we want to save proof
            'jenis_absen' => 'nullable|string|in:Kantor,Dinas Luar',
        ]);

        // 1. Find staff by the provided QR code
        // The QR code acts as the secure secret token.
        $staff = Staff::where('qr_code', $request->qr_code)->first();
        if (!$staff) {
            return $this->errorResponse('QR Code tidak valid atau staff tidak ditemukan.', 404);
        }

        // 2. Validate GPS
        $officeLat = (float) Setting::getValue('office_latitude') ?: -7.712613; // default cilacap roughly
        $officeLng = (float) Setting::getValue('office_longitude') ?: 109.009415;
        $radius = (int) Setting::getValue('office_geofence_radius') ?: 100; // in meters

        $isGeoEnabled = Setting::getValue('staff_geolocation_enabled') === 'true';
        $isDinasLuar = $request->jenis_absen === 'Dinas Luar';

        $distance = $this->calculateDistance($request->latitude, $request->longitude, $officeLat, $officeLng);
        
        // If Dinas Luar, we skip the radius check.
        $locationVerified = ($isGeoEnabled && !$isDinasLuar) ? ($distance <= $radius) : true;
        
        // If they are outside the radius AND not dinas luar, block it.
        if ($isGeoEnabled && !$isDinasLuar && $distance > $radius) {
             return $this->errorResponse("Anda berada di luar area kantor (Jarak: " . round($distance) . "m dari batas $radius"."m).", 400);
        }

        $today = Carbon::today()->toDateString();
        $currentTime = Carbon::now()->toTimeString();

        // Check if already attended today
        $attendance = StaffAttendance::where('staff_id', $staff->id)
            ->where('tanggal', $today)
            ->first();

        // 3. Strict Time Validation
        $enforceTime = Setting::getValue('staff_enforce_time') === 'true';
        $batasMasuk = Setting::getValue('staff_batas_jam_masuk') ?: '08:00:00';
        $batasPulang = Setting::getValue('staff_batas_jam_pulang') ?: '15:30:00';

        if ($enforceTime) {
            if (!$attendance) {
                if ($currentTime > $batasMasuk) {
                    return $this->errorResponse("Absen MASUK gagal. Batas waktu absen masuk adalah jam " . substr($batasMasuk, 0, 5) . ".", 400);
                }
            } else {
                if (!$attendance->jam_pulang && $currentTime < $batasPulang) {
                    return $this->errorResponse("Absen PULANG gagal. Belum waktunya pulang (Minimal jam " . substr($batasPulang, 0, 5) . ").", 400);
                }
            }
        }

        // Process base64 photo if provided
        $photoPath = null;
        if ($request->photo) {
            $imageParts = explode(";base64,", $request->photo);
            if (count($imageParts) == 2) {
                $imageTypeAux = explode("image/", $imageParts[0]);
                $imageType = $imageTypeAux[1];
                $imageBase64 = base64_decode($imageParts[1]);
                $fileName = 'staff_attendance/' . $staff->id . '_' . time() . '.' . $imageType;
                Storage::disk('public')->put($fileName, $imageBase64);
                $photoPath = $fileName;
            }
        }

        if (!$attendance) {
            // Check In (Masuk)
            $attendance = StaffAttendance::create([
                'staff_id' => $staff->id,
                'tanggal' => $today,
                'jam_masuk' => $currentTime,
                'status' => $isDinasLuar ? 'Dinas Luar' : 'Hadir',
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'location_verified' => $locationVerified,
                'photo_proof' => $photoPath,
            ]);

            return $this->successResponse($attendance, 'Absen MASUK berhasil tercatat.');
        } else {
            // Check Out (Pulang)
            if ($attendance->jam_pulang) {
                return $this->errorResponse('Anda sudah melakukan absen pulang hari ini.', 400);
            }

            $attendance->update([
                'jam_pulang' => $currentTime,
            ]);

            return $this->successResponse($attendance, 'Absen PULANG berhasil tercatat.');
        }
    }

    private function calculateDistance($lat1, $lon1, $lat2, $lon2) {
        $earthRadius = 6371000; // meters
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) * sin($dLon/2);
        $c = 2 * asin(sqrt($a));
        return $earthRadius * $c;
    }

    public function publicSettings(Request $request): JsonResponse
    {
        return $this->successResponse([
            'face_recognition_enabled' => Setting::getValue('staff_face_recognition_enabled') === 'true',
            'staff_geolocation_enabled' => Setting::getValue('staff_geolocation_enabled') === 'true',
            'staff_photo_enabled' => Setting::getValue('staff_photo_enabled') === 'true',
        ]);
    }

    public function checkQr(Request $request): JsonResponse
    {
        $request->validate([
            'qr_code' => 'required|string',
        ]);

        $staff = Staff::where('qr_code', $request->qr_code)->first();
        if (!$staff) {
            return $this->errorResponse('QR Code tidak valid atau staff tidak ditemukan.', 404);
        }

        return $this->successResponse([
            'nama' => $staff->nama,
            'jabatan' => $staff->jabatan,
            'face_descriptor' => $staff->face_descriptor ? json_decode($staff->face_descriptor) : null,
        ], 'Data wajah ditemukan.');
    }
}
