import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_CONFIG } from '../src/app/config.js';
import {
  CLOUD_ERROR_CODE,
  CloudProviderError,
  assertCloudProvider,
} from '../src/cloud/provider.js';
import { GoogleDriveTokenManager } from '../src/cloud/google/google-auth.js';
import {
  GoogleDriveAppDataProvider,
  escapeDriveQueryLiteral,
} from '../src/cloud/google/google-drive.js';

assert.equal(APP_CONFIG.features.cloudSync, false, 'B08 provider code must remain dormant by default');
assert.equal(APP_CONFIG.cloud.provider, 'google-drive');
assert.equal(APP_CONFIG.cloud.googleClientId, '');
assert.equal(APP_CONFIG.cloud.googleDriveScope, 'https://www.googleapis.com/auth/drive.appdata');
assert.equal(APP_CONFIG.cloud.googleIdentityScriptUrl, 'https://accounts.google.com/gsi/client');

const authSource = fs.readFileSync('src/cloud/google/google-auth.js', 'utf8');
assert.doesNotMatch(authSource, /client_secret/i);
assert.doesNotMatch(authSource, /refresh_token/i);
assert.doesNotMatch(authSource, /localStorage|sessionStorage|indexedDB/i);

let requestedPrompt = null;
const fakeGoogle = {
  accounts: {
    oauth2: {
      initTokenClient(config) {
        return {
          requestAccessToken({ prompt } = {}) {
            requestedPrompt = prompt;
            config.callback({
              access_token: 'token-1',
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

const now = 1_000_000;
const tokens = new GoogleDriveTokenManager({
  clientId: 'test-client.apps.googleusercontent.com',
  loader: async () => fakeGoogle,
  now: () => now,
});
assert.equal(tokens.isConfigured(), true);
assert.equal(await tokens.requestAccessToken({ prompt: 'consent' }), 'token-1');
assert.equal(requestedPrompt, 'consent');
assert.equal(tokens.peekAccessToken(), 'token-1');
assert.equal(await tokens.getAccessToken(), 'token-1');
assert.equal(tokens.getTokenState().hasToken, true);

tokens.clearAccessToken();
await assert.rejects(
  () => tokens.getAccessToken(),
  error => error instanceof CloudProviderError && error.code === CLOUD_ERROR_CODE.AUTH_REQUIRED,
);

const unconfigured = new GoogleDriveTokenManager({
  clientId: '',
  loader: async () => fakeGoogle,
});
await assert.rejects(
  () => unconfigured.requestAccessToken(),
  error => error instanceof CloudProviderError && error.code === CLOUD_ERROR_CODE.CONFIG_REQUIRED,
);

const calls = [];
const fetchImpl = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const parsed = new URL(String(url));

  if (parsed.pathname.endsWith('/about')) {
    return new Response(JSON.stringify({
      user: {
        permissionId: 'permission-123',
        displayName: 'Tester',
        emailAddress: 'tester@example.com',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (parsed.pathname.endsWith('/files') && parsed.searchParams.get('spaces') === 'appDataFolder') {
    return new Response(JSON.stringify({
      files: [{
        id: 'file-1',
        name: 'profile.json',
        appProperties: { moxinApp: 'moxin-quiz' },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (parsed.hostname === 'www.googleapis.com' && parsed.pathname.includes('/upload/drive/v3/files')) {
    return new Response(JSON.stringify({
      id: 'created-1',
      name: 'profile.json',
      appProperties: { moxinApp: 'moxin-quiz' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  throw new Error(`Unexpected URL: ${url}`);
};

const activeTokens = new GoogleDriveTokenManager({
  clientId: 'test-client.apps.googleusercontent.com',
  loader: async () => fakeGoogle,
  now: () => now,
});
await activeTokens.requestAccessToken();

const provider = new GoogleDriveAppDataProvider({
  tokenManager: activeTokens,
  fetchImpl,
});
assertCloudProvider(provider);
assert.equal(provider.isConfigured(), true);

const profile = await provider.getAccountProfile();
assert.deepEqual(profile, {
  provider: 'google',
  providerSubject: 'permission-123',
  displayName: 'Tester',
  displayEmail: 'tester@example.com',
  photoUrl: null,
});

const listed = await provider.listFiles({
  appProperties: {
    moxinApp: 'moxin-quiz',
    objectType: 'profile',
  },
});
assert.equal(listed.files.length, 1);
const listCall = calls.find(call => new URL(call.url).searchParams.get('spaces') === 'appDataFolder');
assert.ok(listCall);
assert.match(new URL(listCall.url).searchParams.get('q'), /appProperties has/);
assert.equal(listCall.init.headers.Authorization, 'Bearer token-1');

const created = await provider.createJsonFile({
  name: 'profile.json',
  data: { z: 2, a: 1 },
  appProperties: {
    moxinApp: 'moxin-quiz',
    cloudSchema: '1',
    objectType: 'profile',
  },
});
assert.equal(created.id, 'created-1');
const uploadCall = calls.find(call => new URL(call.url).searchParams.get('uploadType') === 'multipart');
assert.ok(uploadCall);
assert.match(uploadCall.init.headers['Content-Type'], /^multipart\/related; boundary=/);
const multipartText = await uploadCall.init.body.text();
assert.match(multipartText, /"parents":\["appDataFolder"\]/);
assert.match(multipartText, /"moxinApp":"moxin-quiz"/);
assert.ok(
  multipartText.indexOf('{"a":1,"z":2}') >= 0,
  'JSON cloud payload should use canonical key ordering',
);

assert.equal(escapeDriveQueryLiteral("a'b\\c"), "a\\'b\\\\c");

const auth401 = new GoogleDriveTokenManager({
  clientId: 'test-client.apps.googleusercontent.com',
  loader: async () => fakeGoogle,
  now: () => now,
});
await auth401.requestAccessToken();
const provider401 = new GoogleDriveAppDataProvider({
  tokenManager: auth401,
  fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'expired' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  }),
});
await assert.rejects(
  () => provider401.listFiles(),
  error => error instanceof CloudProviderError && error.code === CLOUD_ERROR_CODE.AUTH_REQUIRED,
);
assert.equal(auth401.peekAccessToken(), null, '401 must invalidate the in-memory access token');

const rateTokens = new GoogleDriveTokenManager({
  clientId: 'test-client.apps.googleusercontent.com',
  loader: async () => fakeGoogle,
  now: () => now,
});
await rateTokens.requestAccessToken();
const rateProvider = new GoogleDriveAppDataProvider({
  tokenManager: rateTokens,
  fetchImpl: async () => new Response(JSON.stringify({
    error: {
      message: 'slow down',
      errors: [{ reason: 'userRateLimitExceeded' }],
    },
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  }),
});
await assert.rejects(
  () => rateProvider.listFiles(),
  error =>
    error instanceof CloudProviderError &&
    error.code === CLOUD_ERROR_CODE.RATE_LIMIT &&
    error.retryable === true,
);

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b[0-9A-Za-z.-]+-\d+'/);
assert.match(sw, /src\/cloud\/google\/google-drive\.js/);
assert.doesNotMatch(sw, /accounts\.google\.com\/gsi\/client/);
assert.doesNotMatch(sw, /www\.googleapis\.com/);

console.log('V5 B08 cloud provider unit contracts passed.');
