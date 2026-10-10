import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const ROOT = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const profiles = [
  { name: 'desktop-light', width: 1366, height: 768, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'small-mobile-light', width: 320, height: 640, theme: 'light' },
];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(({ theme }) => {
      localStorage.setItem('moxin.v3.settings', JSON.stringify({
        theme,
        learningStyle: 'academy',
        sceneIntensity: 'off',
        reduceMotion: true,
        fontScale: 'normal',
      }));
    }, { theme: profile.theme });

    const response = await page.goto(ROOT, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() =>
      (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
    null, { timeout: 15000 });

    if (profile.width <= 620) {
      await page.locator('[data-nav-more]').first().click();
      await page.locator('[data-more-settings]').first().click();
    } else {
      await page.locator('[data-nav-settings]').first().click();
    }
    await page.locator('#settingsView:not([hidden])').waitFor({ state: 'visible' });
    const details = page.locator('[data-legal-data-controls]');
    await details.locator('summary').click();
    assert.equal(await details.evaluate(el => el.open), true);
    assert.match(await details.innerText(), /撤銷 Google 存取權/);
    assert.equal(await details.locator('li').count(), 4);
    assert.equal(await page.locator('#settingsView a[href="./terms.html"]').count(), 1);
    assert.equal(await page.locator('#settingsView a[href="./privacy.html"]').count(), 2);

    const box = await details.boundingBox();
    assert.ok(box && box.x >= -3 && box.x + box.width <= profile.width + 3,
      `${profile.name}: data-controls detail overflows viewport`);

    const axe = await new AxeBuilder({ page }).include('[data-legal-data-controls]').analyze();
    const severe = axe.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    assert.deepEqual(severe.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [],
      `${profile.name}: B02 details must remain accessible`);

    const syncNotice = page.locator('#settingsView [data-cloud-link-disclosure]');
    assert.equal(await syncNotice.count(), 1);
    assert.match(await syncNotice.innerText(), /Drive appDataFolder/);

    const settingsFeedback = page.locator('#settingsView [data-open-feedback-form]');
    assert.equal(await settingsFeedback.count(), 1);
    assert.equal(await settingsFeedback.getAttribute('href'), 'https://forms.gle/3Vhia7MFyvzyV6s2A');
    assert.equal(await settingsFeedback.getAttribute('target'), '_blank');
    assert.match(await settingsFeedback.getAttribute('rel'), /noopener/);
    assert.match(await page.locator('[data-feedback-privacy-notice]').innerText(), /Google Forms/);
    const backupEmail = page.locator('#settingsView [data-feedback-email]');
    assert.equal(await backupEmail.count(), 1);
    assert.equal(await backupEmail.getAttribute('href'), 'mailto:moxin82771@gmail.com');
    assert.match(await page.locator('#settingsView [data-feedback-backup]').innerText(), /Google 表單無法使用/);
    for (const doc of ['privacy.html', 'terms.html']) {
      const policy = await page.goto(new URL(doc, ROOT).href, { waitUntil: 'domcontentloaded' });
      assert.equal(policy.status(), 200);
      assert.equal(await page.locator('main h1').count(), 1);
      assert.equal(await page.locator('a[href="./app.html"]').count() > 0, true);
    }

    const landing = await page.goto(new URL('./', ROOT).href, { waitUntil: 'domcontentloaded' });
    assert.equal(landing.status(), 200);
    assert.equal(await page.locator('#contact h2').count(), 1);
    const landingFeedback = page.locator('#contact [data-feedback-link]');
    await landingFeedback.scrollIntoViewIfNeeded();
    assert.equal(await landingFeedback.getAttribute('href'), 'https://forms.gle/3Vhia7MFyvzyV6s2A');
    assert.equal(await page.locator('.landing-footer-links [data-feedback-footer-link]').count(), 1);
    assert.equal(await page.locator('.landing-footer-links [data-feedback-email-footer]').getAttribute('href'), 'mailto:moxin82771@gmail.com');
    const contactEmail = page.locator('#contact [data-contact-email]');
    assert.equal(await contactEmail.getAttribute('href'), 'mailto:moxin82771@gmail.com');
    assert.match(await page.locator('[data-contact-backup]').innerText(), /表單無法使用/);
    const notice = await page.locator('#contact .landing-contact-notice').innerText();
    assert.match(notice, /Google Forms/);
    assert.match(notice, /不填寫表單也能繼續使用/);
    const contactBox = await page.locator('#contact .landing-contact-card').boundingBox();
    assert.ok(contactBox && contactBox.x >= -3 && contactBox.x + contactBox.width <= profile.width + 3,
      `${profile.name}: public feedback card overflows viewport`);
    const emailLinkBox = await contactEmail.boundingBox();
    assert.ok(emailLinkBox && emailLinkBox.x >= -3 && emailLinkBox.x + emailLinkBox.width <= profile.width + 3,
      `${profile.name}: backup email overflows viewport`);
    const feedbackBox = await landingFeedback.boundingBox();
    assert.ok(feedbackBox && feedbackBox.x >= -3 && feedbackBox.x + feedbackBox.width <= profile.width + 3,
      `${profile.name}: public form CTA overflows viewport`);

    const contactA11y = await new AxeBuilder({ page }).include('#contact').analyze();
    const contactSevere = contactA11y.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    assert.deepEqual(contactSevere.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [],
      `${profile.name}: public feedback must remain accessible`);

    await context.close();
    console.log(`B02 legal access ${profile.name} PASS`);
  }
} finally {
  await browser.close();
}
