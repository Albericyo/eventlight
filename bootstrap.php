<?php

declare(strict_types=1);

$root = __DIR__;
require_once $root . '/vendor/autoload.php';

$config = require $root . '/config.php';

\EventFlow\DB::init($config['db']);
