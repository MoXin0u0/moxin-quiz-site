export const APP_CONFIG = Object.freeze({
  appName: 'MoXin Quiz',
  appVersion: '4.0.0-rc.1',
  releaseChannel: 'rc1',
  schemaVersion: '2.0',
  dbName: 'moxin-quiz-v3',
  dbVersion: 3,
  legacyStoragePrefix: 'moxin.',
  packageLimits: Object.freeze({
    maxZipBytes: 100 * 1024 * 1024,
    maxUncompressedBytes: 250 * 1024 * 1024,
    maxSingleFileBytes: 25 * 1024 * 1024,
    maxFiles: 5000,
    maxCompressionRatio: 100,
  }),
});
