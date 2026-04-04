<?php
$content = "APP_NAME=\"SIM Maarif\"\nAPP_ENV=local\nAPP_KEY=base64:pvkS9qqRkHQLv8i+6EExWyKkvxeTiKbZa1Oz0Ug5YIU=\nAPP_DEBUG=true\nAPP_URL=http://localhost:8000\n\nDB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=sim_maarif\nDB_USERNAME=sim_user\nDB_PASSWORD=secret\n\nSESSION_DRIVER=database\nCACHE_STORE=database\n\n";
file_put_contents('.env', $content);
echo "Clean .env written via Tinker.\n";
