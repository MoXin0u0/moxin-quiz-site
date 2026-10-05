import { APP_CONFIG } from '../../app/config.js';
import { canonicalJson } from '../../sync/canonical.js';
import {
  CLOUD_ERROR_CODE,
  CLOUD_PROVIDER_KIND,
  CloudProviderError,
  assertCloudProvider,
} from '../provider.js';
import { GoogleDriveTokenManager } from './google-auth.js';

const DEFAULT_FILE_FIELDS = [
  'id',
  'name',
  'mimeType',
  'size',
  'md5Checksum',
  'createdTime',
  'modifiedTime',
  'appProperties',
].join(',');

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function escapeDriveQueryLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeAppProperties(value = {}) {
  const result = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (item === null || item === undefined) continue;
    result[String(key)] = String(item);
  }
  return result;
}

function responseErrorCode(status, payload) {
  const reasons = payload?.error?.errors?.map(item => item?.reason).filter(Boolean) || [];
  if (status === 401) return CLOUD_ERROR_CODE.AUTH_REQUIRED;
  if (status === 404) return CLOUD_ERROR_CODE.NOT_FOUND;
  if (status === 429 || reasons.some(reason => /rateLimitExceeded|userRateLimitExceeded/i.test(reason))) {
    return CLOUD_ERROR_CODE.RATE_LIMIT;
  }
  if (status === 403) return CLOUD_ERROR_CODE.FORBIDDEN;
  if (status >= 500) return CLOUD_ERROR_CODE.SERVER_ERROR;
  if (status >= 400) return CLOUD_ERROR_CODE.BAD_REQUEST;
  return CLOUD_ERROR_CODE.INVALID_RESPONSE;
}

function isRetryableStatus(status, payload) {
  const code = responseErrorCode(status, payload);
  return code === CLOUD_ERROR_CODE.RATE_LIMIT || code === CLOUD_ERROR_CODE.SERVER_ERROR;
}

async function readErrorPayload(response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function multipartBody(metadata, blob, mimeType) {
  const boundary = `moxin-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const head =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  return {
    boundary,
    body: new Blob([head, blob, tail], {
      type: `multipart/related; boundary=${boundary}`,
    }),
  };
}

export class GoogleDriveAppDataProvider {
  constructor({
    tokenManager = new GoogleDriveTokenManager(),
    fetchImpl = globalThis.fetch?.bind(globalThis),
    apiBaseUrl = APP_CONFIG.cloud.googleDriveApiBaseUrl,
    uploadBaseUrl = APP_CONFIG.cloud.googleDriveUploadBaseUrl,
    resumableThresholdBytes = APP_CONFIG.cloud.resumableThresholdBytes,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new CloudProviderError(
        'Fetch API is unavailable for Google Drive.',
        { code: CLOUD_ERROR_CODE.UNSUPPORTED },
      );
    }

    this.kind = CLOUD_PROVIDER_KIND.GOOGLE_DRIVE;
    this.tokenManager = tokenManager;
    this.fetchImpl = fetchImpl;
    this.apiBaseUrl = trimSlash(apiBaseUrl);
    this.uploadBaseUrl = trimSlash(uploadBaseUrl);
    this.resumableThresholdBytes = Math.max(0, Number(resumableThresholdBytes) || 0);
  }

  isConfigured() {
    return this.tokenManager.isConfigured();
  }

  authorize(options) {
    return this.tokenManager.requestAccessToken(options);
  }

  clearAuthorization() {
    this.tokenManager.clearAccessToken();
  }

  revokeAuthorization() {
    return this.tokenManager.revokeCurrentAccess();
  }

  async getAccountProfile({ interactive = false } = {}) {
    const url = new URL(`${this.apiBaseUrl}/about`);
    url.searchParams.set('fields', 'user(permissionId,displayName,emailAddress,photoLink)');
    const response = await this.#request(url, { method: 'GET' }, { interactive });
    const payload = await response.json();
    const user = payload?.user || {};
    if (!user.permissionId) {
      throw new CloudProviderError(
        'Google Drive did not return a stable user permission ID.',
        { code: CLOUD_ERROR_CODE.INVALID_RESPONSE, details: payload },
      );
    }
    return {
      provider: 'google',
      providerSubject: String(user.permissionId),
      displayName: user.displayName || null,
      displayEmail: user.emailAddress || null,
      photoUrl: user.photoLink || null,
    };
  }

  async listFiles({
    appProperties = {},
    name = null,
    pageToken = null,
    pageSize = 1000,
    interactive = false,
  } = {}) {
    const url = new URL(`${this.apiBaseUrl}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('pageSize', String(Math.max(1, Math.min(1000, Number(pageSize) || 1000))));
    url.searchParams.set('fields', `nextPageToken,files(${DEFAULT_FILE_FIELDS})`);

    const q = ['trashed = false'];
    if (name) q.push(`name = '${escapeDriveQueryLiteral(name)}'`);
    for (const [key, value] of Object.entries(normalizeAppProperties(appProperties))) {
      q.push(
        `appProperties has { key = '${escapeDriveQueryLiteral(key)}' and value = '${escapeDriveQueryLiteral(value)}' }`,
      );
    }
    url.searchParams.set('q', q.join(' and '));
    if (pageToken) url.searchParams.set('pageToken', String(pageToken));

    const response = await this.#request(url, { method: 'GET' }, { interactive });
    const payload = await response.json();
    return {
      files: Array.isArray(payload?.files) ? payload.files : [],
      nextPageToken: payload?.nextPageToken || null,
    };
  }

  async listAllFiles(options = {}) {
    const files = [];
    let pageToken = null;
    do {
      const page = await this.listFiles({ ...options, pageToken });
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  async getFileMetadata(fileId, { interactive = false } = {}) {
    const url = new URL(`${this.apiBaseUrl}/files/${encodeURIComponent(String(fileId))}`);
    url.searchParams.set('fields', DEFAULT_FILE_FIELDS);
    const response = await this.#request(url, { method: 'GET' }, { interactive });
    return response.json();
  }

  async downloadFile(fileId, {
    interactive = false,
    responseType = 'blob',
  } = {}) {
    const url = new URL(`${this.apiBaseUrl}/files/${encodeURIComponent(String(fileId))}`);
    url.searchParams.set('alt', 'media');
    const response = await this.#request(url, { method: 'GET' }, { interactive });

    if (responseType === 'arrayBuffer') return response.arrayBuffer();
    if (responseType === 'text') return response.text();
    if (responseType === 'json') return response.json();
    return response.blob();
  }

  downloadJson(fileId, options = {}) {
    return this.downloadFile(fileId, { ...options, responseType: 'json' });
  }

  async createJsonFile({
    name,
    data,
    appProperties = {},
    interactive = false,
  }) {
    const json = canonicalJson(data);
    if (json === undefined) {
      throw new TypeError('Cloud JSON payload cannot be undefined.');
    }
    const blob = new Blob([json], { type: 'application/json' });
    return this.#multipartUpload({
      method: 'POST',
      name,
      blob,
      mimeType: 'application/json',
      appProperties,
      interactive,
    });
  }

  async updateJsonFile(fileId, {
    name = null,
    data,
    appProperties = {},
    interactive = false,
  }) {
    const json = canonicalJson(data);
    if (json === undefined) {
      throw new TypeError('Cloud JSON payload cannot be undefined.');
    }
    return this.#multipartUpload({
      method: 'PATCH',
      fileId,
      name,
      blob: new Blob([json], { type: 'application/json' }),
      mimeType: 'application/json',
      appProperties,
      interactive,
    });
  }

  async createBlobFile({
    name,
    blob,
    mimeType = blob?.type || 'application/octet-stream',
    appProperties = {},
    interactive = false,
    forceResumable = false,
  }) {
    if (!(blob instanceof Blob)) throw new TypeError('createBlobFile requires a Blob.');

    if (forceResumable || blob.size >= this.resumableThresholdBytes) {
      const sessionUrl = await this.beginResumableUpload({
        name,
        mimeType,
        size: blob.size,
        appProperties,
        interactive,
      });
      const result = await this.uploadResumableContent(sessionUrl, blob, {
        totalSize: blob.size,
        interactive,
      });
      if (!result.complete) {
        throw new CloudProviderError(
          'Google Drive resumable upload did not complete.',
          {
            code: CLOUD_ERROR_CODE.NETWORK,
            retryable: true,
            details: result,
          },
        );
      }
      return result.file;
    }

    return this.#multipartUpload({
      method: 'POST',
      name,
      blob,
      mimeType,
      appProperties,
      interactive,
    });
  }

  async beginResumableUpload({
    name,
    mimeType = 'application/octet-stream',
    size,
    appProperties = {},
    fileId = null,
    interactive = false,
  }) {
    const create = !fileId;
    const url = new URL(
      create
        ? `${this.uploadBaseUrl}/files`
        : `${this.uploadBaseUrl}/files/${encodeURIComponent(String(fileId))}`,
    );
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('fields', DEFAULT_FILE_FIELDS);

    const metadata = {
      ...(name ? { name: String(name) } : {}),
      mimeType,
      appProperties: normalizeAppProperties(appProperties),
      ...(create ? { parents: ['appDataFolder'] } : {}),
    };

    const response = await this.#request(url, {
      method: create ? 'POST' : 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(Math.max(0, Number(size) || 0)),
      },
      body: JSON.stringify(metadata),
    }, { interactive });

    const location = response.headers.get('Location');
    if (!location) {
      throw new CloudProviderError(
        'Google Drive did not return a resumable upload URL.',
        { code: CLOUD_ERROR_CODE.INVALID_RESPONSE },
      );
    }
    return location;
  }

  async uploadResumableContent(sessionUrl, blob, {
    offset = 0,
    totalSize = blob?.size || 0,
    interactive = false,
  } = {}) {
    if (!(blob instanceof Blob)) throw new TypeError('uploadResumableContent requires a Blob.');
    const start = Math.max(0, Number(offset) || 0);
    const total = Math.max(start + blob.size, Number(totalSize) || blob.size);
    const end = start + blob.size - 1;

    const headers = {
      'Content-Type': blob.type || 'application/octet-stream',
    };
    if (blob.size > 0) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;

    const response = await this.#request(String(sessionUrl), {
      method: 'PUT',
      headers,
      body: blob,
    }, {
      interactive,
      acceptedStatuses: [308],
    });

    if (response.status === 308) {
      return {
        complete: false,
        uploadedRange: response.headers.get('Range') || null,
        sessionUrl: String(sessionUrl),
      };
    }

    return {
      complete: true,
      file: await response.json(),
      sessionUrl: String(sessionUrl),
    };
  }

  async deleteFile(fileId, { interactive = false } = {}) {
    const url = new URL(`${this.apiBaseUrl}/files/${encodeURIComponent(String(fileId))}`);
    await this.#request(url, { method: 'DELETE' }, { interactive });
    return true;
  }

  async #multipartUpload({
    method,
    fileId = null,
    name = null,
    blob,
    mimeType,
    appProperties,
    interactive,
  }) {
    const create = method === 'POST';
    const url = new URL(
      create
        ? `${this.uploadBaseUrl}/files`
        : `${this.uploadBaseUrl}/files/${encodeURIComponent(String(fileId))}`,
    );
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('fields', DEFAULT_FILE_FIELDS);

    const metadata = {
      ...(name ? { name: String(name) } : {}),
      mimeType,
      appProperties: normalizeAppProperties(appProperties),
      ...(create ? { parents: ['appDataFolder'] } : {}),
    };

    const multipart = multipartBody(metadata, blob, mimeType);
    const response = await this.#request(url, {
      method,
      headers: {
        'Content-Type': `multipart/related; boundary=${multipart.boundary}`,
      },
      body: multipart.body,
    }, { interactive });
    return response.json();
  }

  async #request(url, init = {}, {
    interactive = false,
    acceptedStatuses = [],
  } = {}) {
    const token = await this.tokenManager.getAccessToken({ interactive });
    let response;
    try {
      response = await this.fetchImpl(String(url), {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      throw new CloudProviderError(
        'Google Drive network request failed.',
        {
          code: CLOUD_ERROR_CODE.NETWORK,
          retryable: true,
          cause: error,
        },
      );
    }

    if (response.ok || acceptedStatuses.includes(response.status)) return response;

    const payload = await readErrorPayload(response);
    const code = responseErrorCode(response.status, payload);
    if (code === CLOUD_ERROR_CODE.AUTH_REQUIRED) {
      this.tokenManager.clearAccessToken();
    }

    throw new CloudProviderError(
      payload?.error?.message || payload?.message || `Google Drive request failed with HTTP ${response.status}.`,
      {
        code,
        status: response.status,
        retryable: isRetryableStatus(response.status, payload),
        details: payload,
      },
    );
  }
}

export function createGoogleDriveProvider(options) {
  return assertCloudProvider(new GoogleDriveAppDataProvider(options));
}

export { escapeDriveQueryLiteral, normalizeAppProperties };
