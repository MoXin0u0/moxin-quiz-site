export const CLOUD_PROVIDER_KIND = Object.freeze({
  GOOGLE_DRIVE: 'google-drive',
});

export const CLOUD_ERROR_CODE = Object.freeze({
  CONFIG_REQUIRED: 'CONFIG_REQUIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_CANCELLED: 'AUTH_CANCELLED',
  NETWORK: 'NETWORK',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNSUPPORTED: 'UNSUPPORTED',
});

export class CloudProviderError extends Error {
  constructor(message, {
    code = CLOUD_ERROR_CODE.INVALID_RESPONSE,
    status = null,
    retryable = false,
    details = null,
    cause = null,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'CloudProviderError';
    this.code = code;
    this.status = Number.isFinite(Number(status)) ? Number(status) : null;
    this.retryable = Boolean(retryable);
    this.details = details || null;
  }
}

export const CLOUD_PROVIDER_METHODS = Object.freeze([
  'isConfigured',
  'authorize',
  'getAccountProfile',
  'listFiles',
  'downloadJson',
  'createJsonFile',
  'createBlobFile',
  'deleteFile',
]);

export function assertCloudProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Cloud provider must be an object.');
  }
  for (const method of CLOUD_PROVIDER_METHODS) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(`Cloud provider is missing method: ${method}`);
    }
  }
  return provider;
}
