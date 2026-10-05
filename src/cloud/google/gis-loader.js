import { APP_CONFIG } from '../../app/config.js';
import {
  CLOUD_ERROR_CODE,
  CloudProviderError,
} from '../provider.js';

const loaderPromises = new Map();

export function isGoogleIdentityServicesReady(target = globalThis) {
  return Boolean(target?.google?.accounts?.oauth2?.initTokenClient);
}

export function loadGoogleIdentityServices({
  scriptUrl = APP_CONFIG.cloud.googleIdentityScriptUrl,
  documentRef = globalThis.document,
  target = globalThis,
  timeoutMs = 15000,
} = {}) {
  if (isGoogleIdentityServicesReady(target)) {
    return Promise.resolve(target.google);
  }

  if (!documentRef?.createElement || !documentRef?.head) {
    return Promise.reject(new CloudProviderError(
      'Google Identity Services requires a browser document.',
      { code: CLOUD_ERROR_CODE.UNSUPPORTED },
    ));
  }

  const key = String(scriptUrl || '').trim();
  if (!key) {
    return Promise.reject(new CloudProviderError(
      'Google Identity Services script URL is not configured.',
      { code: CLOUD_ERROR_CODE.CONFIG_REQUIRED },
    ));
  }

  if (loaderPromises.has(key)) return loaderPromises.get(key);

  const promise = new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);

      if (error) {
        loaderPromises.delete(key);
        reject(error);
        return;
      }

      if (!isGoogleIdentityServicesReady(target)) {
        loaderPromises.delete(key);
        reject(new CloudProviderError(
          'Google Identity Services loaded without the OAuth API.',
          { code: CLOUD_ERROR_CODE.INVALID_RESPONSE },
        ));
        return;
      }

      resolve(target.google);
    };

    const existing = Array.from(documentRef.scripts || [])
      .find(script => script.src === key || script.dataset?.moxinGoogleIdentity === 'true');

    const script = existing || documentRef.createElement('script');
    script.addEventListener('load', () => finish(), { once: true });
    script.addEventListener('error', () => finish(new CloudProviderError(
      'Failed to load Google Identity Services.',
      { code: CLOUD_ERROR_CODE.NETWORK, retryable: true },
    )), { once: true });

    if (!existing) {
      script.src = key;
      script.async = true;
      script.defer = true;
      script.dataset.moxinGoogleIdentity = 'true';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      documentRef.head.appendChild(script);
    }

    timer = setTimeout(() => finish(new CloudProviderError(
      'Timed out while loading Google Identity Services.',
      { code: CLOUD_ERROR_CODE.NETWORK, retryable: true },
    )), Math.max(1000, Number(timeoutMs) || 15000));
  });

  loaderPromises.set(key, promise);
  return promise;
}
