<?php
/**
 * AI Pharmacy Settings - ตั้งค่า AI เภสัชออนไลน์
 * Version 2.0 - Professional Pharmacy AI Configuration
 */
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth_check.php';

$db = Database::getInstance()->getConnection();
$pageTitle = 'ตั้งค่า AI เภสัชออนไลน์';
$currentBotId = $_SESSION['current_bot_id'] ?? null;

// Ensure tables exist
try {
    $db->exec("CREATE TABLE IF NOT EXISTS ai_pharmacy_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        line_account_id INT DEFAULT NULL,
        triage_enabled TINYINT(1) DEFAULT 1,
        red_flag_enabled TINYINT(1) DEFAULT 1,
        auto_recommend TINYINT(1) DEFAULT 1,
        require_pharmacist_approval TINYINT(1) DEFAULT 1,
        video_call_enabled TINYINT(1) DEFAULT 1,
        notification_line_token VARCHAR(255) DEFAULT NULL,
        notification_email VARCHAR(255) DEFAULT NULL,
        working_hours_start TIME DEFAULT '09:00:00',
        working_hours_end TIME DEFAULT '21:00:00',
        emergency_contact VARCHAR(100) DEFAULT NULL,
        pharmacy_name VARCHAR(200) DEFAULT NULL,
        pharmacy_license VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_account (line_account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) {}

// Get current settings
$settings = [];
try {
    if ($currentBotId) {
        $stmt = $db->prepare("SELECT * FROM ai_pharmacy_settings WHERE line_account_id = ?");
        $stmt->execute([$currentBotId]);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    }
} catch (Exception $e) {}

// Handle POST
$success = null;
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'save_settings') {
        try {
            $data = [
                'line_account_id' => $currentBotId,
                'triage_enabled' => isset($_POST['triage_enabled']) ? 1 : 0,
                'red_flag_enabled' => isset($_POST['red_flag_enabled']) ? 1 : 0,
                'auto_recommend' => isset($_POST['auto_recommend']) ? 1 : 0,
                'require_pharmacist_approval' => isset($_POST['require_pharmacist_approval']) ? 1 : 0,
                'video_call_enabled' => isset($_POST['video_call_enabled']) ? 1 : 0,
                'notification_email' => trim($_POST['notification_email'] ?? ''),
                'working_hours_start' => $_POST['working_hours_start'] ?? '09:00',
                'working_hours_end' => $_POST['working_hours_end'] ?? '21:00',
                'emergency_contact' => trim($_POST['emergency_contact'] ?? ''),
                'pharmacy_name' => trim($_POST['pharmacy_name'] ?? ''),
                'pharmacy_license' => trim($_POST['pharmacy_license'] ?? ''),
            ];
            
            $stmt = $db->prepare("INSERT INTO ai_pharmacy_settings 
                (line_account_id, triage_enabled, red_flag_enabled, auto_recommend, require_pharmacist_approval, 
                 video_call_enabled, notification_email, working_hours_start, working_hours_end, 
                 emergency_contact, pharmacy_name, pharmacy_license)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                triage_enabled = VALUES(triage_enabled), red_flag_enabled = VALUES(red_flag_enabled),
                auto_recommend = VALUES(auto_recommend), require_pharmacist_approval = VALUES(require_pharmacist_approval),
                video_call_enabled = VALUES(video_call_enabled), notification_email = VALUES(notification_email),
                working_hours_start = VALUES(working_hours_start), working_hours_end = VALUES(working_hours_end),
                emergency_contact = VALUES(emergency_contact), pharmacy_name = VALUES(pharmacy_name),
                pharmacy_license = VALUES(pharmacy_license)");
            
            $stmt->execute(array_values($data));
            $success = 'บันทึกการตั้งค่าสำเร็จ';
            
            // Reload settings
            $stmt = $db->prepare("SELECT * FROM ai_pharmacy_settings WHERE line_account_id = ?");
            $stmt->execute([$currentBotId]);
            $settings = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            
        } catch (Exception $e) {
            $error = 'เกิดข้อผิดพลาด: ' . $e->getMessage();
        }
    }
}

// Default values
$triageEnabled = $settings['triage_enabled'] ?? 1;
$redFlagEnabled = $settings['red_flag_enabled'] ?? 1;
$autoRecommend = $settings['auto_recommend'] ?? 1;
$requireApproval = $settings['require_pharmacist_approval'] ?? 1;
$videoCallEnabled = $settings['video_call_enabled'] ?? 1;
$notificationEmail = $settings['notification_email'] ?? '';
$workingStart = $settings['working_hours_start'] ?? '09:00';
$workingEnd = $settings['working_hours_end'] ?? '21:00';
$emergencyContact = $settings['emergency_contact'] ?? '';
$pharmacyName = $settings['pharmacy_name'] ?? '';
$pharmacyLicense = $settings['pharmacy_license'] ?? '';

require_once __DIR__ . '/includes/header.php';
?>

<style>
.setting-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; transition: all 0.3s; }
.setting-card:hover { box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
.toggle-switch { position: relative; width: 52px; height: 28px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e2e8f0; border-radius: 28px; transition: 0.3s; }
.toggle-slider:before { position: absolute; content: ""; height: 22px; width: 22px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.toggle-switch input:checked + .toggle-slider { background: linear-gradient(135deg, #10b981, #059669); }
.toggle-switch input:checked + .toggle-slider:before { transform: translateX(24px); }
.feature-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.input-field { width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; transition: all 0.2s; }
.input-field:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
</style>

<div class="max-w-5xl mx-auto py-6 px-4">
    <?php if ($success): ?>
    <div class="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
        <i class="fas fa-check-circle text-xl"></i>
        <span><?= htmlspecialchars($success) ?></span>
    </div>
    <?php endif; ?>
    
    <?php if ($error): ?>
    <div class="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
        <i class="fas fa-exclamation-circle text-xl"></i>
        <span><?= htmlspecialchars($error) ?></span>
    </div>
    <?php endif; ?>

    <!-- Header -->
    <div class="mb-8">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-clinic-medical text-emerald-500 mr-2"></i>ตั้งค่า AI เภสัชออนไลน์
                </h1>
                <p class="text-gray-500 mt-1">กำหนดค่าระบบ Triage และการแนะนำยาอัตโนมัติ</p>
            </div>
            <a href="pharmacist-dashboard.php" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
            </a>
        </div>
    </div>

    <form method="POST">
        <input type="hidden" name="action" value="save_settings">
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Settings -->
            <div class="lg:col-span-2 space-y-6">
                
                <!-- Pharmacy Info -->
                <div class="setting-card p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <div class="feature-icon bg-blue-100">
                            <i class="fas fa-store-alt text-blue-500"></i>
                        </div>
                        ข้อมูลร้านยา
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">ชื่อร้านยา</label>
                            <input type="text" name="pharmacy_name" value="<?= htmlspecialchars($pharmacyName) ?>" 
                                   class="input-field" placeholder="เช่น ร้านยา ABC">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">เลขที่ใบอนุญาต</label>
                            <input type="text" name="pharmacy_license" value="<?= htmlspecialchars($pharmacyLicense) ?>" 
                                   class="input-field" placeholder="เช่น ข.ย. 12345">
                        </div>
                    </div>
                </div>

                <!-- Triage Settings -->
                <div class="setting-card p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <div class="feature-icon bg-emerald-100">
                            <i class="fas fa-stethoscope text-emerald-500"></i>
                        </div>
                        ระบบซักประวัติ (Triage)
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p class="font-medium text-gray-800">เปิดใช้งานระบบซักประวัติ</p>
                                <p class="text-sm text-gray-500">AI จะซักประวัติอาการเป็นขั้นตอนก่อนแนะนำยา</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" name="triage_enabled" <?= $triageEnabled ? 'checked' : '' ?>>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p class="font-medium text-gray-800">ตรวจจับอาการฉุกเฉิน (Red Flag)</p>
                                <p class="text-sm text-gray-500">แจ้งเตือนเมื่อพบอาการที่ต้องพบแพทย์ทันที</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" name="red_flag_enabled" <?= $redFlagEnabled ? 'checked' : '' ?>>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p class="font-medium text-gray-800">แนะนำยาอัตโนมัติ</p>
                                <p class="text-sm text-gray-500">AI จะแนะนำยาจากคลังสินค้าตามอาการ</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" name="auto_recommend" <?= $autoRecommend ? 'checked' : '' ?>>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p class="font-medium text-gray-800">ต้องให้เภสัชกรอนุมัติ</p>
                                <p class="text-sm text-gray-500">ลูกค้าต้องรอเภสัชกรยืนยันก่อนสั่งซื้อยา</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" name="require_pharmacist_approval" <?= $requireApproval ? 'checked' : '' ?>>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Video Call Settings -->
                <div class="setting-card p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <div class="feature-icon bg-purple-100">
                            <i class="fas fa-video text-purple-500"></i>
                        </div>
                        Video Call / Telecare
                    </h3>
                    
                    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                        <div>
                            <p class="font-medium text-gray-800">เปิดใช้งาน Video Call</p>
                            <p class="text-sm text-gray-500">ลูกค้าสามารถ Video Call ปรึกษาเภสัชกรได้</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="video_call_enabled" <?= $videoCallEnabled ? 'checked' : '' ?>>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">เวลาเปิดให้บริการ</label>
                            <input type="time" name="working_hours_start" value="<?= htmlspecialchars($workingStart) ?>" 
                                   class="input-field">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">เวลาปิดให้บริการ</label>
                            <input type="time" name="working_hours_end" value="<?= htmlspecialchars($workingEnd) ?>" 
                                   class="input-field">
                        </div>
                    </div>
                </div>

                <!-- Notification Settings -->
                <div class="setting-card p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <div class="feature-icon bg-yellow-100">
                            <i class="fas fa-bell text-yellow-500"></i>
                        </div>
                        การแจ้งเตือน
                    </h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">Email แจ้งเตือน</label>
                            <input type="email" name="notification_email" value="<?= htmlspecialchars($notificationEmail) ?>" 
                                   class="input-field" placeholder="pharmacist@example.com">
                            <p class="text-xs text-gray-400 mt-1">รับแจ้งเตือนเมื่อมีคำขอปรึกษาใหม่</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-600 mb-2">เบอร์ฉุกเฉิน</label>
                            <input type="text" name="emergency_contact" value="<?= htmlspecialchars($emergencyContact) ?>" 
                                   class="input-field" placeholder="เช่น 02-xxx-xxxx">
                            <p class="text-xs text-gray-400 mt-1">แสดงให้ลูกค้าเมื่อพบอาการฉุกเฉิน</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
                <!-- Save Button -->
                <div class="setting-card p-6">
                    <button type="submit" class="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all">
                        <i class="fas fa-save mr-2"></i>บันทึกการตั้งค่า
                    </button>
                </div>

                <!-- Quick Links -->
                <div class="setting-card p-6">
                    <h4 class="font-semibold text-gray-800 mb-4">
                        <i class="fas fa-link text-gray-400 mr-2"></i>ลิงก์ด่วน
                    </h4>
                    <div class="space-y-2">
                        <a href="ai-chat-settings.php" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                            <i class="fas fa-robot text-blue-500"></i>
                            <span class="text-sm">ตั้งค่า AI Chat</span>
                        </a>
                        <a href="pharmacist-dashboard.php" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                            <i class="fas fa-tachometer-alt text-green-500"></i>
                            <span class="text-sm">Pharmacist Dashboard</span>
                        </a>
                        <a href="broadcast-catalog.php" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                            <i class="fas fa-pills text-purple-500"></i>
                            <span class="text-sm">จัดการสินค้า/ยา</span>
                        </a>
                        <a href="run_triage_migration.php" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                            <i class="fas fa-database text-orange-500"></i>
                            <span class="text-sm">Run Migration</span>
                        </a>
                    </div>
                </div>

                <!-- Features Info -->
                <div class="setting-card p-6">
                    <h4 class="font-semibold text-gray-800 mb-4">
                        <i class="fas fa-info-circle text-blue-400 mr-2"></i>ฟีเจอร์ระบบ
                    </h4>
                    <ul class="space-y-3 text-sm text-gray-600">
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>ซักประวัติอาการอัตโนมัติ</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>ตรวจจับอาการฉุกเฉิน (Red Flag)</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>ตรวจสอบยาตีกัน</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>ตรวจสอบการแพ้ยา</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>แนะนำยาจากคลังสินค้า</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>Video Call กับเภสัชกร</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                            <span>บันทึกประวัติการรักษา</span>
                        </li>
                    </ul>
                </div>

                <!-- Flow Diagram -->
                <div class="setting-card p-6">
                    <h4 class="font-semibold text-gray-800 mb-4">
                        <i class="fas fa-project-diagram text-purple-400 mr-2"></i>Flow การทำงาน
                    </h4>
                    <div class="space-y-2 text-xs">
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">1</span>
                            <span class="text-gray-600">ลูกค้าบอกอาการ</span>
                        </div>
                        <div class="w-0.5 h-4 bg-gray-200 ml-3"></div>
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center font-bold">2</span>
                            <span class="text-gray-600">AI ซักประวัติเพิ่มเติม</span>
                        </div>
                        <div class="w-0.5 h-4 bg-gray-200 ml-3"></div>
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">3</span>
                            <span class="text-gray-600">ตรวจ Red Flag / แพ้ยา</span>
                        </div>
                        <div class="w-0.5 h-4 bg-gray-200 ml-3"></div>
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">4</span>
                            <span class="text-gray-600">แนะนำยา + รอเภสัชยืนยัน</span>
                        </div>
                        <div class="w-0.5 h-4 bg-gray-200 ml-3"></div>
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">5</span>
                            <span class="text-gray-600">สั่งซื้อ / Video Call</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
