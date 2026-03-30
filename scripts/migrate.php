<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/vendor/autoload.php';

$config = require $root . '/config.php';
$db = $config['db'];
$sqlFile = $root . '/migrations/001_eventflow_init.sql';
if (!is_readable($sqlFile)) {
    fwrite(STDERR, "Fichier SQL introuvable: $sqlFile\n");
    exit(1);
}
$sql = file_get_contents($sqlFile);
if ($sql === false) {
    fwrite(STDERR, "Lecture SQL impossible.\n");
    exit(1);
}

$dsn = $db['dsn'];
$host = '127.0.0.1';
$dbname = 'eventflow';
if (preg_match('/host=([^;]+)/', $dsn, $m)) {
    $host = $m[1];
}
if (preg_match('/dbname=([^;]+)/', $dsn, $m)) {
    $dbname = $m[1];
}

$mysqli = new mysqli($host, $db['user'], $db['pass'], $dbname);
if ($mysqli->connect_error) {
    fwrite(STDERR, 'Connexion MySQL: ' . $mysqli->connect_error . "\n");
    exit(1);
}
$mysqli->set_charset('utf8mb4');

if (!$mysqli->multi_query($sql)) {
    fwrite(STDERR, 'Erreur SQL: ' . $mysqli->error . "\n");
    exit(1);
}
do {
    if ($result = $mysqli->store_result()) {
        $result->free();
    }
} while ($mysqli->more_results() && $mysqli->next_result());

echo "OK — migrations/001_eventflow_init.sql appliquée.\n";
