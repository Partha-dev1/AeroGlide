const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    const title = await page.title();
    console.log('Page title:', title);
    if (!title.toLowerCase().includes('aeroglide')) {
      console.error('❌ Unexpected title, UI verification failed');
      process.exit(1);
    }
    console.log('✅ UI verification succeeded');
    process.exit(0);
  } catch (err) {
    console.error('❌ UI verification error', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
