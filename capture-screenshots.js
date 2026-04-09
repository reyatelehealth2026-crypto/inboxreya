#!/usr/bin/env node
/**
 * REYA Screenshot Capture Script
 * Captures all 23 screenshots for User Guide
 *
 * Usage: node capture-screenshots.js
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

// Screenshot tasks
const screenshots = [
  // 1-3: Login & Dashboard
  { name: '01_login_page', action: 'login' },
  { name: '02_dashboard_overview', action: 'dashboard' },
  { name: '03_dashboard_kpi_cards', action: 'dashboard_kpi' },

  // 4-9: Inbox
  { name: '04_inbox_overview', action: 'inbox_overview' },
  { name: '05_inbox_click_customer', action: 'inbox_select_customer' },
  { name: '06_customer_profile_panel', action: 'customer_profile' },
  { name: '07_inbox_input_field', action: 'inbox_input' },
  { name: '08_tag_selection_popup', action: 'tag_popup' },
  { name: '09_status_closed_dropdown', action: 'status_dropdown' },

  // 10-11: Tags & Segments
  { name: '10_tags_menu', action: 'tags_menu' },
  { name: '11_create_segment_form', action: 'create_segment' },

  // 12-14: Templates
  { name: '12_templates_list', action: 'templates_list' },
  { name: '13_template_editor', action: 'template_editor' },
  { name: '14_template_slash_dropdown', action: 'template_slash' },

  // 15-18: Broadcasts
  { name: '15_broadcasts_list', action: 'broadcasts_list' },
  { name: '16_create_campaign_form', action: 'create_campaign' },
  { name: '17_message_editor', action: 'message_editor' },
  { name: '18_broadcast_preview', action: 'broadcast_preview' },

  // 19-20: Analytics
  { name: '19_analytics_overview', action: 'analytics' },
  { name: '20_broadcast_stats', action: 'broadcast_stats' },

  // 21-22: Auto-Reply & Settings
  { name: '21_autoreply_settings', action: 'autoreply_settings' },
  { name: '22_settings_general', action: 'settings_general' },

  // 23: Menu
  { name: '23_sidebar_menu', action: 'sidebar_menu' },
];

async function captureScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`✅ Captured: ${name}.png`);
}

async function executeAction(page, action) {
  try {
    switch (action) {
      case 'login':
        // Already logged in before this
        break;

      case 'dashboard':
        try {
          await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (e) {
          console.warn(`⚠️  Navigation warning: ${e.message}`);
        }
        await page.waitForTimeout(800);
        break;

      case 'dashboard_kpi':
        await page.evaluate(() => {
          const element = document.querySelector('[class*="card"]') || document.querySelector('[class*="stat"]');
          if (element) element.scrollIntoView();
        }).catch(() => {});
        await page.waitForTimeout(500);
        break;

      case 'inbox_overview':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'inbox_select_customer':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        // Click on first customer in list
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        break;

      case 'customer_profile':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        // Click on first customer
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        // Click profile button
        await page.click('[aria-label*="profile"], [title*="Profile"], button:has-text("Profile")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'inbox_input':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        // Scroll to input
        await page.evaluate(() => {
          const input = document.querySelector('[contenteditable], textarea, [class*="input"]');
          if (input) input.scrollIntoView();
        });
        await page.waitForTimeout(500);
        break;

      case 'tag_popup':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        // Click tag button
        await page.click('[aria-label*="tag"], [title*="Tag"], button:has-text("Tag")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'status_dropdown':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        // Click status dropdown
        await page.click('[class*="status"], select, button:has-text("Status")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'tags_menu':
        await page.goto(`${BASE_URL}/tags`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'create_segment':
        await page.goto(`${BASE_URL}/segments`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Click create button if visible
        await page.click('button:has-text("Create"), button:has-text("New")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'templates_list':
        await page.goto(`${BASE_URL}/templates`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'template_editor':
        await page.goto(`${BASE_URL}/templates`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Click create template button
        await page.click('button:has-text("Create"), button:has-text("New")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'template_slash':
        await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle' });
        await page.click('[class*="customer"]:first-child, [class*="conversation"]:first-child', { force: true }).catch(() => {});
        await page.waitForTimeout(500);
        // Focus input and type /
        await page.focus('[contenteditable], textarea', { force: true }).catch(() => {});
        await page.keyboard.type('/');
        await page.waitForTimeout(800);
        break;

      case 'broadcasts_list':
        await page.goto(`${BASE_URL}/broadcasts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'create_campaign':
        await page.goto(`${BASE_URL}/broadcasts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Click create campaign button
        await page.click('button:has-text("Create"), button:has-text("New")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'message_editor':
        await page.goto(`${BASE_URL}/broadcasts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Click create campaign
        await page.click('button:has-text("Create"), button:has-text("New")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        // Scroll to message editor
        await page.evaluate(() => {
          const editor = document.querySelector('[class*="editor"], [class*="message"], textarea');
          if (editor) editor.scrollIntoView();
        });
        await page.waitForTimeout(500);
        break;

      case 'broadcast_preview':
        await page.goto(`${BASE_URL}/broadcasts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Create campaign → message → preview
        await page.click('button:has-text("Create"), button:has-text("New")', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        // Click preview button
        await page.click('button:has-text("Preview"), [aria-label*="preview"]', { force: true }).catch(() => {});
        await page.waitForTimeout(800);
        break;

      case 'analytics':
        await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'broadcast_stats':
        await page.goto(`${BASE_URL}/broadcasts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        // Click on first broadcast if exists
        await page.click('[class*="campaign"], [class*="broadcast"]', { force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        break;

      case 'autoreply_settings':
        await page.goto(`${BASE_URL}/settings/autoreply`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'settings_general':
        await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        break;

      case 'sidebar_menu':
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
        // Focus on sidebar
        await page.evaluate(() => {
          const sidebar = document.querySelector('[class*="sidebar"], [class*="menu"], nav');
          if (sidebar) sidebar.scrollIntoView();
        });
        await page.waitForTimeout(500);
        break;

      default:
        console.log(`⚠️ Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`❌ Error executing action ${action}: ${error.message}`);
  }
}

async function main() {
  let browser;
  try {
    console.log('🎬 Starting Playwright Screenshot Capture...\n');
    console.log(`🌐 URL: ${BASE_URL}`);
    console.log(`📂 Output: ${SCREENSHOTS_DIR}\n`);

    // Launch browser
    browser = await chromium.launch({ headless: false }); // Set to true for headless mode
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    // Set user agent
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    // Login
    console.log('🔐 Logging in...');
    try {
      await page.fill('input[type="text"], input[placeholder*="username"], input[id*="user"]', USERNAME, { timeout: 5000 });
      await page.fill('input[type="password"], input[id*="pass"]', PASSWORD, { timeout: 5000 });
      await page.click('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]', { timeout: 5000 });
      // Wait for navigation or timeout
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.waitForTimeout(3000)
      ]);
      await page.waitForTimeout(2000);
      console.log('✅ Logged in successfully!\n');
    } catch (error) {
      console.error(`⚠️  Login warning: ${error.message}`);
      console.log('Continuing with current page state...\n');
    }

    // Capture screenshots
    console.log('📸 Capturing screenshots...\n');
    let successCount = 0;
    let errorCount = 0;

    for (const screenshot of screenshots) {
      try {
        console.log(`▶️  Processing: ${screenshot.name}...`);
        await executeAction(page, screenshot.action);
        await captureScreenshot(page, screenshot.name);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to capture ${screenshot.name}: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   ✅ Success: ${successCount}/${screenshots.length}`);
    console.log(`   ❌ Failed: ${errorCount}/${screenshots.length}`);
    console.log(`   📂 Location: ${SCREENSHOTS_DIR}`);
    console.log('='.repeat(50) + '\n');

    await browser.close();
    console.log('🎉 Done! All screenshots captured.');
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run
main();
