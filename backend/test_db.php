<?php
// Try connecting with different methods to find what actually works
$tests = [
    // Unix socket / peer (Windows - named pipe)
    ["pgsql:host=localhost;port=5432;dbname=postgres", "postgres", ""],
    ["pgsql:host=localhost;port=5432;dbname=postgres", "postgres", "postgres"],
    ["pgsql:host=127.0.0.1;port=5432;dbname=postgres", "postgres", ""],
    ["pgsql:host=127.0.0.1;port=5432;dbname=postgres", "postgres", "postgres"],
];

foreach ($tests as $i => $t) {
    echo "Test $i: DSN={$t[0]} user={$t[1]} pw='{$t[2]}'\n";
    try {
        $pdo = new PDO($t[0], $t[1], $t[2], [PDO::ATTR_TIMEOUT => 3]);
        echo "  => SUCCESS!\n";
        
        // List databases
        $dbs = $pdo->query("SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname")->fetchAll(PDO::FETCH_COLUMN);
        echo "  Databases: " . implode(', ', $dbs) . "\n";
        
        // List all roles
        $roles = $pdo->query("SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg_%'")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($roles as $r) {
            echo "  Role: {$r['rolname']} super={$r['rolsuper']} login={$r['rolcanlogin']}\n";
        }
        
        $pdo = null;
    } catch (Exception $e) {
        echo "  => FAILED: " . substr($e->getMessage(), 0, 100) . "\n";
    }
    echo "\n";
}
