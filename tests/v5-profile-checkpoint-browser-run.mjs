import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  const result = await page.evaluate(async dbName => {
    const {
      closeDatabase,
      openDatabase,
      requestToPromise,
      transactionDone,
    } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } =
      await import('/src/storage/migrations/v5-migration.js');
    const { setFavorite } =
      await import('/src/storage/repositories/learning.js');
    const {
      renameDeviceProfile,
      revokeRemoteDeviceProfile,
    } = await import('/src/storage/repositories/devices.js');
    const {
      ensureCloudProfile,
      discoverCloudProfile,
    } = await import('/src/sync/cloud-profile.js');
    const { publishCheckpointIfDue } =
      await import('/src/sync/checkpoint.js');

    await closeDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('IndexedDB delete blocked.'));
    });
    await openDatabase();
    await runV5MigrationToCompletion();

    const files = [];
    const payloads = new Map();
    const cloneFile = file => structuredClone(file);
    const provider = {
      async listFiles({ appProperties = {}, pageToken = null } = {}) {
        if (pageToken) return { files: [], nextPageToken: null };
        return {
          files: files.filter(file =>
            Object.entries(appProperties).every(([key, value]) =>
              String(file.appProperties?.[key] || '') === String(value)
            )
          ).map(cloneFile),
          nextPageToken: null,
        };
      },
      async createJsonFile({ name, data, appProperties }) {
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType: 'application/json',
          modifiedTime: '2026-10-07T01:10:00.000Z',
          appProperties: { ...appProperties },
        };
        files.push(file);
        payloads.set(file.id, structuredClone(data));
        return cloneFile(file);
      },
      async updateJsonFile(fileId, { name, data, appProperties }) {
        const index = files.findIndex(file => file.id === fileId);
        if (index < 0) throw new Error('file not found');
        files[index] = {
          ...files[index],
          name: name || files[index].name,
          modifiedTime: '2026-10-07T01:11:00.000Z',
          appProperties: { ...appProperties },
        };
        payloads.set(fileId, structuredClone(data));
        return cloneFile(files[index]);
      },
      async downloadJson(fileId) {
        return structuredClone(payloads.get(fileId));
      },
    };

    const cloud = await ensureCloudProfile(provider, {
      profileId: 'profile-b13a',
      now: new Date('2026-10-07T01:00:00.000Z'),
    });

    let db = await openDatabase();
    let tx = db.transaction('syncMeta', 'readwrite');
    let done = transactionDone(tx);
    let meta =
      await requestToPromise(tx.objectStore('syncMeta').get('global'));
    tx.objectStore('syncMeta').put({
      ...meta,
      linkedProfileId: 'profile-b13a',
      lastSuccessfulSyncAt: '2026-10-07T01:00:00.000Z',
    });
    await done;

    await setFavorite('bank-b13a', 'Q1', true);

    db = await openDatabase();
    tx = db.transaction('syncReceipts', 'readwrite');
    done = transactionDone(tx);
    for (let index = 1; index <= 100; index += 1) {
      tx.objectStore('syncReceipts').put({
        commitId: `commit-b13a-${index}`,
        deviceId: index <= 60 ? 'device-a' : 'device-b',
        deviceSequence: index <= 60 ? index : index - 60,
        payloadHash: `hash-${index}`,
        appliedAt: '2026-10-07T01:02:00.000Z',
        source: 'test',
      });
    }
    await done;

    const published = await publishCheckpointIfDue(provider, {
      profileId: 'profile-b13a',
      now: () => new Date('2026-10-07T01:05:00.000Z'),
    });
    const cloudAfter = await discoverCloudProfile(provider);

    const second = await publishCheckpointIfDue(provider, {
      profileId: 'profile-b13a',
      now: () => new Date('2026-10-07T01:06:00.000Z'),
    });

    db = await openDatabase();
    tx = db.transaction(
      ['syncMeta', 'devices', 'syncRevisions'],
      'readwrite',
    );
    done = transactionDone(tx);
    meta =
      await requestToPromise(tx.objectStore('syncMeta').get('global'));
    const remoteRevision = {
      revisionId: 'rev-remote-device-genesis',
      parentRevisionIds: [],
      changedAt: '2026-10-07T01:07:00.000Z',
      changedByDeviceId: meta.deviceId,
      clock: {
        physicalMs: Date.parse('2026-10-07T01:07:00.000Z'),
        logical: 0,
        deviceId: meta.deviceId,
      },
    };
    tx.objectStore('devices').put({
      deviceId: 'device-remote-b13a',
      label: '舊筆電',
      status: 'active',
      createdAt: '2026-10-07T01:07:00.000Z',
      lastSeenAt: '2026-10-07T01:07:00.000Z',
      lastSyncAt: null,
      appVersion: '5.0.0-dev',
      revision: remoteRevision,
    });
    tx.objectStore('syncRevisions').put({
      ...remoteRevision,
      entityType: 'device',
      entityKey: 'device-remote-b13a',
    });
    await done;

    const renamed = await renameDeviceProfile(
      'device-remote-b13a',
      '旅行筆電',
      { now: new Date('2026-10-07T01:08:00.000Z') },
    );
    const revoked = await revokeRemoteDeviceProfile(
      'device-remote-b13a',
      { now: new Date('2026-10-07T01:09:00.000Z') },
    );

    let selfRevokeRejected = false;
    try {
      await revokeRemoteDeviceProfile(meta.deviceId, {
        now: new Date('2026-10-07T01:10:00.000Z'),
      });
    } catch {
      selfRevokeRejected = true;
    }

    db = await openDatabase();
    const finalTx = db.transaction(
      ['syncMeta', 'syncOutbox', 'cloudObjects'],
      'readonly',
    );
    const finalMeta =
      await requestToPromise(finalTx.objectStore('syncMeta').get('global'));
    const outbox =
      await requestToPromise(finalTx.objectStore('syncOutbox').getAll());
    const checkpointMap = await requestToPromise(
      finalTx.objectStore('cloudObjects')
        .get(`checkpoint:${published.checkpoint.checkpointId}`),
    );
    const deviceOutbox = outbox.filter(row =>
      row.entityType === 'device' &&
      row.entityKey === 'device-remote-b13a'
    );

    return {
      cloudCreated: cloud.created,
      profileId: cloud.profile.profileId,
      checkpointStatus: published.status,
      checkpointReceiptCount: published.checkpoint.receiptCount,
      frontierA: published.checkpoint.commitFrontier['device-a'],
      frontierB: published.checkpoint.commitFrontier['device-b'],
      hasFavoriteHead: published.checkpoint.entityHeadIndex.some(item =>
        item.entityType === 'favorite' &&
        item.entityKey === 'bank-b13a::Q1'
      ),
      profileCheckpointId:
        cloudAfter.profile.latestCheckpoint?.checkpointId || null,
      secondStatus: second.status,
      secondReason: second.reason,
      localCheckpointId: finalMeta.lastCheckpointId,
      checkpointMapped: checkpointMap?.driveFileId || null,
      renamedLabel: renamed.label,
      revokedStatus: revoked.status,
      selfRevokeRejected,
      deviceOutboxCount: deviceOutbox.length,
      deviceOutboxStatus: deviceOutbox[0]?.payload?.status || null,
    };
  }, DB_NAME);

  assert.equal(result.cloudCreated, true);
  assert.equal(result.profileId, 'profile-b13a');
  assert.equal(result.checkpointStatus, 'published');
  assert.equal(result.checkpointReceiptCount, 100);
  assert.equal(result.frontierA, 60);
  assert.equal(result.frontierB, 40);
  assert.equal(result.hasFavoriteHead, true);
  assert.equal(result.profileCheckpointId, result.localCheckpointId);
  assert.equal(result.secondStatus, 'skipped');
  assert.equal(result.secondReason, 'not-due');
  assert.ok(result.checkpointMapped);
  assert.equal(result.renamedLabel, '旅行筆電');
  assert.equal(result.revokedStatus, 'revoked');
  assert.equal(result.selfRevokeRejected, true);
  assert.equal(result.deviceOutboxCount, 1);
  assert.equal(result.deviceOutboxStatus, 'revoked');

  console.log(
    'V5 B13A cloud profile/checkpoint/device browser gate passed.',
  );
} finally {
  await browser.close();
}
