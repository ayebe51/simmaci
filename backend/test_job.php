<?php
$documents = [
    [
        'nama' => 'Ali',
        'nomor_induk_maarif' => '111',
        'unit_kerja' => 'MI Test',
        'status' => 'GTY',
        'tmt' => '2020-01-01'
    ],
    [
        'nama' => 'Budi',
        'nomor_induk_maarif' => '222',
        'unit_kerja' => 'MI Test',
        'status' => 'GTY',
        'tmt' => '2020-01-01'
    ],
    [
        'nama' => 'Cici',
        'nomor_induk_maarif' => '333',
        'unit_kerja' => 'MI Test',
        'status' => 'GTY',
        'tmt' => '2020-01-01'
    ]
];

$job = new \App\Jobs\ProcessBulkSkSubmission(
    documents: $documents,
    suratPermohonanUrl: 'test.pdf',
    userId: 1,
    userEmail: 'test@test.com',
    userSchoolId: 1,
    userRole: 'operator'
);

$job->handle(app(\App\Services\NormalizationService::class));

echo "Done\n";
