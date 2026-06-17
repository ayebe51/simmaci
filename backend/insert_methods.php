<?php

$file = 'd:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/TeacherController.php';
$content = file_get_contents($file);

// Find the last closing brace of the class
$pos = strrpos($content, '}');

$methods = <<<'METHODSEOF'

    /**
     * Parse and normalize a single row from the Excel/JSON import.
     */
    private function parseImportRow(array $row, Request $request): array
    {
        $allowedFields = [
            'nuptk', 'nama', 'nip', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
            'pendidikan_terakhir', 'mapel', 'unit_kerja', 'school_id', 'status',
            'phone_number', 'email', 'is_active', 'is_verified',
            'is_certified', 'tmt', 'pdpkpnu', 'kecamatan', 'nomor_induk_maarif',
            'provinsi', 'kabupaten', 'kelurahan'
        ];

        // Normalize keys: trim, lowercase, replace non-alphanumeric with underscore
        $normalizedRow = [];
        foreach ($row as $key => $value) {
            $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
            $cleanKey = preg_replace('/_+/', '_', $cleanKey);
            $cleanKey = trim($cleanKey, '_');
            $normalizedRow[$cleanKey] = $value;
        }

        // Parse N.I.M (Nomor Induk Maarif)
        $nim = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'maarif') || (str_contains($k, 'nomor_induk') && !str_contains($k, 'pegawai')) || (str_contains($k, 'nim') && !str_contains($k, 'p'))) {
                $nim = $v;
                break;
            }
        }
        // Normalize NIM — strip dots, dashes, spaces, apostrophes
        $nimNormalized = $nim ? $this->normalizationService->normalizeNim((string)$nim) : null;
        // If the "NIM" value is non-numeric text (e.g. "Non PNS", "PNS"), discard it
        if ($nimNormalized !== null && !ctype_digit($nimNormalized)) {
            $nimNormalized = null;
        }
        $normalizedRow['nomor_induk_maarif'] = $nimNormalized;

        // Parse NUPTK
        $nuptk = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'nuptk') || str_contains($k, 'n_u_p_t_k') || str_contains($k, 'pegawai')) {
                $nuptk = $v;
                break;
            }
        }
        // Strip apostrophe and whitespace from NUPTK
        $nuptk = $nuptk ? ltrim(trim((string)$nuptk), "' ") : null;
        // If NUPTK looks like a NIM (9 digits, starts with 1134), move it to nomor_induk_maarif
        if ($nuptk !== null && preg_match('/^1134\d{5}$/', $nuptk)) {
            if (empty($normalizedRow['nomor_induk_maarif'])) {
                $normalizedRow['nomor_induk_maarif'] = $nuptk;
            }
            $nuptk = null; // clear from NUPTK field
        }
        // NUPTK must be numeric-only (16 digits typically); discard non-numeric values
        if ($nuptk !== null && !ctype_digit($nuptk)) {
            $nuptk = null;
        }
        $normalizedRow['nuptk'] = $nuptk;

        // Parse NIP (Pegawai/NIY)
        $nip = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'nip') || str_contains($k, 'niy') || str_contains($k, 'pegawai') || (str_contains($k, 'n_i_y'))) {
                $nip = $v;
                break;
            }
        }
        $normalizedRow['nip'] = $nip ? ltrim(trim((string)$nip), "'") : null;

        // Parse Satminkal (unit_kerja)
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'satminkal') || str_contains($k, 'unit_kerja')
                || str_contains($k, 'nama_sekolah') || str_contains($k, 'nama_madrasah')
                || str_contains($k, 'nama_lembaga') || str_contains($k, 'tempat_tugas')
                || str_contains($k, 'asal_sekolah') || str_contains($k, 'instansi')
                || $k === 'lembaga' || $k === 'madrasah' || $k === 'sekolah'
            ) {
                $normalizedRow['unit_kerja'] = $v;
                break;
            }
        }

        // Parse Provinsi, Kabupaten/Kota, Kelurahan/Desa, No HP
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'provinsi') || str_contains($k, 'propinsi')) {
                $normalizedRow['provinsi'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'kab_kota') || str_contains($k, 'kabupaten')) {
                $normalizedRow['kabupaten'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'kelurahan_desa') || str_contains($k, 'kelurahan')) {
                $normalizedRow['kelurahan'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'no_hp') || str_contains($k, 'nomor_hp')) {
                $normalizedRow['phone_number'] = ltrim(trim((string)$v), "'");
                break;
            }
        }

        $schoolId = $normalizedRow['school_id'] ?? null;
        // Force user's school if operator
        if ($request->user()->role === 'operator') {
            $schoolId = $request->user()->school_id;
            if (empty(trim((string)($normalizedRow['unit_kerja'] ?? '')))) {
                $operatorSchool = School::find($schoolId);
                $normalizedRow['unit_kerja'] = $operatorSchool?->nama;
            }
        } elseif (!$schoolId && isset($normalizedRow['unit_kerja'])) {
            $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$normalizedRow['unit_kerja']])->first();
            $schoolId = $school?->id;
        }

        // Parse Sertifikasi
        $sertifikasi = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'sertif') || str_contains($k, 'certified')) {
                $sertifikasi = $v;
                break;
            }
        }
        if ($sertifikasi !== null && $sertifikasi !== '') {
            $val = strtolower(trim((string)$sertifikasi));
            $normalizedRow['is_certified'] = in_array($val, ['sudah', 'ya', '1', 'true', 'yes', 'v']);
        }

        // Parse Tempat Tanggal Lahir (Combined)
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'tempat_tanggal_lahir') || $k === 'ttl' || str_contains($k, 'tempat_tgl_lahir')) {
                $parts = explode(',', (string)$v);
                if (count($parts) >= 2) {
                    if (!isset($normalizedRow['tempat_lahir'])) {
                        $normalizedRow['tempat_lahir'] = trim($parts[0]);
                    }
                    if (!isset($normalizedRow['tanggal_lahir'])) {
                        $normalizedRow['tanggal_lahir'] = trim($parts[1]);
                    }
                }
                break;
            }
        }

        // Parse Tanggal Lahir
        $tglLahirRaw = $normalizedRow['tanggal_lahir'] ?? $normalizedRow['tgl_lahir'] ?? null;
        if ($tglLahirRaw !== null && (string)$tglLahirRaw !== '') {
            $tglStr = trim((string)$tglLahirRaw);
            if (is_numeric($tglStr)) {
                try {
                    $normalizedRow['tanggal_lahir'] = \Carbon\Carbon::createFromDate(1899, 12, 30)->addDays((int)$tglStr)->format('Y-m-d');
                } catch (\Exception $e) { $normalizedRow['tanggal_lahir'] = null; }
            } else {
                try {
                    $indoMonths = [
                        'januari' => 'january', 'februari' => 'february', 'maret' => 'march',
                        'april' => 'april', 'mei' => 'may', 'juni' => 'june', 'juli' => 'july',
                        'agustus' => 'august', 'september' => 'september', 'oktober' => 'october',
                        'november' => 'november', 'desember' => 'december',
                        'jan' => 'jan', 'feb' => 'feb', 'mar' => 'mar', 'apr' => 'apr',
                        'jun' => 'jun', 'jul' => 'jul', 'agu' => 'aug', 'sep' => 'sep', 'okt' => 'oct',
                        'nov' => 'nov', 'des' => 'dec'
                    ];
                    $translatedTgl = str_ireplace(array_keys($indoMonths), array_values($indoMonths), $tglStr);
                    
                    $tglDate = null;
                    $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y/m/d', 'm/d/Y', 'd F Y', 'd M Y', 'd-M-Y', 'd/M/Y'];
                    foreach ($formats as $format) {
                        try {
                            $tglDate = \Carbon\Carbon::createFromFormat($format, $translatedTgl);
                            if ($tglDate !== false) break;
                        } catch (\Exception $e) { $tglDate = null; }
                    }
                    if (!$tglDate) {
                        $tglDate = \Carbon\Carbon::parse($translatedTgl);
                    }
                    $normalizedRow['tanggal_lahir'] = $tglDate->format('Y-m-d');
                } catch (\Exception $e) { $normalizedRow['tanggal_lahir'] = null; }
            }
        } else {
            $normalizedRow['tanggal_lahir'] = null;
        }

        // Parse PDPKPNU
        $pdpkpnuRaw = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'pdpkpnu') || str_contains($k, 'p_d_p_k_p_n_u')) {
                $pdpkpnuRaw = $v;
                break;
            }
        }
        if ($pdpkpnuRaw !== null && $pdpkpnuRaw !== '') {
            $val2 = strtolower(trim((string)$pdpkpnuRaw));
            $normalizedRow['pdpkpnu'] = in_array($val2, ['sudah', 'ya', '1', 'true', 'yes', 'v']) ? 'Sudah' : 'Belum';
        }

        // Parse TMT Date
        $tmtRaw = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'tmt') || str_contains($k, 'mulai_tugas') || str_contains($k, 'tanggal_tugas') || str_contains($k, 'penugasan')) {
                $tmtRaw = $v;
                break;
            }
        }
        $tmtDate = null;
        if ($tmtRaw !== null && (string)$tmtRaw !== '') {
            $tmtStr = trim((string)$tmtRaw);
            if (is_numeric($tmtStr)) {
                $tmtDate = \Carbon\Carbon::createFromDate(1899, 12, 30)->addDays((int)$tmtStr);
            } else {
                $indoMonths = [
                    'januari' => 'january', 'februari' => 'february', 'maret' => 'march',
                    'april' => 'april', 'mei' => 'may', 'juni' => 'june', 'juli' => 'july',
                    'agustus' => 'august', 'september' => 'september', 'oktober' => 'october',
                    'november' => 'november', 'desember' => 'december',
                    'jan' => 'jan', 'feb' => 'feb', 'mar' => 'mar', 'apr' => 'apr',
                    'jun' => 'jun', 'jul' => 'jul', 'agu' => 'aug', 'sep' => 'sep', 'okt' => 'oct',
                    'nov' => 'nov', 'des' => 'dec'
                ];
                $translatedTmt = str_ireplace(array_keys($indoMonths), array_values($indoMonths), $tmtStr);

                $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y/m/d', 'm/d/Y', 'd F Y', 'd M Y', 'd-M-Y', 'd/M/Y'];
                foreach ($formats as $format) {
                    try {
                        $tmtDate = \Carbon\Carbon::createFromFormat($format, $translatedTmt);
                        if ($tmtDate !== false) break;
                    } catch (\Exception $e) { $tmtDate = null; }
                }
                if (!$tmtDate) {
                    try { $tmtDate = \Carbon\Carbon::parse($translatedTmt); } catch (\Exception $e) { $tmtDate = null; }
                }
            }
            if ($tmtDate) {
                $normalizedRow['tmt'] = $tmtDate->format('Y-m-d');
            }
        }

        // Kalkulasi Status
        $pendidikan = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'pendidikan') || str_contains($k, 'ijazah') || str_contains($k, 'ijasah') || str_contains($k, 'jenjang')) {
                $pendidikan = $v;
                break;
            }
        }

        if ($pendidikan !== null) {
            $normalizedRow['pendidikan_terakhir'] = $pendidikan;
            $pendidikanTinggi = ['S1', 'S2', 'S3', 'D4', 'S1/D4', 'STRATA'];
            $isSarjana = false;
            foreach ($pendidikanTinggi as $pt) {
                if (stripos((string)$pendidikan, $pt) !== false) {
                    $isSarjana = true;
                    break;
                }
            }

            if (!$isSarjana) {
                $normalizedRow['status'] = 'Tendik';
            } elseif ($tmtDate) {
                $diffYears = $tmtDate->diffInYears(\Carbon\Carbon::now());
                $normalizedRow['status'] = ($diffYears >= 2) ? 'GTY' : 'GTT';
            } else {
                $normalizedRow['status'] = 'GTT';
            }
        }

        $dataToSave = [];
        foreach ($allowedFields as $field) {
            if (isset($normalizedRow[$field])) {
                $dataToSave[$field] = $normalizedRow[$field];
            }
        }

        if (isset($normalizedRow['pendidikan_terakhir']) && $normalizedRow['pendidikan_terakhir'] !== null) {
            $dataToSave['pendidikan_terakhir'] = $normalizedRow['pendidikan_terakhir'];
        }

        // Fallback for nama
        if (empty($dataToSave['nama'])) {
            foreach($normalizedRow as $k => $v) {
                if (str_contains($k, 'nama') || $k === 'guru' || $k === 'karyawan') {
                    $dataToSave['nama'] = $v;
                    break;
                }
            }
        }

        if (empty($dataToSave['nama'])) {
            if (empty(array_filter($normalizedRow))) return []; // skip empty
            $dataToSave['nama'] = "Guru Baru (Tanpa Nama)";
        }

        // Apply normalizations via NormalizationService
        $dataToSave['nama'] = $this->normalizationService->normalizeTeacherName($dataToSave['nama']);
        if (isset($dataToSave['unit_kerja'])) {
            $dataToSave['unit_kerja'] = $this->normalizationService->normalizeSchoolName($dataToSave['unit_kerja']);
        }
        if (isset($dataToSave['tempat_lahir'])) {
            $dataToSave['tempat_lahir'] = $this->normalizationService->normalizePlaceOfBirth($dataToSave['tempat_lahir']);
        }
        if (isset($dataToSave['status'])) {
            $tmtForStatus = isset($dataToSave['tmt']) ? \Carbon\Carbon::parse($dataToSave['tmt']) : null;
            $dataToSave['status'] = $this->normalizationService->normalizeEmploymentStatus($dataToSave['status'], $tmtForStatus);
        }

        $savePayload = array_merge(array_filter($dataToSave, fn($v) => $v !== null && $v !== ''), ['school_id' => $schoolId]);

        if (empty($savePayload['unit_kerja']) && !empty($normalizedRow['unit_kerja'])) {
            $savePayload['unit_kerja'] = $normalizedRow['unit_kerja'];
        }
        if (empty($savePayload['unit_kerja']) && $schoolId) {
            $fallbackSchool = School::find($schoolId);
            if ($fallbackSchool) {
                $savePayload['unit_kerja'] = $fallbackSchool->nama;
            }
        }

        return $savePayload;
    }

    /**
     * POST /api/teachers/import/preview
     */
    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);
        
        $previews = [];
        $indexCounter = 0;

        foreach ($request->teachers as $index => $row) {
            try {
                $parsedData = $this->parseImportRow($row, $request);
                if (empty($parsedData)) continue;

                $nim = $parsedData['nomor_induk_maarif'] ?? null;
                $namaFile = $parsedData['nama'] ?? '';
                $unitFile = $parsedData['unit_kerja'] ?? '';
                
                // Fetch matches from DB if NIM exists
                $dbMatches = [];
                if ($nim) {
                    $dbMatches = Teacher::withoutTenantScope()
                        ->where('nomor_induk_maarif', $nim)
                        ->get()
                        ->toArray();
                }

                $matchResult = $this->matchingService->determineStatus($dbMatches, $parsedData);
                
                $dbNama = '';
                $dbUnit = '';
                if ($matchResult['target_id']) {
                    $targetRow = collect($dbMatches)->firstWhere('id', $matchResult['target_id']);
                    if ($targetRow) {
                        $dbNama = $targetRow['nama'];
                        $dbUnit = $targetRow['unit_kerja'];
                    }
                } else if (!empty($dbMatches) && $matchResult['status'] === 'TAKEOVER') {
                    // Just show the first one it's taking over from
                    $dbNama = $dbMatches[0]['nama'];
                    $dbUnit = $dbMatches[0]['unit_kerja'];
                } else if (!empty($dbMatches) && $matchResult['status'] === 'KONFLIK') {
                    $dbNama = $dbMatches[0]['nama'] . ' (Ganda)';
                    $dbUnit = $dbMatches[0]['unit_kerja'];
                }

                $previews[] = [
                    'id' => $indexCounter++,
                    'nim' => $nim,
                    'nama_file' => $namaFile,
                    'nama_db' => $dbNama,
                    'unit_file' => $unitFile,
                    'unit_db' => $dbUnit,
                    'status' => $matchResult['status'],
                    'action' => $matchResult['action'],
                    'message' => $matchResult['message'],
                    'target_id' => $matchResult['target_id'],
                    'payload' => $parsedData
                ];
            } catch (\Exception $e) {
                // Log and continue
                continue;
            }
        }

        return response()->json([
            'previews' => $previews
        ]);
    }

    /**
     * POST /api/teachers/import/commit
     */
    public function importCommit(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);
        
        $created = 0;
        $updated = 0;
        $takeovers = 0;

        \DB::beginTransaction();
        try {
            foreach ($request->teachers as $row) {
                $payload = $row['payload'];
                $action = $row['action'];
                $targetId = $row['target_id'] ?? null;
                $nim = $payload['nomor_induk_maarif'] ?? null;

                if ($action === 'INSERT' || ($action === 'MANUAL' && !$targetId)) {
                    Teacher::create($payload);
                    $created++;
                } 
                elseif ($action === 'UPDATE' || ($action === 'MANUAL' && $targetId)) {
                    $teacher = Teacher::withoutTenantScope()->find($targetId);
                    if ($teacher) {
                        // User instruction: For safe update, KEEP database name.
                        // So we remove 'nama' from payload so it doesn't overwrite.
                        if (isset($payload['nama'])) {
                            unset($payload['nama']);
                        }
                        $teacher->update($payload);
                        $updated++;
                    }
                }
                elseif ($action === 'TAKEOVER') {
                    if ($nim) {
                        // 1. Revoke NIM from existing users
                        $nimConflicts = Teacher::withoutTenantScope()
                            ->where('nomor_induk_maarif', $nim)
                            ->get();
                            
                        foreach ($nimConflicts as $conflict) {
                            $conflict->update(['nomor_induk_maarif' => null]);
                            
                            ActivityLog::create([
                                'description' => "NIM {$nim} dicabut otomatis (TAKEOVER) karena dipakai oleh data resmi baru atas nama {$payload['nama']}",
                                'event' => 'nim_force_reassigned',
                                'log_name' => 'master',
                                'subject_id' => $conflict->id,
                                'subject_type' => get_class($conflict),
                                'causer_id' => $request->user()->id,
                                'causer_type' => get_class($request->user()),
                                'school_id' => $conflict->school_id,
                            ]);
                        }
                    }
                    // 2. Insert the new legitimate owner
                    Teacher::create($payload);
                    $takeovers++;
                    $created++;
                }
            }
            \DB::commit();
            
            return response()->json([
                'success' => true,
                'summary' => "Berhasil: $created Ditambahkan (termasuk $takeovers Takeover), $updated Diperbarui."
            ]);
        } catch (\Exception $e) {
            \DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
METHODSEOF;

$content = substr_replace($content, $methods . "\n}", $pos, 1);
file_put_contents($file, $content);
echo "Methods added successfully.\n";

