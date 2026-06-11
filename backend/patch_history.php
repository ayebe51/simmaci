<?php
$file = 'd:\apss-source\SIMMACI\backend\app\Http\Controllers\Api\SkDocumentController.php';
$content = file_get_contents($file);

$pnsGuardFind = <<<EOF
                SkDocument::create([
                    'nomor_sk'         => \$nomorSk,
                    'nama'             => \$doc['nama'],
                    'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'PNS',
                    'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                    'school_id'        => \$request->user()->role === 'operator' ? \$request->user()->school_id : null,
                    'status'           => 'rejected',
                    'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                    'created_by'       => \$request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
EOF;
$pnsGuardReplace = <<<EOF
                \$createdDoc = SkDocument::create([
                    'nomor_sk'         => \$nomorSk,
                    'nama'             => \$doc['nama'],
                    'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'PNS',
                    'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                    'school_id'        => \$request->user()->role === 'operator' ? \$request->user()->school_id : null,
                    'status'           => 'rejected',
                    'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                    'created_by'       => \$request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
                \App\Models\ApprovalHistory::create([
                    'school_id' => \$createdDoc->school_id,
                    'document_id' => \$createdDoc->id,
                    'document_type' => 'sk_document',
                    'action' => 'reject',
                    'from_status' => 'pending',
                    'to_status' => 'rejected',
                    'performed_by' => null,
                    'performed_at' => now(),
                    'comment' => 'Ditolak otomatis oleh sistem',
                    'metadata' => ['rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.'],
                ]);
EOF;

$content = str_replace($pnsGuardFind, $pnsGuardReplace, $content);

$dupGuardFind = <<<EOF
                \App\Models\SkDocument::create([
                    'nomor_sk'         => \$nomorSk,
                    'nama'             => \$doc['nama'],
                    'jenis_sk'         => \$jenisSk,
                    'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                    'school_id'        => \$schoolId,
                    'status'           => 'rejected',
                    'rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk}).",
                    'created_by'       => \$request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
EOF;
$dupGuardReplace = <<<EOF
                \$createdDoc = \App\Models\SkDocument::create([
                    'nomor_sk'         => \$nomorSk,
                    'nama'             => \$doc['nama'],
                    'jenis_sk'         => \$jenisSk,
                    'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                    'school_id'        => \$schoolId,
                    'status'           => 'rejected',
                    'rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk}).",
                    'created_by'       => \$request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
                \App\Models\ApprovalHistory::create([
                    'school_id' => \$schoolId,
                    'document_id' => \$createdDoc->id,
                    'document_type' => 'sk_document',
                    'action' => 'reject',
                    'from_status' => 'pending',
                    'to_status' => 'rejected',
                    'performed_by' => null,
                    'performed_at' => now(),
                    'comment' => 'Ditolak otomatis oleh sistem',
                    'metadata' => ['rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk})."],
                ]);
EOF;

$content = str_replace($dupGuardFind, $dupGuardReplace, $content);
file_put_contents($file, $content);

// ProcessBulkSkSubmission.php
$file = 'd:\apss-source\SIMMACI\backend\app\Jobs\ProcessBulkSkSubmission.php';
$content = file_get_contents($file);

$pnsGuardFind2 = <<<EOF
                    SkDocument::create([
                        'nomor_sk'         => \$nomorSk,
                        'nama'             => \$doc['nama'],
                        'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'PNS',
                        'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                        'school_id'        => \$this->userSchoolId,
                        'status'           => 'rejected',
                        'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                        'created_by'       => \$this->userEmail,
                        'tanggal_penetapan'=> now()->format('Y-m-d'),
                    ]);
EOF;

$pnsGuardReplace2 = <<<EOF
                    \$createdDoc = SkDocument::create([
                        'nomor_sk'         => \$nomorSk,
                        'nama'             => \$doc['nama'],
                        'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'PNS',
                        'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                        'school_id'        => \$this->userSchoolId,
                        'status'           => 'rejected',
                        'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                        'created_by'       => \$this->userEmail,
                        'tanggal_penetapan'=> now()->format('Y-m-d'),
                    ]);
                    \App\Models\ApprovalHistory::create([
                        'school_id' => \$this->userSchoolId,
                        'document_id' => \$createdDoc->id,
                        'document_type' => 'sk_document',
                        'action' => 'reject',
                        'from_status' => 'pending',
                        'to_status' => 'rejected',
                        'performed_by' => null,
                        'performed_at' => now(),
                        'comment' => 'Ditolak otomatis oleh sistem',
                        'metadata' => ['rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.'],
                    ]);
EOF;

$content = str_replace($pnsGuardFind2, $pnsGuardReplace2, $content);

$dupGuardFind2 = <<<EOF
                    SkDocument::create([
                        'nomor_sk'         => \$nomorSk,
                        'nama'             => \$doc['nama'],
                        'jenis_sk'         => \$jenisSk,
                        'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                        'school_id'        => \$schoolId,
                        'status'           => 'rejected',
                        'rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk}).",
                        'created_by'       => \$this->userEmail,
                        'tanggal_penetapan'=> now()->format('Y-m-d'),
                    ]);
EOF;

$dupGuardReplace2 = <<<EOF
                    \$createdDoc = SkDocument::create([
                        'nomor_sk'         => \$nomorSk,
                        'nama'             => \$doc['nama'],
                        'jenis_sk'         => \$jenisSk,
                        'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                        'school_id'        => \$schoolId,
                        'status'           => 'rejected',
                        'rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk}).",
                        'created_by'       => \$this->userEmail,
                        'tanggal_penetapan'=> now()->format('Y-m-d'),
                    ]);
                    \App\Models\ApprovalHistory::create([
                        'school_id' => \$schoolId,
                        'document_id' => \$createdDoc->id,
                        'document_type' => 'sk_document',
                        'action' => 'reject',
                        'from_status' => 'pending',
                        'to_status' => 'rejected',
                        'performed_by' => null,
                        'performed_at' => now(),
                        'comment' => 'Ditolak otomatis oleh sistem',
                        'metadata' => ['rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {\$existingPending->nomor_sk})."],
                    ]);
EOF;

$content = str_replace($dupGuardFind2, $dupGuardReplace2, $content);

$emptyNimTmtFind = <<<EOF
                        SkDocument::create([
                            'nomor_sk'         => \$nomorSk,
                            'nama'             => \$doc['nama'],
                            'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'GTY',
                            'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                            'school_id'        => \$schoolId,
                            'status'           => 'rejected',
                            'rejection_reason' => 'Guru sudah terdaftar tetapi NIM dan TMT belum terisi. Lengkapi data guru terlebih dahulu.',
                            'created_by'       => \$this->userEmail,
                            'tanggal_penetapan'=> now()->format('Y-m-d'),
                        ]);
EOF;

$emptyNimTmtReplace = <<<EOF
                        \$createdDoc = SkDocument::create([
                            'nomor_sk'         => \$nomorSk,
                            'nama'             => \$doc['nama'],
                            'jenis_sk'         => \$doc['status_kepegawaian'] ?? \$doc['status'] ?? \$doc['jenis_sk'] ?? 'GTY',
                            'unit_kerja'       => \$doc['unit_kerja'] ?? null,
                            'school_id'        => \$schoolId,
                            'status'           => 'rejected',
                            'rejection_reason' => 'Guru sudah terdaftar tetapi NIM dan TMT belum terisi. Lengkapi data guru terlebih dahulu.',
                            'created_by'       => \$this->userEmail,
                            'tanggal_penetapan'=> now()->format('Y-m-d'),
                        ]);
                        \App\Models\ApprovalHistory::create([
                            'school_id' => \$schoolId,
                            'document_id' => \$createdDoc->id,
                            'document_type' => 'sk_document',
                            'action' => 'reject',
                            'from_status' => 'pending',
                            'to_status' => 'rejected',
                            'performed_by' => null,
                            'performed_at' => now(),
                            'comment' => 'Ditolak otomatis oleh sistem',
                            'metadata' => ['rejection_reason' => 'Guru sudah terdaftar tetapi NIM dan TMT belum terisi. Lengkapi data guru terlebih dahulu.'],
                        ]);
EOF;

$content = str_replace($emptyNimTmtFind, $emptyNimTmtReplace, $content);

file_put_contents($file, $content);
echo "Done\n";
