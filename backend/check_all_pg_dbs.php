<?php

$pdo = new PDO("pgsql:host=127.0.0.1;port=5432;dbname=postgres", "postgres", "root");
$stmt = $pdo->query("SELECT datname FROM pg_database WHERE datistemplate = false;");
$databases = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo "=== POSTGRES DATABASES ===\n";
print_r($databases);

foreach ($databases as $dbname) {
    try {
        $db = new PDO("pgsql:host=127.0.0.1;port=5432;dbname=$dbname", "postgres", "root");
        $tables = $db->query("SELECT tablename FROM pg_tables WHERE schemaname='public'")->fetchAll(PDO::FETCH_COLUMN);
        
        if (in_array('teachers', $tables) || in_array('sk_documents', $tables) || in_array('schools', $tables)) {
            echo "\n==================== DB: $dbname ====================\n";
            if (in_array('schools', $tables)) {
                $count = $db->query("SELECT count(*) FROM schools")->fetchColumn();
                echo "Schools count: $count\n";
                $sch = $db->query("SELECT id, nama FROM schools WHERE nama ILIKE '%Majenang%'")->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($sch)) {
                    echo "Found Majenang schools:\n";
                    print_r($sch);
                }
            }
            if (in_array('teachers', $tables)) {
                $count = $db->query("SELECT count(*) FROM teachers")->fetchColumn();
                echo "Teachers count: $count\n";
                $tch = $db->query("SELECT id, nama, school_id, unit_kerja FROM teachers WHERE nama ILIKE '%Aminah%' OR nama ILIKE '%Siti Aminah%'")->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($tch)) {
                    echo "Found Teachers:\n";
                    print_r($tch);
                }
            }
            if (in_array('sk_documents', $tables)) {
                $count = $db->query("SELECT count(*) FROM sk_documents")->fetchColumn();
                echo "SK Documents count: $count\n";
                $sks = $db->query("SELECT id, nomor_sk, nama, unit_kerja, tanggal_penetapan, status, school_id FROM sk_documents WHERE nama ILIKE '%Aminah%' OR nama ILIKE '%Siti Aminah%'")->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($sks)) {
                    echo "Found SKs:\n";
                    print_r($sks);
                }
            }
        }
    } catch (\Exception $e) {
        echo "Error querying $dbname: " . $e->getMessage() . "\n";
    }
}
