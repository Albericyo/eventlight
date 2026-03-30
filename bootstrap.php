<?php

declare(strict_types=1);

$root = __DIR__;
if (!is_file($root . '/vendor/autoload.php')) {
    throw new RuntimeException('Dépendances manquantes : exécutez composer install à la racine du projet.');
}
require_once $root . '/vendor/autoload.php';

$config = require $root . '/config.php';

\EventFlow\DB::init($config['db']);
