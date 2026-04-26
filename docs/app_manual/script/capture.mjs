import { chromium } from 'playwright';

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    permissions: ['camera']
  });

  const page = await context.newPage();
  console.log("Navigating to https://jan-sync.pages.dev ...");
  await page.goto('https://jan-sync.pages.dev', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for animations or popups

  console.log("Taking screenshot of Scan tab...");
  await page.screenshot({ path: '../images/01_scan_tab.png' });

  try {
    console.log("Clicking List tab...");
    await page.getByText('一覧').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '../images/02_list_tab.png' });
  } catch(e) {
    console.log("Error finding List tab", e);
  }

  try {
    console.log("Clicking Generator tab...");
    const generatorTab = await page.getByText('生成').first();
    if(generatorTab) {
      await generatorTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '../images/03_generator_tab.png' });
    }
  } catch(e) {
    console.log("Error finding Generator tab", e);
  }

  await browser.close();
  console.log("Done!");
})();
