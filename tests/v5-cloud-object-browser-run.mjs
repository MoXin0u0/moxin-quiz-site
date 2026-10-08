import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  const result = await page.evaluate(async () => {
    const {
      ensureCloudAsset,
      ensureJsonDocumentObject,
      downloadAssetObject,
      downloadJsonObject,
    } = await import('/src/sync/cloud-object-transport.js');
    const { sha256Blob } = await import('/src/sync/hash.js');

    const files = [];
    const payloads = new Map();
    let createBlobCalls = 0;
    let createJsonCalls = 0;

    const provider = {
      async listFiles({ appProperties = {}, pageToken = null } = {}) {
        if (pageToken) return { files: [], nextPageToken: null };
        return {
          files: files.filter(file =>
            Object.entries(appProperties).every(([key, value]) =>
              String(file.appProperties?.[key] || '') === String(value)
            )
          ),
          nextPageToken: null,
        };
      },
      async createBlobFile({ name, blob, mimeType, appProperties }) {
        createBlobCalls += 1;
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType,
          size: String(blob.size),
          appProperties: { ...appProperties },
        };
        files.push(file);
        payloads.set(file.id, blob);
        return file;
      },
      async createJsonFile({ name, data, appProperties }) {
        createJsonCalls += 1;
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType: 'application/json',
          appProperties: { ...appProperties },
        };
        files.push(file);
        payloads.set(file.id, structuredClone(data));
        return file;
      },
      async getFileMetadata(fileId) {
        return structuredClone(files.find(file => file.id === fileId));
      },
      async downloadJson(fileId) {
        return structuredClone(payloads.get(fileId));
      },
      async downloadFile(fileId) {
        return payloads.get(fileId);
      },
    };

    const blob = new Blob(['asset-data'], { type: 'image/png' });
    const hash = await sha256Blob(blob);

    const firstAsset = await ensureCloudAsset(provider, {
      profileId: 'profile-a',
      blob,
      contentHash: hash,
      mimeType: 'image/png',
    });
    const secondAsset = await ensureCloudAsset(provider, {
      profileId: 'profile-a',
      blob,
      contentHash: hash,
      mimeType: 'image/png',
    });

    const document = {
      documentVersion: 1,
      draftId: 'draft-a',
      assets: [{
        path: 'assets/a.png',
        contentHash: hash,
        objectRef: firstAsset,
      }],
      revision: { revisionId: 'rev-a' },
    };

    const firstDoc = await ensureJsonDocumentObject(provider, {
      profileId: 'profile-a',
      objectType: 'draft',
      logicalId: 'draft-a',
      revisionId: 'rev-a',
      document,
    });
    const secondDoc = await ensureJsonDocumentObject(provider, {
      profileId: 'profile-a',
      objectType: 'draft',
      logicalId: 'draft-a',
      revisionId: 'rev-a',
      document,
    });

    const downloadedDoc = await downloadJsonObject(provider, firstDoc, {
      expectedProfileId: 'profile-a',
    });
    const downloadedBlob = await downloadAssetObject(provider, firstAsset, {
      expectedProfileId: 'profile-a',
    });

    return {
      createBlobCalls,
      createJsonCalls,
      firstAsset,
      secondAsset,
      firstDoc,
      secondDoc,
      downloadedDoc,
      downloadedAssetHash: await sha256Blob(downloadedBlob),
      originalAssetHash: hash,
    };
  });

  assert.equal(result.createBlobCalls, 1, 'content-addressed asset upload must deduplicate by hash');
  assert.equal(result.createJsonCalls, 1, 'same immutable document revision must not upload twice');
  assert.equal(result.firstAsset.driveFileId, result.secondAsset.driveFileId);
  assert.equal(result.firstDoc.driveFileId, result.secondDoc.driveFileId);
  assert.equal(result.downloadedDoc.draftId, 'draft-a');
  assert.equal(result.downloadedAssetHash, result.originalAssetHash);

  console.log('V5 B11A cloud object browser gate passed.');
} finally {
  await browser.close();
}
