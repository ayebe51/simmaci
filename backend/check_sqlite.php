<?php

$pdo = new PDO('sqlite:' . __DIR__ . '/sim_maarif');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "=== SQLITE TABLES ===\n";
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
print_r($tables);

echo "\n=== SEARCH SCHOOLS (Majenang) ===\n";
$stmt = $pdo->query("SELECT id, nama, kecamatan FROM schools WHERE nama LIKE '%Majenang%' OR kecamatan LIKE '%Majenang%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== SEARCH TEACHERS (Aminah / Siti) ===\n";
if (in_array('teachers', $tables)) {
    $stmt = $pdo->query("SELECT id, nama, school_id, unit_kerja FROM teachers WHERE nama LIKE '%Aminah%' OR nama LIKE '%Siti%'");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
}

echo "\n=== SEARCH SK DOCUMENTS (Aminah / Siti) ===\n";
if (in_array('sk_documents', $tables)) {
    $stmt = $pdo->query("SELECT id, nomor_sk, nama, unit_kerja, tanggal_penetapan, status FROM sk_documents WHERE nama LIKE '%Aminah%' OR nama LIKE '%Siti%'");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
}
