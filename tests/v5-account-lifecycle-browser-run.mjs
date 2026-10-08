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
      ensureCloudProfile,
    } = await import('/src/sync/cloud-profile.js');
    const {
      createCloudCommit,
      cloudAppProperties,
    } = await import('/src/sync/cloud-contract.js');
    const {
      inspectAccountSwitch,
      confirmAccountSwitch,
      unlinkCurrentCloudProfile,
    } = await import('/src/sync/account-lifecycle.js');
    const { runSyncCycle } = await import('/src/sync/sync-engine.js');
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

    const makeProvider = subject => {
      const files = [];
      const payloads = new Map();
      let createCount = 0;
      const account = {
        provider: 'google',
        providerSubject: subject,
        displayName: subject === 'account-a' ? 'Account A' : 'Account B',
        displayEmail: `${subject}@example.test`,
        photoUrl: null,
      };
      const clone = value => structuredClone(value);

      return {
        files,
        payloads,
        get createCount() { return createCount; },
        async getAccountProfile() {
          return clone(account);
        },
        async listFiles({ appProperties = {}, pageToken = null } = {}) {
          if (pageToken) return { files: [], nextPageToken: null };
          return {
            files: files.filter(file =>
              Object.entries(appProperties).every(([key, value]) =>
                String(file.appProperties?.[key] || '') === String(value)
              )
            ).map(clone),
            nextPageToken: null,
          };
        },
        async createJsonFile({ name, data, appProperties }) {
          createCount += 1;
          const file = {
            id: `${subject}-file-${files.length + 1}`,
            name,
            mimeType: 'application/json',
            modifiedTime: '2026-10-07T02:00:00.000Z',
            appProperties: { ...appProperties },
          };
          files.push(file);
          payloads.set(file.id, clone(data));
          return clone(file);
        },
        async updateJsonFile(fileId, { name, data, appProperties }) {
          const index = files.findIndex(file => file.id === fileId);
          if (index < 0) throw new Error('file not found');
          files[index] = {
            ...files[index],
            name: name || files[index].name,
            modifiedTime: '2026-10-07T02:01:00.000Z',
            appProperties: { ...appProperties },
          };
          payloads.set(fileId, clone(data));
          return clone(files[index]);
        },
        async downloadJson(fileId) {
          return clone(payloads.get(fileId));
        },
        async getFileMetadata(fileId) {
          return clone(files.find(file => file.id === fileId));
        },
      };
    };

    const providerA = makeProvider('account-a');
    const providerB = makeProvider('account-b');
    await ensureCloudProfile(providerA, {
      profileId: 'profile-a',
      now: new Date('2026-10-07T02:00:00.000Z'),
    });
    await ensureCloudProfile(providerB, {
      profileId: 'profile-b',
      now: new Date('2026-10-07T02:00:00.000Z'),
    });

    let db = await openDatabase();
    let tx = db.transaction(
      ['syncMeta', 'devices', 'syncRevisions'],
      'readwrite',
    );
    let done = transactionDone(tx);
    let meta =
      await requestToPromise(tx.objectStore('syncMeta').get('global'));
    tx.objectStore('syncMeta').put({
      ...meta,
      linkedProfileId: 'profile-a',
      cloudSchemaVersion: 1,
      cloudAccount: {
        provider: 'google',
        providerSubject: 'account-a',
        displayName: 'Account A',
        displayEmail: 'account-a@example.test',
        photoUrl: null,
      },
      runtimeState: 'SYNCED',
    });

    const oldDeviceRevision = {
      revisionId: 'rev-old-account-device',
      parentRevisionIds: [],
      changedAt: '2026-10-07T02:00:30.000Z',
      changedByDeviceId: meta.deviceId,
      clock: {
        physicalMs: Date.parse('2026-10-07T02:00:30.000Z'),
        logical: 0,
        deviceId: meta.deviceId,
      },
    };
    tx.objectStore('devices').put({
      deviceId: 'device-from-old-account',
      label: '舊帳號筆電',
      status: 'active',
      createdAt: '2026-10-07T02:00:30.000Z',
      lastSeenAt: '2026-10-07T02:00:30.000Z',
      lastSyncAt: null,
      appVersion: '5.0.0-dev',
      revision: oldDeviceRevision,
    });
    tx.objectStore('syncRevisions').put({
      ...oldDeviceRevision,
      entityType: 'device',
      entityKey: 'device-from-old-account',
    });
    await done;

    await setFavorite('bank-local-switch', 'Q1', true);

    const remoteFavoriteRevision = {
      revisionId: 'rev-account-b-favorite',
      parentRevisionIds: [],
      changedAt: '2026-10-07T02:02:00.000Z',
      changedByDeviceId: 'device-b-remote',
      clock: {
        physicalMs: Date.parse('2026-10-07T02:02:00.000Z'),
        logical: 0,
        deviceId: 'device-b-remote',
      },
    };
    const remoteFavoriteCommit = await createCloudCommit({
      profileId: 'profile-b',
      deviceId: 'device-b-remote',
      deviceSequence: 1,
      commitId: 'commit-account-b-favorite',
      createdAt: '2026-10-07T02:02:00.000Z',
      mutations: [{
        mutationId: 'mutation-account-b-favorite',
        type: 'favorite',
        key: 'bank-remote-switch::Q9',
        op: 'upsert',
        policy: 'coalescible',
        revision: remoteFavoriteRevision,
        value: {
          key: 'bank-remote-switch::Q9',
          bankId: 'bank-remote-switch',
          questionId: 'Q9',
          isFavorite: true,
          firstAddedAt: '2026-10-07T02:02:00.000Z',
          changedAt: '2026-10-07T02:02:00.000Z',
          revision: remoteFavoriteRevision,
        },
      }],
    });
    await providerB.createJsonFile({
      name: 'commit-account-b-favorite.json',
      data: remoteFavoriteCommit,
      appProperties: cloudAppProperties({
        profileId: 'profile-b',
        objectType: 'commit',
        objectId: remoteFavoriteCommit.commitId,
        hash: remoteFavoriteCommit.payloadHash,
      }),
    });

    const filesBeforeBlocked = providerB.files.length;
    const wrongAccountCycle = await runSyncCycle(providerB, {
      profileId: 'profile-a',
      now: () => new Date('2026-10-07T02:03:00.000Z'),
    });
    const filesAfterBlocked = providerB.files.length;

    const filesBeforeInspect = providerB.files.length;
    const inspected = await inspectAccountSwitch(providerB, {
      now: new Date('2026-10-07T02:04:00.000Z'),
    });
    const filesAfterInspect = providerB.files.length;

    db = await openDatabase();
    const metaAfterInspect =
      await requestToPromise(
        db.transaction('syncMeta', 'readonly')
          .objectStore('syncMeta')
          .get('global'),
      );

    const confirmed = await confirmAccountSwitch(
      providerB,
      inspected.reconciliation.reconciliationId,
      { now: new Date('2026-10-07T02:05:00.000Z') },
    );

    db = await openDatabase();
    const afterConfirmTx = db.transaction(
      ['syncMeta', 'devices', 'syncOutbox', 'syncRevisions'],
      'readonly',
    );
    const metaAfterConfirm =
      await requestToPromise(afterConfirmTx.objectStore('syncMeta').get('global'));
    const devicesAfterConfirm =
      await requestToPromise(afterConfirmTx.objectStore('devices').getAll());
    const outboxAfterConfirm =
      await requestToPromise(afterConfirmTx.objectStore('syncOutbox').getAll());
    const revisionsAfterConfirm =
      await requestToPromise(afterConfirmTx.objectStore('syncRevisions').getAll());
    const deviceRevisionsAfterConfirm = revisionsAfterConfirm.filter(
      revision => revision.entityType === 'device',
    );

    const mergedCycle = await runSyncCycle(providerB, {
      profileId: 'profile-b',
      now: () => new Date('2026-10-07T02:06:00.000Z'),
    });

    const switchCheckpoint = await publishCheckpointIfDue(providerB, {
      profileId: 'profile-b',
      force: true,
      now: () => new Date('2026-10-07T02:06:30.000Z'),
    });

    db = await openDatabase();
    const remoteFavorite =
      await requestToPromise(
        db.transaction('favorites', 'readonly')
          .objectStore('favorites')
          .get('bank-remote-switch::Q9'),
      );
    meta =
      await requestToPromise(
        db.transaction('syncMeta', 'readonly')
          .objectStore('syncMeta')
          .get('global'),
      );
    const currentDevice =
      await requestToPromise(
        db.transaction('devices', 'readonly')
          .objectStore('devices')
          .get(meta.deviceId),
      );

    await setFavorite('bank-local-switch', 'Q2', true);

    const revokePhysicalMs = Math.max(
      Date.parse('2026-10-07T02:07:00.000Z'),
      Number(currentDevice?.revision?.clock?.physicalMs || 0) + 1000,
    );
    const revokeChangedAt = new Date(revokePhysicalMs).toISOString();
    const revokeRevision = {
      revisionId: 'rev-account-b-revoke-current',
      parentRevisionIds: currentDevice?.revision?.revisionId
        ? [currentDevice.revision.revisionId]
        : [],
      changedAt: revokeChangedAt,
      changedByDeviceId: 'device-b-controller',
      clock: {
        physicalMs: revokePhysicalMs,
        logical: 0,
        deviceId: 'device-b-controller',
      },
    };
    const revokeCommit = await createCloudCommit({
      profileId: 'profile-b',
      deviceId: 'device-b-controller',
      deviceSequence: 1,
      commitId: 'commit-account-b-revoke',
      createdAt: '2026-10-07T02:07:00.000Z',
      mutations: [{
        mutationId: 'mutation-account-b-revoke',
        type: 'device',
        key: meta.deviceId,
        op: 'upsert',
        policy: 'coalescible',
        revision: revokeRevision,
        value: {
          ...currentDevice,
          deviceId: meta.deviceId,
          status: 'revoked',
          revokedAt: revokeChangedAt,
          updatedAt: revokeChangedAt,
          revision: revokeRevision,
        },
      }],
    });
    await providerB.createJsonFile({
      name: 'commit-account-b-revoke.json',
      data: revokeCommit,
      appProperties: cloudAppProperties({
        profileId: 'profile-b',
        objectType: 'commit',
        objectId: revokeCommit.commitId,
        hash: revokeCommit.payloadHash,
      }),
    });

    const filesBeforeRevokedCycle = providerB.files.length;
    const revokedCycle = await runSyncCycle(providerB, {
      profileId: 'profile-b',
      now: () => new Date('2026-10-07T02:08:00.000Z'),
    });
    const filesAfterRevokedCycle = providerB.files.length;

    const unlink = await unlinkCurrentCloudProfile({
      now: new Date('2026-10-07T02:09:00.000Z'),
    });

    db = await openDatabase();
    const finalTx = db.transaction(
      [
        'syncMeta',
        'syncOutbox',
        'syncReceipts',
        'favorites',
        'devices',
        'syncRevisions',
      ],
      'readonly',
    );
    const finalMeta =
      await requestToPromise(finalTx.objectStore('syncMeta').get('global'));
    const finalOutbox =
      await requestToPromise(finalTx.objectStore('syncOutbox').count());
    const finalReceipts =
      await requestToPromise(finalTx.objectStore('syncReceipts').count());
    const localQ1 =
      await requestToPromise(
        finalTx.objectStore('favorites').get('bank-local-switch::Q1'),
      );
    const localQ2 =
      await requestToPromise(
        finalTx.objectStore('favorites').get('bank-local-switch::Q2'),
      );
    const finalDevices =
      await requestToPromise(finalTx.objectStore('devices').getAll());
    const finalRevisions =
      await requestToPromise(finalTx.objectStore('syncRevisions').getAll());
    const finalDeviceRevisions = finalRevisions.filter(
      revision => revision.entityType === 'device',
    );

    return {
      wrongAccountCycle: {
        status: wrongAccountCycle.status,
        reason: wrongAccountCycle.reason,
      },
      blockedCreatedNoFiles: filesAfterBlocked === filesBeforeBlocked,
      inspectStatus: inspected.status,
      inspectPlan: inspected.plan.plan,
      inspectCreatedNoFiles: filesAfterInspect === filesBeforeInspect,
      linkedProfileAfterInspect: metaAfterInspect.linkedProfileId,
      confirmedPhase: confirmed.reconciliation.phase,
      confirmedResumed: confirmed.resumed,
      linkedProfileAfterConfirm: metaAfterConfirm.linkedProfileId,
      currentDeviceIdAfterConfirm: metaAfterConfirm.deviceId,
      devicesAfterConfirm: devicesAfterConfirm.map(item => item.deviceId),
      outboxAfterConfirm: outboxAfterConfirm.length,
      deviceRevisionsAfterConfirm: deviceRevisionsAfterConfirm.map(item => ({
        revisionId: item.revisionId,
        entityKey: item.entityKey,
        parentRevisionIds: item.parentRevisionIds || [],
      })),
      mergedCycle: {
        status: mergedCycle.status,
        runtimeState: mergedCycle.runtimeState,
      },
      remoteFavorite: remoteFavorite?.isFavorite ?? null,
      switchCheckpointStatus: switchCheckpoint.status,
      switchCheckpointDeviceHeads:
        switchCheckpoint.checkpoint?.entityHeadIndex
          ?.filter(item => item.entityType === 'device')
          .map(item => ({
            entityKey: item.entityKey,
            revisionId: item.revisionId,
          })) || [],
      revokedCycle: {
        status: revokedCycle.status,
        reason: revokedCycle.reason,
        pulled: revokedCycle.pulled?.length || 0,
        pushed: revokedCycle.pushed?.length || 0,
      },
      revokedCreatedNoPushFiles:
        filesAfterRevokedCycle === filesBeforeRevokedCycle,
      unlink,
      finalLinkedProfileId: finalMeta.linkedProfileId,
      finalRuntimeState: finalMeta.runtimeState,
      finalBlockReason: finalMeta.blockReason ?? null,
      finalOutbox,
      finalReceipts,
      localQ1: localQ1?.isFavorite ?? null,
      localQ2: localQ2?.isFavorite ?? null,
      finalDevices: finalDevices.map(item => ({
        deviceId: item.deviceId,
        status: item.status,
        revisionId: item.revision?.revisionId || null,
        parentRevisionIds: item.revision?.parentRevisionIds || [],
      })),
      finalDeviceRevisions: finalDeviceRevisions.map(item => ({
        revisionId: item.revisionId,
        entityKey: item.entityKey,
        parentRevisionIds: item.parentRevisionIds || [],
      })),
    };
  }, DB_NAME);

  assert.equal(result.wrongAccountCycle.status, 'blocked');
  assert.equal(result.wrongAccountCycle.reason, 'account-switch-required');
  assert.equal(result.blockedCreatedNoFiles, true);

  assert.equal(result.inspectStatus, 'planning');
  assert.equal(result.inspectPlan, 'merge-required');
  assert.equal(result.inspectCreatedNoFiles, true);
  assert.equal(result.linkedProfileAfterInspect, 'profile-a');

  assert.equal(result.confirmedPhase, 'applying');
  assert.equal(result.confirmedResumed, false);
  assert.equal(result.linkedProfileAfterConfirm, 'profile-b');
  assert.equal(result.devicesAfterConfirm.length, 1);
  assert.ok(result.outboxAfterConfirm >= 2);
  assert.equal(result.deviceRevisionsAfterConfirm.length, 1);
  assert.equal(
    result.deviceRevisionsAfterConfirm[0].entityKey,
    result.currentDeviceIdAfterConfirm,
  );
  assert.deepEqual(
    result.deviceRevisionsAfterConfirm[0].parentRevisionIds,
    [],
  );
  assert.notEqual(
    result.deviceRevisionsAfterConfirm[0].revisionId,
    'rev-old-account-device',
  );

  assert.equal(result.mergedCycle.status, 'synced');
  assert.equal(result.mergedCycle.runtimeState, 'SYNCED');
  assert.equal(result.remoteFavorite, true);
  assert.equal(result.switchCheckpointStatus, 'published');
  assert.equal(result.switchCheckpointDeviceHeads.length, 1);
  assert.equal(
    result.switchCheckpointDeviceHeads[0].entityKey,
    result.currentDeviceIdAfterConfirm,
  );
  assert.notEqual(
    result.switchCheckpointDeviceHeads[0].revisionId,
    'rev-old-account-device',
  );

  assert.equal(result.revokedCycle.status, 'blocked');
  assert.equal(result.revokedCycle.reason, 'device-revoked');
  assert.ok(result.revokedCycle.pulled >= 1);
  assert.equal(result.revokedCycle.pushed, 0);
  assert.equal(result.revokedCreatedNoPushFiles, true);

  assert.equal(result.unlink.status, 'unlinked');
  assert.equal(result.unlink.preservedLocalData, true);
  assert.equal(result.unlink.revokedRemoteData, false);
  assert.equal(result.finalLinkedProfileId, null);
  assert.equal(result.finalRuntimeState, 'LOCAL_ONLY');
  assert.equal(result.finalBlockReason, null);
  assert.equal(result.finalOutbox, 0);
  assert.equal(result.finalReceipts, 0);
  assert.equal(result.localQ1, true);
  assert.equal(result.localQ2, true);
  assert.equal(result.finalDevices.length, 1);
  assert.equal(result.finalDevices[0].status, 'active');
  assert.deepEqual(result.finalDevices[0].parentRevisionIds, []);
  assert.notEqual(
    result.finalDevices[0].revisionId,
    'rev-account-b-revoke-current',
  );
  assert.equal(result.finalDeviceRevisions.length, 1);
  assert.equal(
    result.finalDeviceRevisions[0].entityKey,
    result.finalDevices[0].deviceId,
  );
  assert.equal(
    result.finalDeviceRevisions[0].revisionId,
    result.finalDevices[0].revisionId,
  );
  assert.deepEqual(result.finalDeviceRevisions[0].parentRevisionIds, []);
  assert.notEqual(
    result.finalDeviceRevisions[0].revisionId,
    'rev-old-account-device',
  );

  console.log('V5 B13B.5 account lifecycle consistency browser gate passed.');
} finally {
  await browser.close();
}
