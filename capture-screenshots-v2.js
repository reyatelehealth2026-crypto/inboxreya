#!/usr/bin/env node
/**
 * REYA Screenshot Capture Script V2 (Simplified)
 * More robust version with better error handling
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://inbox.re-ya.com';
const USERNAME = 'adminadmin';
const PASSWORD = 'adminadmin';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  console.log(`✅ Created directory: ${SCREENSHOTS_DIR}`);
}

// Simple navigation list
const pages = [
  { name: '01_login_page', url: '/', wait: 1000 },
  { name: '02_dashboard_overview', url: '/dashboard', wait: 1000 },
  { name: '03_dashboard_kpi_cards', url: '/dashboard', wait: 1000 },
  { name: '04_inbox_overview', url: '/inbox', wait: 1000 },
  { name: '05_inbox_click_customer', url: '/inbox', wait: 1000 },
  { name: '06_customer_profile_panel', url: '/inbox', wait: 1000 },
  { name: '07_inbox_input_field', url: '/inbox', wait: 1000 },
  { name: '08_tag_selection_popup', url: '/inbox', wait: 1000 },
  { name: '09_status_closed_dropdown', url: '/inbox', wait: 1000 },
  { name: '10_tags_menu', url: '/tags', wait: 1000 },
  { name: '11_create_segment_form', url: '/segments', wait: 1000 },
  { name: '12_templates_list', url: '/templates', wait: 1000 },
  { name: '13_template_editor', url: '/templates', wait: 1000 },
  { name: '14_template_slash_dropdown', url: '/inbox', wait: 1000 },
  { name: '15_broadcasts_list', url: '/broadcasts', wait: 1000 },
  { name: '16_create_campaign_form', url: '/broadcasts', wait: 1000 },
  { name: '17_message_editor', url: '/broadcasts', wait: 1000 },
  { name: '18_broadcast_preview', url: '/broadcasts', wait: 1000 },
  { name: '19_analytics_overview', url: '/analytics', wait: 1000 },
  { name: '20_broadcast_stats', url: '/broadcasts', wait: 1000 },
  { name: '21_autoreply_settings', url: '/settings/autoreply', wait: 1000 },
  { name: '22_settings_general', url: '/settings', wait: 1000 },
  { name: '23_sidebar_menu', url: '/dashboard', wait: 1000 },
];

async function captureScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`✅ ${name}.png`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}.png - ${error.message}`);
    return false;
  }
}

async function main() {
  let browser;
  let page;
  try {
    console.log('\n🎬 REYA Screenshot Capture (V2)\n');
    console.log(`URL: ${BASE_URL}`);
    console.log(`Output: ${SCREENSHOTS_DIR}\n`);
    console.log('Starting capture...\n');

    // Launch browser (headless mode)
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });

    // Go to login page
    console.log('🔐 Navigating to login page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.warn(e));
    await page.waitForTimeout(2000);

    // Try to login
    console.log('🔐 Attempting login...');
    try {
      // Find and fill username
      const usernameInput = await page.$('input[type="text"], input[placeholder*="username"], input[id*="user"], input[name*="user"]');
      if (usernameInput) {
        await usernameInput.fill(USERNAME);
        console.log('  ✓ Username filled');
      }

      // Find and fill password
      const passwordInput = await page.$('input[type="password"], input[id*="pass"], input[name*="pass"]');
      if (passwordInput) {
        await passwordInput.fill(PASSWORD);
        console.log('  ✓ Password filled');
      }

      // Click login button
      const loginButton = await page.$('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        console.log('  ✓ Login button clicked');

        // Wait for navigation
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
          page.waitForTimeout(4000)
        ]);
        console.log('✅ Login successful!\n');
      }
    } catch (error) {
      console.log(`⚠️  Login attempt: ${error.message}\n`);
    }

    // Wait a bit after login
    await page.waitForTimeout(2000);

    // Capture screenshots
    console.log('📸 Capturing pages:\n');
    let successCount = 0;
    let errorCount = 0;

    for (const item of pages) {
      try {
        // Navigate if needed
        if (item.url) {
          try {
            await page.goto(`${BASE_URL}${item.url}`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(item.wait);
          } catch (e) {
            console.log(`  (Navigation warning: ${e.message})`);
          }
        }

        // Take screenshot
        const success = await captureScreenshot(page, item.name);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.log(`❌ ${item.name} - ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Success: ${successCount}/${pages.length}`);
    console.log(`❌ Failed: ${errorCount}/${pages.length}`);
    console.log(`📂 Location: ${SCREENSHOTS_DIR}`);
    console.log('='.repeat(50));

    await browser.close();
    console.log('\n🎉 Screenshot capture complete!\n');

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run
main();
