import { APP_CONFIG } from '../../app/config.js';
import {
  CLOUD_ERROR_CODE,
  CloudProviderError,
} from '../provider.js';
import { loadGoogleIdentityServices } from './gis-loader.js';

const EXPIRY_SKEW_MS = 30 * 1000;

function normalizeExpiresIn(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export class GoogleDriveTokenManager {
  constructor({
    clientId = APP_CONFIG.cloud.googleClientId,
    scope = APP_CONFIG.cloud.googleDriveScope,
    loader = loadGoogleIdentityServices,
    now = () => Date.now(),
  } = {}) {
    this.clientId = String(clientId || '').trim();
    this.scope = String(scope || '').trim();
    this.loader = loader;
    this.now = now;
    this.accessToken = null;
    this.expiresAt = 0;
    this.tokenResponse = null;
    this.pendingRequest = null;
  }

  isConfigured() {
    return Boolean(this.clientId && this.scope);
  }

  getTokenState() {
    return {
      configured: this.isConfigured(),
      hasToken: Boolean(this.peekAccessToken()),
      expiresAt: this.expiresAt || null,
      scope: this.tokenResponse?.scope || this.scope || null,
    };
  }

  peekAccessToken({ skewMs = EXPIRY_SKEW_MS } = {}) {
    if (!this.accessToken) return null;
    if (!this.expiresAt) return this.accessToken;
    if (this.now() + Math.max(0, Number(skewMs) || 0) >= this.expiresAt) return null;
    return this.accessToken;
  }

  clearAccessToken() {
    this.accessToken = null;
    this.expiresAt = 0;
    this.tokenResponse = null;
  }

  async getAccessToken({ interactive = false, prompt = '' } = {}) {
    const cached = this.peekAccessToken();
    if (cached) return cached;

    if (!interactive) {
      throw new CloudProviderError(
        'Google authorization is required.',
        { code: CLOUD_ERROR_CODE.AUTH_REQUIRED },
      );
    }

    return this.requestAccessToken({ prompt });
  }

  requestAccessToken({ prompt = '' } = {}) {
    if (!this.isConfigured()) {
      return Promise.reject(new CloudProviderError(
        'Google OAuth client ID is not configured.',
        { code: CLOUD_ERROR_CODE.CONFIG_REQUIRED },
      ));
    }
    if (this.pendingRequest) return this.pendingRequest;

    const request = (async () => {
      const google = await this.loader();
      const oauth2 = google?.accounts?.oauth2;
      if (!oauth2?.initTokenClient) {
        throw new CloudProviderError(
          'Google OAuth token client is unavailable.',
          { code: CLOUD_ERROR_CODE.UNSUPPORTED },
        );
      }

      return new Promise((resolve, reject) => {
        const rejectAuth = error => {
          reject(new CloudProviderError(
            error?.type === 'popup_closed'
              ? 'Google authorization was cancelled.'
              : 'Google authorization could not be completed.',
            {
              code: error?.type === 'popup_closed'
                ? CLOUD_ERROR_CODE.AUTH_CANCELLED
                : CLOUD_ERROR_CODE.AUTH_REQUIRED,
              details: error || null,
            },
          ));
        };

        const client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.scope,
          include_granted_scopes: true,
          callback: response => {
            if (!response || response.error || !response.access_token) {
              reject(new CloudProviderError(
                response?.error_description || response?.error || 'Google did not return an access token.',
                {
                  code: CLOUD_ERROR_CODE.AUTH_REQUIRED,
                  details: response || null,
                },
              ));
              return;
            }

            const expiresIn = normalizeExpiresIn(response.expires_in);
            this.accessToken = response.access_token;
            this.expiresAt = expiresIn ? this.now() + expiresIn * 1000 : 0;
            this.tokenResponse = { ...response };
            resolve(this.accessToken);
          },
          error_callback: rejectAuth,
        });

        try {
          client.requestAccessToken({ prompt: String(prompt || '') });
        } catch (error) {
          reject(new CloudProviderError(
            'Failed to start Google authorization.',
            {
              code: CLOUD_ERROR_CODE.AUTH_REQUIRED,
              cause: error,
            },
          ));
        }
      });
    })();

    this.pendingRequest = request.finally(() => {
      this.pendingRequest = null;
    });
    return this.pendingRequest;
  }

  async revokeCurrentAccess() {
    const token = this.peekAccessToken({ skewMs: 0 });
    if (!token) {
      this.clearAccessToken();
      return { successful: false, reason: 'no-active-token' };
    }

    const google = await this.loader();
    const revoke = google?.accounts?.oauth2?.revoke;
    if (typeof revoke !== 'function') {
      throw new CloudProviderError(
        'Google revoke API is unavailable.',
        { code: CLOUD_ERROR_CODE.UNSUPPORTED },
      );
    }

    const result = await new Promise((resolve, reject) => {
      try {
        revoke(token, response => resolve(response || { successful: true }));
      } catch (error) {
        reject(new CloudProviderError(
          'Failed to revoke Google authorization.',
          { code: CLOUD_ERROR_CODE.NETWORK, retryable: true, cause: error },
        ));
      }
    });

    this.clearAccessToken();
    return result;
  }
}

export function createGoogleDriveTokenManager(options) {
  return new GoogleDriveTokenManager(options);
}
