<?php

declare(strict_types=1);

namespace EventFlow;

use PDO;
use PDOException;

final class DB
{
    private static ?PDO $pdo = null;

    /** @param array{dsn:string,user:string,pass:string} $config */
    public static function init(array $config): void
    {
        if (self::$pdo !== null) {
            return;
        }
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
        ];
        self::$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], $options);
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            throw new PDOException('DB not initialized');
        }
        return self::$pdo;
    }
}
