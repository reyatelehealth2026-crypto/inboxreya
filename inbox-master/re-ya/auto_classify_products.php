<?php
/**
 * Auto Classify Products
 * จัดหมวดหมู่สินค้าอัตโนมัติโดยใช้ keyword matching
 * จาก properties_other, spec_name, name, description
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300);

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

$db = Database::getInstance()->getConnection();

echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Auto Classify Products</title>";
echo "<style>
body { font-family: 'Segoe UI', sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
.card { background: white; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
h1 { color: #1E293B; } h2 { color: #475569; }
.success { color: #10B981; } .error { color: #EF4444; } .warning { color: #F59E0B; } .info { color: #3B82F6; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; }
th, td { padding: 8px; text-align: left; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
th { background: #F8FAFC; }
.btn { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; margin: 5px; }
.btn:hover { background: #059669; }
.btn-blue { background: #3B82F6; } .btn-blue:hover { background: #2563EB; }
.btn-red { background: #EF4444; } .btn-red:hover { background: #DC2626; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 1px; }
.badge-green { background: #D1FAE5; color: #065F46; }
.badge-blue { background: #DBEAFE; color: #1E40AF; }
</style></head><body>";

echo "<h1>🤖 Auto Classify Products</h1>";

// ========== Category Keywords Mapping ==========
// ใช้ชื่อตัวยา (Generic Name) เป็นหลัก - เฉพาะเจาะจงมากขึ้น
// Priority: 1=สูงสุด (ชื่อยาเฉพาะ), 2=กลาง, 3=ต่ำ (คำทั่วไป)
$categoryKeywords = [
    'CNS' => [
        'name' => 'ระบบประสาทส่วนกลาง',
        'keywords' => ['paracetamol', 'acetaminophen', 'tramadol', 'gabapentin', 'pregabalin', 'amitriptyline', 'diazepam', 'clonazepam', 'phenobarbital', 'carbamazepine', 'valproic', 'phenytoin', 'topiramate', 'levetiracetam', 'alprazolam', 'lorazepam', 'morphine', 'codeine', 'ไมเกรน', 'ลมชัก', 'กันชัก']
    ],
    'IMM' => [
        'name' => 'แก้แพ้และภูมิคุ้มกัน',
        'keywords' => ['cetirizine', 'loratadine', 'fexofenadine', 'chlorpheniramine', 'desloratadine', 'hydroxyzine', 'diphenhydramine', 'levocetirizine', 'bilastine', 'ebastine', 'ภูมิแพ้', 'ลมพิษ', 'antihistamine']
    ],
    'MSJ' => [
        'name' => 'ระบบกล้ามเนื้อและข้อ',
        'keywords' => ['ibuprofen', 'diclofenac', 'naproxen', 'meloxicam', 'piroxicam', 'etoricoxib', 'celecoxib', 'colchicine', 'allopurinol', 'glucosamine', 'chondroitin', 'diacerein', 'indomethacin', 'ketoprofen', 'mefenamic', 'orphenadrine', 'methocarbamol', 'baclofen', 'tizanidine', 'เกาต์', 'ข้ออักเสบ', 'รูมาตอยด์']
    ],
    'RIS' => [
        'name' => 'ระบบทางเดินหายใจ',
        'keywords' => ['salbutamol', 'bromhexine', 'ambroxol', 'dextromethorphan', 'guaifenesin', 'pseudoephedrine', 'theophylline', 'montelukast', 'budesonide', 'fluticasone', 'ipratropium', 'terbutaline', 'carbocisteine', 'acetylcysteine', 'codeine phosphate', 'หลอดลม', 'หอบหืด', 'ละลายเสมหะ']
    ],
    'HCD' => [
        'name' => 'อุปกรณ์ดูแลสุขภาพ',
        'keywords' => ['thermometer', 'syringe', 'bandage', 'gauze', 'cotton', 'mask', 'glove', 'เครื่องวัดความดัน', 'เครื่องวัดน้ำตาล', 'ผ้าพันแผล', 'พลาสเตอร์', 'สำลี', 'เข็มฉีดยา', 'ถุงมือ', 'หน้ากากอนามัย']
    ],
    'VIT' => [
        'name' => 'วิตามิน เกลือแร่',
        'keywords' => ['vitamin a', 'vitamin b', 'vitamin c', 'vitamin d', 'vitamin e', 'vitamin k', 'ascorbic acid', 'thiamine', 'riboflavin', 'niacin', 'pyridoxine', 'cyanocobalamin', 'folic acid', 'biotin', 'pantothenic', 'multivitamin', 'ferrous', 'calcium carbonate', 'calcium citrate', 'zinc sulfate', 'magnesium', 'potassium', 'วิตามินรวม', 'ธาตุเหล็ก', 'แคลเซียม']
    ],
    'HER' => [
        'name' => 'สมุนไพรและยาแผนโบราณ',
        'keywords' => ['andrographis', 'curcumin', 'ginger extract', 'turmeric', 'ฟ้าทะลายโจร', 'ขมิ้นชัน', 'กระชายขาว', 'มะขามป้อม', 'บัวบก', 'ยาหม่อง', 'ยาดม', 'น้ำมันระกำ', 'ยาแผนโบราณ', 'สมุนไพร']
    ],
    'FMC' => [
        'name' => 'สินค้าอุปโภค-บริโภค',
        'keywords' => ['soap', 'shampoo', 'toothpaste', 'toothbrush', 'diaper', 'tissue', 'sanitary pad', 'สบู่', 'แชมพู', 'ยาสีฟัน', 'แปรงสีฟัน', 'ผ้าอนามัย', 'ผ้าอ้อม', 'กระดาษทิชชู่', 'ครีมอาบน้ำ']
    ],
    'HOR' => [
        'name' => 'ฮอร์โมน ยาคุมกำเนิด สูตินรี',
        'keywords' => ['estrogen', 'progesterone', 'testosterone', 'levonorgestrel', 'norethisterone', 'ethinylestradiol', 'desogestrel', 'drospirenone', 'medroxyprogesterone', 'tamsulosin', 'finasteride', 'dutasteride', 'sildenafil', 'tadalafil', 'คุมกำเนิด', 'ฮอร์โมนเพศ', 'ต่อมลูกหมาก']
    ],
    'CDS' => [
        'name' => 'ระบบหัวใจและหลอดเลือด',
        'keywords' => ['amlodipine', 'atenolol', 'losartan', 'enalapril', 'lisinopril', 'valsartan', 'simvastatin', 'atorvastatin', 'rosuvastatin', 'aspirin', 'clopidogrel', 'warfarin', 'digoxin', 'furosemide', 'hydrochlorothiazide', 'spironolactone', 'metoprolol', 'propranolol', 'diltiazem', 'nifedipine', 'ความดันโลหิต', 'คอเลสเตอรอล', 'หัวใจ']
    ],
    'INF' => [
        'name' => 'การติดเชื้อ',
        'keywords' => ['amoxicillin', 'azithromycin', 'ciprofloxacin', 'metronidazole', 'clotrimazole', 'fluconazole', 'acyclovir', 'oseltamivir', 'doxycycline', 'cephalexin', 'cefixime', 'levofloxacin', 'norfloxacin', 'cotrimoxazole', 'erythromycin', 'clarithromycin', 'clindamycin', 'gentamicin', 'ปฏิชีวนะ', 'ฆ่าเชื้อ', 'ต้านไวรัส']
    ],
    'GIS' => [
        'name' => 'ระบบทางเดินอาหาร',
        'keywords' => ['omeprazole', 'esomeprazole', 'pantoprazole', 'ranitidine', 'famotidine', 'antacid', 'loperamide', 'domperidone', 'metoclopramide', 'lactulose', 'bisacodyl', 'sennoside', 'simethicone', 'activated charcoal', 'oral rehydration', 'ors', 'ยาลดกรด', 'ท้องเสีย', 'ท้องผูก', 'กระเพาะ']
    ],
    'SKI' => [
        'name' => 'ระบบผิวหนัง',
        'keywords' => ['clotrimazole cream', 'ketoconazole cream', 'hydrocortisone cream', 'betamethasone', 'mometasone', 'mupirocin', 'fusidic acid', 'silver sulfadiazine', 'tretinoin', 'adapalene', 'benzoyl peroxide', 'salicylic acid', 'calamine', 'ครีมทาผิว', 'ยาทาแผล', 'กลาก', 'เกลื้อน', 'สิว']
    ],
    'NUT' => [
        'name' => 'ผลิตภัณฑ์เสริมอาหาร',
        'keywords' => ['whey protein', 'collagen peptide', 'omega-3', 'fish oil', 'evening primrose', 'coenzyme q10', 'lutein', 'glucosamine supplement', 'probiotic', 'prebiotic', 'spirulina', 'chlorella', 'royal jelly', 'อาหารเสริม', 'โปรตีน', 'คอลลาเจน', 'น้ำมันปลา']
    ],
    'COS' => [
        'name' => 'เวชสำอางค์และเครื่องสำอาง',
        'keywords' => ['sunscreen', 'moisturizer', 'cleanser', 'toner', 'serum', 'eye cream', 'lip balm', 'foundation', 'concealer', 'mascara', 'lipstick', 'กันแดด', 'ครีมบำรุงผิว', 'เซรั่ม', 'โลชั่น', 'เครื่องสำอาง', 'เวชสำอาง']
    ],
    'SHP' => [
        'name' => 'ค่าขนส่ง',
        'keywords' => ['shipping fee', 'delivery charge', 'ค่าขนส่ง', 'ค่าจัดส่ง', 'ค่าส่ง']
    ],
    'END' => [
        'name' => 'ระบบต่อมไร้ท่อ',
        'keywords' => ['metformin', 'glipizide', 'gliclazide', 'glibenclamide', 'pioglitazone', 'sitagliptin', 'insulin', 'levothyroxine', 'propylthiouracil', 'methimazole', 'dexamethasone', 'prednisolone', 'hydrocortisone tablet', 'เบาหวาน', 'ไทรอยด์', 'น้ำตาลในเลือด']
    ],
    'ENT' => [
        'name' => 'ตา หู จมูก และช่องปาก',
        'keywords' => ['artificial tears', 'eye drop', 'ear drop', 'nasal spray', 'oxymetazoline', 'xylometazoline', 'chlorhexidine mouthwash', 'benzydamine', 'nystatin oral', 'ciprofloxacin eye', 'tobramycin eye', 'น้ำตาเทียม', 'ยาหยอดตา', 'ยาหยอดหู', 'สเปรย์พ่นจมูก', 'น้ำยาบ้วนปาก']
    ],
    'OFC' => [
        'name' => 'อุปกรณ์สำนักงาน',
        'keywords' => ['office supplies', 'paper', 'pen', 'อุปกรณ์สำนักงาน', 'กระดาษ', 'ปากกา', 'เครื่องเขียน']
    ],
    'ELE' => [
        'name' => 'อุปกรณ์เครื่องใช้ไฟฟ้า',
        'keywords' => ['electrical', 'เครื่องใช้ไฟฟ้า', 'หลอดไฟ', 'พัดลม', 'เครื่องปรับอากาศ']
    ],
    'OTC' => [
        'name' => 'ยาสามัญประจำบ้าน',
        'keywords' => ['ยาสามัญประจำบ้าน', 'ยาธาตุน้ำขาว', 'ยาหอมทิพโอสถ', 'ยาหอมนวโกฐ', 'ยาธาตุบรรจบ', 'ยาแก้ไอน้ำดำ', 'ยาอมมะแว้ง', 'ยาหม่องตราเสือ', 'ยาดมโป๊ยเซียน']
    ],
    'SM' => [
        'name' => 'สินค้าสมนาคุณ',
        'keywords' => ['สมนาคุณ', 'ของแถม', 'ของขวัญ', 'gift item', 'free gift', 'promotional item']
    ],
];

// Detect categories table
$catTable = 'item_categories';
try {
    $db->query("SELECT 1 FROM item_categories LIMIT 1");
} catch (Exception $e) {
    $catTable = 'product_categories';
}

// ========== Build Category Map ==========
$catMap = []; // code => id
$stmt = $db->query("SELECT id, cny_code, name FROM $catTable WHERE cny_code IS NOT NULL");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $catMap[$row['cny_code']] = $row['id'];
}

// ========== Function to classify product ==========
// ใช้ spec_name (ชื่อตัวยา) เป็นหลัก เพราะเฉพาะเจาะจงที่สุด
// + กฎพิเศษ: [LG] = สมนาคุณ, ไม่ใช่ยา = General
function classifyProduct($product, $categoryKeywords) {
    $productName = $product['name'] ?? '';
    $specName = strtolower($product['generic_name'] ?? '');
    $description = strtolower($product['description'] ?? '');
    $productNameLower = strtolower($productName);
    
    // ========== กฎพิเศษ 1: [LG] = สินค้าสมนาคุณ (SM) ==========
    if (strpos($productName, '[LG]') !== false || strpos($productName, '[lg]') !== false) {
        return 'SM';
    }
    
    // ========== กฎพิเศษ 2: ตรวจสอบว่าเป็นยาหรือไม่ ==========
    // ถ้าไม่มี generic_name และไม่ match กับ keywords ยา = General (FMC)
    $isLikelyMedicine = false;
    
    // เช็คว่ามี generic_name หรือไม่
    if (!empty($specName) && strlen($specName) > 3) {
        $isLikelyMedicine = true;
    }
    
    // เช็คคำที่บ่งบอกว่าเป็นยา
    $medicineIndicators = ['mg', 'ml', 'mcg', 'iu', 'tablet', 'capsule', 'syrup', 'cream', 'ointment', 'injection', 'suspension', 'solution', 'drop', 'เม็ด', 'แคปซูล', 'ยา', 'ครีม', 'ขี้ผึ้ง', 'น้ำเชื่อม', 'ยาหยอด', 'ยาฉีด'];
    foreach ($medicineIndicators as $indicator) {
        if (mb_stripos($productNameLower, $indicator) !== false || mb_stripos($specName, $indicator) !== false) {
            $isLikelyMedicine = true;
            break;
        }
    }
    
    // ========== ค้นหาจาก keywords ==========
    $scores = [];
    foreach ($categoryKeywords as $code => $data) {
        $score = 0;
        foreach ($data['keywords'] as $keyword) {
            $kw = strtolower($keyword);
            // spec_name มีน้ำหนักสูงสุด
            if (!empty($specName) && mb_stripos($specName, $kw) !== false) {
                $score += 3;
            }
            // ชื่อสินค้า
            if (mb_stripos($productNameLower, $kw) !== false) {
                $score += 2;
            }
            // description น้ำหนักต่ำสุด
            if (mb_stripos($description, $kw) !== false) {
                $score += 1;
            }
        }
        if ($score > 0) {
            $scores[$code] = $score;
        }
    }
    
    // ถ้า match ได้ ใช้ category ที่ score สูงสุด
    if (!empty($scores)) {
        arsort($scores);
        return array_key_first($scores);
    }
    
    // ========== กฎพิเศษ 3: ไม่ match และไม่ใช่ยา = General (FMC) ==========
    if (!$isLikelyMedicine) {
        return 'FMC'; // สินค้าอุปโภค-บริโภค / General
    }
    
    // ไม่สามารถจัดหมวดหมู่ได้
    return null;
}

// ========== Process Classification ==========
if (isset($_POST['classify_all'])) {
    echo "<div class='card'>";
    echo "<h2>🔄 กำลังจัดหมวดหมู่สินค้า...</h2>";
    
    // Get products without category
    $stmt = $db->query("SELECT id, sku, name, description, generic_name FROM business_items WHERE category_id IS NULL OR category_id = 0");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $total = count($products);
    $classified = 0;
    $unclassified = 0;
    $results = [];
    
    foreach ($products as $p) {
        $catCode = classifyProduct($p, $categoryKeywords);
        
        if ($catCode && isset($catMap[$catCode])) {
            $stmt = $db->prepare("UPDATE business_items SET category_id = ? WHERE id = ?");
            $stmt->execute([$catMap[$catCode], $p['id']]);
            $classified++;
            
            if (!isset($results[$catCode])) {
                $results[$catCode] = 0;
            }
            $results[$catCode]++;
        } else {
            $unclassified++;
        }
    }
    
    echo "<p class='success'>✓ จัดหมวดหมู่สำเร็จ: <strong>$classified</strong> รายการ</p>";
    
    if (count($results) > 0) {
        echo "<table><tr><th>Category</th><th>จำนวน</th></tr>";
        arsort($results);
        foreach ($results as $code => $count) {
            $name = $categoryKeywords[$code]['name'] ?? $code;
            echo "<tr><td>$code - $name</td><td>$count</td></tr>";
        }
        echo "</table>";
    }
    
    if ($unclassified > 0) {
        echo "<p class='warning'>⚠️ ไม่สามารถจัดหมวดหมู่ได้: $unclassified รายการ</p>";
    }
    
    echo "</div>";
}

// ========== Preview Classification ==========
if (isset($_POST['preview'])) {
    echo "<div class='card'>";
    echo "<h2>👁️ Preview การจัดหมวดหมู่</h2>";
    
    $stmt = $db->query("SELECT id, sku, name, description, generic_name FROM business_items WHERE category_id IS NULL OR category_id = 0 LIMIT 50");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<table>";
    echo "<tr><th>SKU</th><th>Name</th><th>Suggested Category</th></tr>";
    
    foreach ($products as $p) {
        $catCode = classifyProduct($p, $categoryKeywords);
        $catName = $catCode ? ($catCode . ' - ' . ($categoryKeywords[$catCode]['name'] ?? '')) : '<span class="warning">ไม่พบ</span>';
        
        echo "<tr>";
        echo "<td>{$p['sku']}</td>";
        echo "<td>" . mb_substr($p['name'], 0, 40) . "</td>";
        echo "<td>$catName</td>";
        echo "</tr>";
    }
    echo "</table>";
    echo "</div>";
}

// ========== Current Status ==========
echo "<div class='card'>";
echo "<h2>📊 สถานะปัจจุบัน</h2>";

$stmt = $db->query("SELECT COUNT(*) FROM business_items");
$totalProducts = $stmt->fetchColumn();

$stmt = $db->query("SELECT COUNT(*) FROM business_items WHERE category_id IS NOT NULL AND category_id > 0");
$withCategory = $stmt->fetchColumn();

$noCategory = $totalProducts - $withCategory;

echo "<table>";
echo "<tr><td>สินค้าทั้งหมด</td><td><strong>$totalProducts</strong></td></tr>";
echo "<tr><td class='success'>มี category แล้ว</td><td class='success'><strong>$withCategory</strong></td></tr>";
echo "<tr><td class='" . ($noCategory > 0 ? 'warning' : 'success') . "'>ไม่มี category</td><td class='" . ($noCategory > 0 ? 'warning' : 'success') . "'><strong>$noCategory</strong></td></tr>";
echo "<tr><td>Categories ในระบบ</td><td><strong>" . count($catMap) . "</strong></td></tr>";
echo "</table>";
echo "</div>";

// ========== Actions ==========
echo "<div class='card'>";
echo "<h2>🚀 Actions</h2>";

if (count($catMap) == 0) {
    echo "<p class='warning'>⚠️ ยังไม่มี categories ในระบบ - กรุณาสร้างก่อน</p>";
    echo "<a href='setup_categories.php' class='btn btn-blue'>➕ สร้าง 22 Categories</a>";
} else {
    echo "<form method='POST' style='margin-bottom:15px;'>";
    echo "<button type='submit' name='preview' class='btn btn-blue'>👁️ Preview (ดูตัวอย่าง 50 รายการ)</button>";
    echo "</form>";
    
    echo "<form method='POST'>";
    echo "<p>ระบบจะจัดหมวดหมู่โดยใช้ keyword matching จากชื่อสินค้า, คำอธิบาย, สรรพคุณ</p>";
    echo "<button type='submit' name='classify_all' class='btn'>🤖 Auto Classify All ($noCategory รายการ)</button>";
    echo "</form>";
}
echo "</div>";

// ========== Category Keywords Reference ==========
echo "<div class='card'>";
echo "<h2>📚 Keywords Reference</h2>";
echo "<p>ระบบใช้ keywords เหล่านี้ในการจัดหมวดหมู่:</p>";

echo "<table>";
echo "<tr><th>Code</th><th>Category</th><th>Keywords (ตัวอย่าง)</th></tr>";
foreach ($categoryKeywords as $code => $data) {
    $sampleKeywords = array_slice($data['keywords'], 0, 8);
    $keywordBadges = '';
    foreach ($sampleKeywords as $kw) {
        $keywordBadges .= "<span class='badge badge-blue'>$kw</span> ";
    }
    if (count($data['keywords']) > 8) {
        $keywordBadges .= "<span class='badge'>+" . (count($data['keywords']) - 8) . " more</span>";
    }
    
    echo "<tr>";
    echo "<td><strong>$code</strong></td>";
    echo "<td>{$data['name']}</td>";
    echo "<td>$keywordBadges</td>";
    echo "</tr>";
}
echo "</table>";
echo "</div>";

echo "<p style='text-align:center;color:#94A3B8;margin-top:20px;'>Generated at " . date('Y-m-d H:i:s') . "</p>";
echo "</body></html>";
