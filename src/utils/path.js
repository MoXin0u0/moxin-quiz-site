export function normalizePackagePath(input) {
  const raw = String(input ?? '').replace(/\\/g, '/').trim();
  if (!raw) throw new Error('Empty package path is not allowed.');
  if (raw.includes('\0')) throw new Error('NUL byte is not allowed in package paths.');
  if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) {
    throw new Error(`Absolute path is not allowed: ${raw}`);
  }

  const segments = raw.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Unsafe package path: ${raw}`);
  }

  return segments.join('/');
}

export function stripCommonRoot(paths) {
  const normalized = paths.map(normalizePackagePath);
  if (normalized.includes('manifest.json') || normalized.includes('questions.json')) {
    return new Map(normalized.map(path => [path, path]));
  }

  const firstSegments = new Set(normalized.map(path => path.split('/')[0]));
  if (firstSegments.size !== 1) {
    return new Map(normalized.map(path => [path, path]));
  }

  const root = [...firstSegments][0];
  const prefix = `${root}/`;
  const stripped = normalized.map(path => path.startsWith(prefix) ? path.slice(prefix.length) : path);
  if (!stripped.includes('manifest.json') || !stripped.includes('questions.json')) {
    return new Map(normalized.map(path => [path, path]));
  }

  return new Map(normalized.map((path, index) => [path, stripped[index]]));
}

export function extensionOf(path) {
  const name = String(path).split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
