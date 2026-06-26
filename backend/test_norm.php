<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$srv = new App\Services\NormalizationService();
echo "Ahmad S.Pd.AUD: " . $srv->normalizeTeacherName('Ahmad S.Pd.AUD') . "\n";
echo "Budi S.E.: " . $srv->normalizeTeacherName('Budi S.E.') . "\n";
echo "Cici S.Sy.: " . $srv->normalizeTeacherName('Cici S.Sy.') . "\n";
echo "BUDISE: " . $srv->normalizeTeacherName('BUDISE') . "\n";
echo "Cicida S.Sy: " . $srv->normalizeTeacherName('Cicida S.Sy') . "\n";
echo "SETO: " . $srv->normalizeTeacherName('SETO') . "\n";
echo "SYARIF: " . $srv->normalizeTeacherName('SYARIF') . "\n";
