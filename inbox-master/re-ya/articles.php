<?php
/**
 * Articles Listing Page
 * หน้ารวมบทความทั้งหมด
 */

require_once 'config/config.php';
require_once 'config/database.php';
require_once 'classes/HealthArticleService.php';

$db = Database::getInstance()->getConnection();

// Get LINE account
$lineAccount = null;
try {
    $stmt = $db->query("SELECT * FROM line_accounts WHERE is_default = 1 LIMIT 1");
    $lineAccount = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$lineAccount) {
        $stmt = $db->query("SELECT * FROM line_accounts ORDER BY id ASC LIMIT 1");
        $lineAccount = $stmt->fetch(PDO::FETCH_ASSOC);
    }
} catch (Exception $e) {}

$lineAccountId = $lineAccount['id'] ?? 1;

// Get shop settings
$shopSettings = [];
try {
    $stmt = $db->prepare("SELECT * FROM shop_settings WHERE line_account_id = ? LIMIT 1");
    $stmt->execute([$lineAccountId]);
    $shopSettings = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$shopName = $shopSettings['shop_name'] ?? 'LINE Telepharmacy';
$shopLogo = $shopSettings['shop_logo'] ?? '';

// Initialize service
$articleService = new HealthArticleService($db, $lineAccountId);

// Get categories
$categories = $articleService->getCategories();

// Filter by category
$categoryId = isset($_GET['category']) ? (int)$_GET['category'] : null;
$searchQuery = $_GET['q'] ?? '';

// Get articles
if ($searchQuery) {
    $articles = $articleService->search($searchQuery, 20);
} else {
    $articles = $articleService->getPublishedArticles(20, $categoryId);
}

// Theme colors
require_once 'classes/LandingPageRenderer.php';
$primaryColor = LandingPageRenderer::DEFAULT_PRIMARY_COLOR;
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="<?= htmlspecialchars($primaryColor) ?>">
    
    <title>บทความสุขภาพ | <?= htmlspecialchars($shopName) ?></title>
    <meta name="description" content="บทความสุขภาพ ความรู้เรื่องยา วิตามิน และการดูแลสุขภาพจาก <?= htmlspecialchars($shopName) ?>">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --primary: <?= htmlspecialchars($primaryColor) ?>;
            --primary-light: #E8F5E9;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Sarabun', sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #1F2937;
            background: #F8FAFC;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 16px;
        }
        
        /* Header */
        .page-header {
            background: white;
            padding: 12px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .logo-link {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: #1F2937;
            font-weight: 600;
        }
        
        .logo-link img {
            width: 40px;
            height: 40px;
            border-radius: 10px;
        }
        
        .back-home {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6B7280;
            text-decoration: none;
            font-size: 14px;
        }
        
        .back-home:hover { color: var(--primary); }
        
        /* Hero */
        .articles-hero {
            background: linear-gradient(135deg, var(--primary) 0%, #059669 100%);
            color: white;
            padding: 48px 0;
            text-align: center;
        }
        
        .articles-hero h1 {
            font-size: 2rem;
            margin-bottom: 8px;
        }
        
        .articles-hero p {
            opacity: 0.9;
        }
        
        /* Search */
        .search-section {
            padding: 24px 0;
            background: white;
            border-bottom: 1px solid #E5E7EB;
        }
        
        .search-form {
            display: flex;
            gap: 12px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .search-input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #E5E7EB;
            border-radius: 12px;
            font-size: 16px;
            font-family: inherit;
        }
        
        .search-input:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .search-btn {
            padding: 12px 24px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        
        .search-btn:hover {
            opacity: 0.9;
        }
        
        /* Categories */
        .categories-section {
            padding: 20px 0;
            background: white;
            overflow-x: auto;
        }
        
        .categories-list {
            display: flex;
            gap: 12px;
            padding: 0 16px;
            min-width: max-content;
        }
        
        .category-btn {
            padding: 8px 20px;
            background: #F3F4F6;
            color: #4B5563;
            border: none;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            transition: all 0.2s;
        }
        
        .category-btn:hover,
        .category-btn.active {
            background: var(--primary);
            color: white;
        }
        
        /* Articles Grid */
        .articles-section {
            padding: 32px 0 64px;
        }
        
        .articles-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
        }
        
        @media (min-width: 640px) {
            .articles-grid { grid-template-columns: repeat(2, 1fr); }
        }
        
        @media (min-width: 1024px) {
            .articles-grid { grid-template-columns: repeat(3, 1fr); }
        }
        
        .article-card {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            text-decoration: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.3s;
        }
        
        .article-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        
        .article-image {
            aspect-ratio: 16/9;
            background: #E5E7EB;
            position: relative;
        }
        
        .article-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .article-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary-light) 0%, #E5E7EB 100%);
            color: var(--primary);
            font-size: 40px;
            opacity: 0.5;
        }
        
        .article-category {
            position: absolute;
            bottom: 12px;
            left: 12px;
            padding: 4px 12px;
            background: rgba(0,0,0,0.7);
            color: white;
            border-radius: 20px;
            font-size: 12px;
        }
        
        .article-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 4px 10px;
            background: var(--primary);
            color: white;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
        }
        
        .article-content {
            padding: 20px;
        }
        
        .article-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1F2937;
            margin-bottom: 8px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .article-excerpt {
            font-size: 0.9rem;
            color: #6B7280;
            margin-bottom: 12px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .article-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 13px;
            color: #9CA3AF;
        }
        
        .article-meta i { margin-right: 4px; }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 64px 20px;
            color: #6B7280;
        }
        
        .empty-state i {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        /* Footer */
        .page-footer {
            background: #1F2937;
            color: white;
            padding: 32px 0;
            text-align: center;
        }
        
        .footer-links {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 16px;
        }
        
        .footer-links a {
            color: #9CA3AF;
            text-decoration: none;
            font-size: 14px;
        }
        
        .footer-links a:hover { color: white; }
        
        .footer-copyright {
            color: #6B7280;
            font-size: 13px;
        }
    </style>
</head>
<body>

<header class="page-header">
    <div class="container">
        <div class="header-content">
            <a href="index.php" class="logo-link">
                <?php if ($shopLogo): ?>
                <img src="<?= htmlspecialchars($shopLogo) ?>" alt="">
                <?php endif; ?>
                <span><?= htmlspecialchars($shopName) ?></span>
            </a>
            
            <a href="index.php" class="back-home">
                <i class="fas fa-home"></i>
                หน้าแรก
            </a>
        </div>
    </div>
</header>

<section class="articles-hero">
    <div class="container">
        <h1>📚 บทความสุขภาพ</h1>
        <p>ความรู้ดีๆ เพื่อสุขภาพของคุณ</p>
    </div>
</section>

<section class="search-section">
    <div class="container">
        <form class="search-form" method="GET">
            <input type="text" name="q" class="search-input" 
                   placeholder="ค้นหาบทความ..." 
                   value="<?= htmlspecialchars($searchQuery) ?>">
            <button type="submit" class="search-btn">
                <i class="fas fa-search"></i>
            </button>
        </form>
    </div>
</section>

<?php if (!empty($categories)): ?>
<section class="categories-section">
    <div class="categories-list">
        <a href="articles.php" class="category-btn <?= !$categoryId ? 'active' : '' ?>">
            ทั้งหมด
        </a>
        <?php foreach ($categories as $cat): ?>
        <a href="articles.php?category=<?= $cat['id'] ?>" 
           class="category-btn <?= $categoryId == $cat['id'] ? 'active' : '' ?>">
            <?= htmlspecialchars($cat['name']) ?>
        </a>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<section class="articles-section">
    <div class="container">
        <?php if (!empty($articles)): ?>
        <div class="articles-grid">
            <?php foreach ($articles as $article): ?>
            <a href="article.php?slug=<?= htmlspecialchars($article['slug']) ?>" class="article-card">
                <div class="article-image">
                    <?php if (!empty($article['featured_image'])): ?>
                    <img src="<?= htmlspecialchars($article['featured_image']) ?>" 
                         alt="<?= htmlspecialchars($article['title']) ?>" loading="lazy">
                    <?php else: ?>
                    <div class="article-placeholder">
                        <i class="fas fa-newspaper"></i>
                    </div>
                    <?php endif; ?>
                    
                    <?php if (!empty($article['category_name'])): ?>
                    <span class="article-category"><?= htmlspecialchars($article['category_name']) ?></span>
                    <?php endif; ?>
                    
                    <?php if ($article['is_featured']): ?>
                    <span class="article-badge">แนะนำ</span>
                    <?php endif; ?>
                </div>
                
                <div class="article-content">
                    <h3 class="article-title"><?= htmlspecialchars($article['title']) ?></h3>
                    
                    <?php if (!empty($article['excerpt'])): ?>
                    <p class="article-excerpt"><?= htmlspecialchars($article['excerpt']) ?></p>
                    <?php endif; ?>
                    
                    <div class="article-meta">
                        <?php if (!empty($article['author_name'])): ?>
                        <span><i class="fas fa-user-md"></i><?= htmlspecialchars($article['author_name']) ?></span>
                        <?php endif; ?>
                        
                        <?php if (!empty($article['published_at'])): ?>
                        <span><i class="fas fa-calendar"></i><?= date('d M Y', strtotime($article['published_at'])) ?></span>
                        <?php endif; ?>
                    </div>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="empty-state">
            <i class="fas fa-newspaper"></i>
            <p>ไม่พบบทความ</p>
        </div>
        <?php endif; ?>
    </div>
</section>

<footer class="page-footer">
    <div class="container">
        <div class="footer-links">
            <a href="index.php">หน้าแรก</a>
            <a href="articles.php">บทความ</a>
            <a href="privacy-policy.php">นโยบายความเป็นส่วนตัว</a>
        </div>
        <div class="footer-copyright">
            &copy; <?= date('Y') ?> <?= htmlspecialchars($shopName) ?>
        </div>
    </div>
</footer>

</body>
</html>
