<?php
$tests = [
    ["pgsql:host=127.0.0.1;port=5433;dbname=sim_maarif", "sim_user", "secret"],
    ["pgsql:host=localhost;port=5433;dbname=sim_maarif", "sim_user", "secret"],
    ["pgsql:host=127.0.0.1;port=5433;dbname=postgres", "postgres", "postgres"],
    ["pgsql:host=127.0.0.1;port=5433;dbname=postgres", "postgres", ""],
];

foreach ($tests as $i => $t) {
    echo "Test $i: DSN={$t[0]} user={$t[1]} pw='{$t[2]}'\n";
    try {
        $pdo = new PDO($t[0], $t[1], $t[2], [PDO::ATTR_TIMEOUT => 3]);
        echo "  => SUCCESS!\n";
        
        $pdo = null;
        exit(0);
    } catch (Exception $e) {
        echo "  => FAILED: " . substr($e->getMessage(), 0, 100) . "\n";
    }
}
