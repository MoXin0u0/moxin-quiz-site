import { extensionOf } from './path.js';

const MIME_BY_EXTENSION = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  json: 'application/json',
});

export function mimeTypeForPath(path) {
  return MIME_BY_EXTENSION[extensionOf(path)] || 'application/octet-stream';
}
