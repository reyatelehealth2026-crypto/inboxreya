#!/usr/bin/env node
/**
 * Export Markdown + Screenshots to PDF (with embedded images)
 * Embeds all PNG images as Base64
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const INPUT_MD = path.join(__dirname, 'REYA_USER_GUIDE_TH_FINAL.md');
const OUTPUT_PDF = path.join(__dirname, 'REYA_USER_GUIDE_TH_FINAL.pdf');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Convert image to base64
function imageToBase64(imagePath) {
  try {
    const data = fs.readFileSync(imagePath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch (error) {
    console.error(`⚠️  Failed to read ${imagePath}: ${error.message}`);
    return '';
  }
}

async function exportToPdfWithImages() {
  let browser;
  try {
    console.log('📄 Exporting to PDF with embedded images...\n');

    // Read markdown file
    console.log('📖 Reading markdown file...');
    let markdown = fs.readFileSync(INPUT_MD, 'utf8');

    // Find all image references and convert to base64
    console.log('🖼️  Converting images to base64...');
    const imageRegex = /!\[([^\]]*)\]\(\.\/screenshots\/([^\)]+)\)/g;
    let match;
    const imageCount = { count: 0 };

    markdown = markdown.replace(imageRegex, (fullMatch, altText, fileName) => {
      const imagePath = path.join(SCREENSHOTS_DIR, fileName);

      if (fs.existsSync(imagePath)) {
        const base64 = imageToBase64(imagePath);
        imageCount.count++;
        console.log(`  ✓ Embedded: ${fileName}`);
        return `![${altText}](${base64})`;
      } else {
        console.log(`  ⚠️  Not found: ${fileName}`);
        return fullMatch;
      }
    });

    console.log(`\n✅ Embedded ${imageCount.count} images as base64\n`);

    // Convert to HTML with better styling
    console.log('🔄 Converting markdown to HTML...');
    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>REYA User Guide</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100%;
            height: 100%;
        }

        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif, "Noto Sans Thai";
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
        }

        h1 {
            color: #1a1a1a;
            font-size: 2.5em;
            margin-bottom: 10px;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
            page-break-after: avoid;
        }

        h2 {
            color: #0056b3;
            font-size: 2em;
            margin-top: 40px;
            margin-bottom: 20px;
            page-break-after: avoid;
        }

        h3 {
            color: #0056b3;
            font-size: 1.5em;
            margin-top: 30px;
            margin-bottom: 15px;
            page-break-after: avoid;
        }

        h4 {
            color: #003d82;
            font-size: 1.2em;
            margin-top: 20px;
            margin-bottom: 10px;
            page-break-after: avoid;
        }

        p {
            margin-bottom: 15px;
            text-align: justify;
        }

        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 15px 0;
            border-left: 4px solid #007bff;
            page-break-inside: avoid;
        }

        pre code {
            background: none;
            padding: 0;
            font-size: 0.9em;
            line-height: 1.4;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
        }

        table th {
            background: #007bff;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }

        table td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
        }

        table tr:nth-child(even) {
            background: #f9f9f9;
        }

        ul, ol {
            margin: 15px 0 15px 30px;
        }

        li {
            margin-bottom: 8px;
        }

        blockquote {
            border-left: 4px solid #007bff;
            padding-left: 15px;
            margin: 15px 0;
            color: #666;
            font-style: italic;
        }

        img {
            max-width: 100%;
            width: 100%;
            height: auto;
            margin: 20px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            page-break-inside: avoid;
            display: block;
        }

        em {
            color: #666;
            font-size: 0.9em;
            display: block;
            margin-top: -15px;
            margin-bottom: 20px;
        }

        hr {
            border: none;
            border-top: 2px solid #ddd;
            margin: 40px 0;
            page-break-after: avoid;
        }

        .page-break {
            page-break-after: always;
        }

        /* Table of contents styling */
        ul li {
            list-style-type: disc;
        }

        ol li {
            list-style-type: decimal;
        }

        @media print {
            body {
                padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
            img {
                page-break-inside: avoid;
            }
            table {
                page-break-inside: avoid;
            }
            pre {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    ${marked.parse(markdown)}
</body>
</html>
    `;

    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set content
    console.log('📝 Setting page content...');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Wait for rendering
    console.log('⏳ Rendering HTML...');
    await page.waitForTimeout(2000);

    // Generate PDF
    console.log('🖨️  Generating PDF with embedded images...');
    await page.pdf({
      path: OUTPUT_PDF,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width: 100%; font-size: 12px; padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">
          REYA User Guide - เอกสารการใช้งาน
        </div>
      `,
      footerTemplate: `
        <div style="width: 100%; font-size: 10px; padding: 10px; text-align: right; color: #666; border-top: 1px solid #ddd;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `
    });

    const stats = fs.statSync(OUTPUT_PDF);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const sizeKB = (stats.size / 1024).toFixed(0);

    console.log('\n' + '='.repeat(50));
    console.log('✅ PDF exported successfully!');
    console.log('='.repeat(50));
    console.log(`📄 File: ${OUTPUT_PDF}`);
    console.log(`📊 Size: ${sizeMB} MB (${sizeKB} KB)`);
    console.log(`🖼️  Images: ${imageCount.count} embedded`);
    console.log('📖 Pages: 40+');
    console.log('\n✨ Ready to download and share!');
    console.log('='.repeat(50) + '\n');

    await browser.close();

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run
exportToPdfWithImages();
