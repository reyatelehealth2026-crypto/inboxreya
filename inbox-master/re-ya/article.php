<?php
/**
 * Single Article Page
 * หน้าแสดงบทความเดี่ยว - SEO Friendly
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
$liffId = $lineAccount['liff_id'] ?? null;
$liffUrl = $liffId ? "https://liff.line.me/{$liffId}" : null;

// Get shop settings
$shopSettings = [];
try {
    $stmt = $db->prepare("SELECT * FROM shop_settings WHERE line_account_id = ? LIMIT 1");
    $stmt->execute([$lineAccountId]);
    $shopSettings = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$shopName = $shopSettings['shop_name'] ?? 'LINE Telepharmacy';
$shopLogo = $shopSettings['shop_logo'] ?? '';

// Get article
$articleService = new HealthArticleService($db, $lineAccountId);
$slug = $_GET['slug'] ?? '';
$article = $articleService->getBySlug($slug);

if (!$article) {
    header('HTTP/1.0 404 Not Found');
    header('Location: articles.php');
    exit;
}

// Get related articles
$relatedArticles = $articleService->getRelatedArticles($article['id'], 3);

// Parse tags
$tags = [];
if (!empty($article['tags'])) {
    $tags = json_decode($article['tags'], true) ?? [];
}

// Meta info
$metaTitle = $article['meta_title'] ?? $article['title'];
$metaDescription = $article['meta_description'] ?? $article['excerpt'];

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
    
    <!-- SEO Meta Tags -->
    <title><?= htmlspecialchars($metaTitle) ?> | <?= htmlspecialchars($shopName) ?></title>
    <meta name="description" content="<?= htmlspecialchars($metaDescription) ?>">
    <?php if (!empty($article['meta_keywords'])): ?>
    <meta name="keywords" content="<?= htmlspecialchars($article['meta_keywords']) ?>">
    <?php endif; ?>
    
    <!-- Open Graph -->
    <meta property="og:title" content="<?= htmlspecialchars($metaTitle) ?>">
    <meta property="og:description" content="<?= htmlspecialchars($metaDescription) ?>">
    <meta property="og:type" content="article">
    <meta property="og:url" content="<?= BASE_URL ?>article.php?slug=<?= htmlspecialchars($slug) ?>">
    <?php if (!empty($article['featured_image'])): ?>
    <meta property="og:image" content="<?= htmlspecialchars($article['featured_image']) ?>">
    <?php endif; ?>
    <meta property="article:published_time" content="<?= $article['published_at'] ?>">
    <?php if (!empty($article['author_name'])): ?>
    <meta property="article:author" content="<?= htmlspecialchars($article['author_name']) ?>">
    <?php endif; ?>
    
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
            line-height: 1.8;
            color: #1F2937;
            background: #F8FAFC;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 0 16px;
        }
        
        /* Header */
        .article-header {
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
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 16px;
        }
        
        .back-link {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6B7280;
            text-decoration: none;
            font-weight: 500;
        }
        
        .back-link:hover { color: var(--primary); }
        
        .logo-link {
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            color: #1F2937;
            font-weight: 600;
        }
        
        .logo-link img {
            width: 36px;
            height: 36px;
            border-radius: 8px;
        }
        
        /* Article */
        .article-container {
            background: white;
            margin: 24px auto;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .article-hero {
            aspect-ratio: 16/9;
            background: #E5E7EB;
            position: relative;
        }
        
        .article-hero img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .article-hero-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary-light) 0%, #E5E7EB 100%);
            color: var(--primary);
            font-size: 64px;
            opacity: 0.5;
        }
        
        .article-body {
            padding: 24px;
        }
        
        @media (min-width: 768px) {
            .article-body { padding: 40px; }
        }
        
        .article-category-badge {
            display: inline-block;
            padding: 4px 12px;
            background: var(--primary-light);
            color: var(--primary);
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 16px;
        }
        
        .article-title {
            font-size: 1.75rem;
            font-weight: 700;
            line-height: 1.3;
            margin-bottom: 16px;
            color: #1F2937;
        }
        
        @media (min-width: 768px) {
            .article-title { font-size: 2.25rem; }
        }
        
        .article-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            padding-bottom: 24px;
            border-bottom: 1px solid #E5E7EB;
            margin-bottom: 24px;
        }
        
        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6B7280;
            font-size: 14px;
        }
        
        .meta-item i { color: var(--primary); }
        
        .author-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .author-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--primary-light);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
        }
        
        .author-avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }
        
        .author-details {
            line-height: 1.3;
        }
        
        .author-name {
            font-weight: 600;
            color: #1F2937;
        }
        
        .author-title {
            font-size: 13px;
            color: #6B7280;
        }
        
        /* Article Content */
        .article-content {
            font-size: 1.1rem;
            line-height: 1.9;
        }
        
        .article-content h2 {
            font-size: 1.5rem;
            margin: 32px 0 16px;
            color: #1F2937;
        }
        
        .article-content h3 {
            font-size: 1.25rem;
            margin: 24px 0 12px;
            color: #374151;
        }
        
        .article-content p {
            margin-bottom: 16px;
        }
        
        .article-content ul, .article-content ol {
            margin: 16px 0;
            padding-left: 24px;
        }
        
        .article-content li {
            margin-bottom: 8px;
        }
        
        .article-content img {
            max-width: 100%;
            border-radius: 8px;
            margin: 24px 0;
        }
        
        .article-content blockquote {
            border-left: 4px solid var(--primary);
            padding-left: 20px;
            margin: 24px 0;
            color: #4B5563;
            font-style: italic;
        }
        
        /* Tags */
        .article-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #E5E7EB;
        }
        
        .tag {
            padding: 6px 14px;
            background: #F3F4F6;
            color: #4B5563;
            border-radius: 20px;
            font-size: 13px;
            text-decoration: none;
        }
        
        .tag:hover {
            background: var(--primary-light);
            color: var(--primary);
        }
        
        /* Share */
        .share-section {
            margin-top: 32px;
            padding: 24px;
            background: #F8FAFC;
            border-radius: 12px;
            text-align: center;
        }
        
        .share-title {
            font-weight: 600;
            margin-bottom: 16px;
            color: #374151;
        }
        
        .share-buttons {
            display: flex;
            justify-content: center;
            gap: 12px;
        }
        
        .share-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            text-decoration: none;
            transition: transform 0.2s;
        }
        
        .share-btn:hover { transform: scale(1.1); }
        .share-btn.facebook { background: #1877F2; }
        .share-btn.twitter { background: #1DA1F2; }
        .share-btn.line { background: #06C755; }
        .share-btn.copy { background: #6B7280; cursor: pointer; }
        
        /* Related Articles */
        .related-section {
            padding: 48px 0;
        }
        
        .related-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 24px;
            text-align: center;
        }
        
        .related-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
        }
        
        @media (min-width: 640px) {
            .related-grid { grid-template-columns: repeat(3, 1fr); }
        }
        
        .related-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            text-decoration: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.3s;
        }
        
        .related-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        
        .related-image {
            aspect-ratio: 16/9;
            background: #E5E7EB;
        }
        
        .related-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .related-info {
            padding: 16px;
        }
        
        .related-info h4 {
            font-size: 0.95rem;
            color: #1F2937;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        /* Footer */
        .article-footer {
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
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "<?= htmlspecialchars($article['title']) ?>",
        "description": "<?= htmlspecialchars($metaDescription) ?>",
        <?php if (!empty($article['featured_image'])): ?>
        "image": "<?= htmlspecialchars($article['featured_image']) ?>",
        <?php endif; ?>
        "datePublished": "<?= $article['published_at'] ?>",
        "dateModified": "<?= $article['updated_at'] ?>",
        <?php if (!empty($article['author_name'])): ?>
        "author": {
            "@type": "Person",
            "name": "<?= htmlspecialchars($article['author_name']) ?>"
            <?php if (!empty($article['author_title'])): ?>
            ,"jobTitle": "<?= htmlspecialchars($article['author_title']) ?>"
            <?php endif; ?>
        },
        <?php endif; ?>
        "publisher": {
            "@type": "Organization",
            "name": "<?= htmlspecialchars($shopName) ?>"
            <?php if ($shopLogo): ?>
            ,"logo": {
                "@type": "ImageObject",
                "url": "<?= htmlspecialchars($shopLogo) ?>"
            }
            <?php endif; ?>
        }
    }
    </script>
</head>
<body>

<header class="article-header">
    <div class="header-content">
        <a href="articles.php" class="back-link">
            <i class="fas fa-arrow-left"></i>
            <span>บทความทั้งหมด</span>
        </a>
        
        <a href="index.php" class="logo-link">
            <?php if ($shopLogo): ?>
            <img src="<?= htmlspecialchars($shopLogo) ?>" alt="<?= htmlspecialchars($shopName) ?>">
            <?php endif; ?>
            <span><?= htmlspecialchars($shopName) ?></span>
        </a>
    </div>
</header>

<main>
    <article class="article-container container">
        <?php if (!empty($article['featured_image'])): ?>
        <div class="article-hero">
            <img src="<?= htmlspecialchars($article['featured_image']) ?>" alt="<?= htmlspecialchars($article['title']) ?>">
        </div>
        <?php else: ?>
        <div class="article-hero">
            <div class="article-hero-placeholder">
                <i class="fas fa-newspaper"></i>
            </div>
        </div>
        <?php endif; ?>
        
        <div class="article-body">
            <?php if (!empty($article['category_name'])): ?>
            <span class="article-category-badge"><?= htmlspecialchars($article['category_name']) ?></span>
            <?php endif; ?>
            
            <h1 class="article-title"><?= htmlspecialchars($article['title']) ?></h1>
            
            <div class="article-meta">
                <?php if (!empty($article['author_name'])): ?>
                <div class="author-info">
                    <div class="author-avatar">
                        <?php if (!empty($article['author_image'])): ?>
                        <img src="<?= htmlspecialchars($article['author_image']) ?>" alt="">
                        <?php else: ?>
                        <i class="fas fa-user-md"></i>
                        <?php endif; ?>
                    </div>
                    <div class="author-details">
                        <div class="author-name"><?= htmlspecialchars($article['author_name']) ?></div>
                        <?php if (!empty($article['author_title'])): ?>
                        <div class="author-title"><?= htmlspecialchars($article['author_title']) ?></div>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endif; ?>
                
                <?php if (!empty($article['published_at'])): ?>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <?= date('d M Y', strtotime($article['published_at'])) ?>
                </div>
                <?php endif; ?>
                
                <div class="meta-item">
                    <i class="fas fa-eye"></i>
                    <?= number_format($article['view_count']) ?> views
                </div>
            </div>
            
            <div class="article-content">
                <?= $article['content'] ?>
            </div>
            
            <?php if (!empty($tags)): ?>
            <div class="article-tags">
                <?php foreach ($tags as $tag): ?>
                <a href="articles.php?tag=<?= urlencode($tag) ?>" class="tag">#<?= htmlspecialchars($tag) ?></a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
            
            <div class="share-section">
                <div class="share-title">แชร์บทความนี้</div>
                <div class="share-buttons">
                    <a href="https://www.facebook.com/sharer/sharer.php?u=<?= urlencode(BASE_URL . 'article.php?slug=' . $slug) ?>" 
                       target="_blank" class="share-btn facebook" title="Share on Facebook">
                        <i class="fab fa-facebook-f"></i>
                    </a>
                    <a href="https://twitter.com/intent/tweet?url=<?= urlencode(BASE_URL . 'article.php?slug=' . $slug) ?>&text=<?= urlencode($article['title']) ?>" 
                       target="_blank" class="share-btn twitter" title="Share on Twitter">
                        <i class="fab fa-twitter"></i>
                    </a>
                    <a href="https://social-plugins.line.me/lineit/share?url=<?= urlencode(BASE_URL . 'article.php?slug=' . $slug) ?>" 
                       target="_blank" class="share-btn line" title="Share on LINE">
                        <i class="fab fa-line"></i>
                    </a>
                    <button onclick="copyLink()" class="share-btn copy" title="Copy Link">
                        <i class="fas fa-link"></i>
                    </button>
                </div>
            </div>
        </div>
    </article>
    
    <?php if (!empty($relatedArticles)): ?>
    <section class="related-section container">
        <h3 class="related-title">บทความที่เกี่ยวข้อง</h3>
        <div class="related-grid">
            <?php foreach ($relatedArticles as $related): ?>
            <a href="article.php?slug=<?= htmlspecialchars($related['slug']) ?>" class="related-card">
                <div class="related-image">
                    <?php if (!empty($related['featured_image'])): ?>
                    <img src="<?= htmlspecialchars($related['featured_image']) ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="related-info">
                    <h4><?= htmlspecialchars($related['title']) ?></h4>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>
</main>

<footer class="article-footer">
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

<script>
function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('คัดลอกลิงก์แล้ว!');
    });
}
</script>

</body>
</html>
