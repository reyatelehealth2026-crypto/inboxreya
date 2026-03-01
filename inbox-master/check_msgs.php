<?php
require_once __DIR__ . '/../re-ya/config/config.php';
require_once __DIR__ . '/../re-ya/config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->query("DESCRIBE messages");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo $col['Field'] . " (" . $col['Type'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
