<?php
$file = base_path('guru_nim_6000_tanpa_sk.csv');
if (file_exists($file)) {
    echo 'CSV exists, lines: ' . count(file($file)) . PHP_EOL;
} else {
    echo 'CSV not found' . PHP_EOL;
}
