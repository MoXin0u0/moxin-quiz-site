import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const googleRequests = [];

  page.on('request', request => {
    const url = request.url();
    if (/accounts\.google\.com|googleapis\.com/.test(url)) googleRequests.push(url);
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#storageStatus')?.textContent || '';
    return text.includes('IndexedDB 已就緒');
  }, null, { timeout: 15000 });

  assert.deepEqual(
    googleRequests,
    [],
    'local-only app boot must not contact Google while cloud sync is disabled',
  );
  assert.equal(
    await page.locator('script[src*="accounts.google.com/gsi/client"]').count(),
    0,
    'GIS must be lazy-loaded only after explicit cloud authorization',
  );

  const result = await page.evaluate(async () => {
    const { APP_CONFIG } = await import('/src/app/config.js');
    const { GoogleDriveTokenManager } = await import('/src/cloud/google/google-auth.js');
    const { GoogleDriveAppDataProvider } = await import('/src/cloud/google/google-drive.js');

    const fakeGoogle = {
      accounts: {
        oauth2: {
          initTokenClient(config) {
            return {
              requestAccessToken() {
                config.callback({
                  access_token: 'browser-token',
                  expires_in: 3600,
                  scope: APP_CONFIG.cloud.googleDriveScope,
                });
              },
            };
          },
          revoke(_token, callback) {
            callback({ successful: true });
          },
        },
      },
    };

    const tokenManager = new GoogleDriveTokenManager({
      clientId: 'browser-test.apps.googleusercontent.com',
      loader: async () => fakeGoogle,
    });
    await tokenManager.requestAccessToken();

    const calls = [];
    const provider = new GoogleDriveAppDataProvider({
      tokenManager,
      fetchImpl: async (url, init = {}) => {
        calls.push({
          url: String(url),
          authorization: init.headers?.Authorization || null,
        });
        const parsed = new URL(String(url));
        if (parsed.pathname.endsWith('/about')) {
          return new Response(JSON.stringify({
            user: {
              permissionId: 'browser-permission',
              displayName: 'Browser Test',
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (parsed.pathname.endsWith('/files')) {
          return new Response(JSON.stringify({ files: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`Unexpected fake Drive URL: ${url}`);
      },
    });

    const profile = await provider.getAccountProfile();
    const listed = await provider.listFiles({
      appProperties: { moxinApp: 'moxin-quiz', cloudSchema: '1' },
    });

    return {
      cloudSyncEnabled: APP_CONFIG.features.cloudSync,
      clientId: APP_CONFIG.cloud.googleClientId,
      tokenState: tokenManager.getTokenState(),
      profile,
      listed,
      calls,
    };
  });

  assert.equal(result.cloudSyncEnabled, false);
  assert.equal(result.clientId, '');
  assert.equal(result.tokenState.hasToken, true);
  assert.equal(result.profile.providerSubject, 'browser-permission');
  assert.deepEqual(result.listed.files, []);
  assert.ok(result.calls.every(call => call.authorization === 'Bearer browser-token'));

  console.log('V5 B08 cloud provider browser gate passed.');
} finally {
  await browser.close();
}
