<?php
$pdo = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=sim_maarif', 'sim_user', 'secret');
$stmt = $pdo->query("SELECT * FROM teachers WHERE nama LIKE '%MIFTAHUDDIN%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
