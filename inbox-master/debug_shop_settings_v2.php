<?php
require_once __DIR__ . '/re-ya/config/config.php';
require_once __DIR__ . '/re-ya/config/database.php';

try {
    $db = Database::getInstance()->getConnection();

    echo "Querying shop_settings...\n";
    $stmt = $db->query("SELECT * FROM shop_settings");
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($settings)) {
        echo "No shop_settings found.\n";
    } else {
        foreach ($settings as $row) {
            echo "ID: " . ($row['id'] ?? 'N/A') . "\n";
            echo "Line Account ID: " . ($row['line_account_id'] ?? 'N/A') . "\n";
            echo "Shipping Fee: " . ($row['shipping_fee'] ?? 'N/A') . "\n";
            echo "Free Shipping Min: " . ($row['free_shipping_min'] ?? 'N/A') . "\n";
            echo "-------------------\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
