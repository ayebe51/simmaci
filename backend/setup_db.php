<?php
try {
    $pdo = new PDO("pgsql:host=localhost;port=5432;dbname=postgres", "postgres", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected!\n";

    // Create sim_maarif database  
    $stmt = $pdo->query("SELECT 1 FROM pg_database WHERE datname = 'sim_maarif'");
    if (!$stmt->fetchColumn()) {
        $pdo->exec("CREATE DATABASE sim_maarif");
        echo "Created database sim_maarif\n";
    } else {
        echo "Database sim_maarif already exists\n";
    }

    // Create sim_user
    $stmt = $pdo->query("SELECT 1 FROM pg_roles WHERE rolname = 'sim_user'");
    if (!$stmt->fetchColumn()) {
        $pdo->exec("CREATE USER sim_user WITH PASSWORD 'secret' LOGIN");
        echo "Created user sim_user\n";
    } else {
        echo "User sim_user already exists, resetting password.\n";
        $pdo->exec("ALTER USER sim_user WITH PASSWORD 'secret' LOGIN");
    }

    // Grant privileges on database
    $pdo->exec("GRANT ALL PRIVILEGES ON DATABASE sim_maarif TO sim_user");
    echo "Granted db privileges\n";

    // Connect to sim_maarif and grant schema privileges  
    $pdo2 = new PDO("pgsql:host=localhost;port=5432;dbname=sim_maarif", "postgres", "");
    $pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo2->exec("GRANT ALL ON SCHEMA public TO sim_user");
    $pdo2->exec("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sim_user");
    $pdo2->exec("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sim_user");
    echo "Granted schema privileges\n";

    echo "\nDONE! Now test sim_user connection...\n";

    // Test sim_user connection via localhost
    $pdo3 = new PDO("pgsql:host=localhost;port=5432;dbname=sim_maarif", "sim_user", "secret");
    echo "sim_user@localhost connection: SUCCESS!\n";
    $pdo3 = null;

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
