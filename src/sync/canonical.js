function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) return null;
  return Object.is(value, -0) ? 0 : value;
}

export function canonicalize(value, { omitKeys = [] } = {}) {
  const omitted = new Set(omitKeys.map(String));
  const seen = new WeakSet();

  function visit(input, inArray = false) {
    if (input === null) return null;

    const type = typeof input;
    if (type === 'string' || type === 'boolean') return input;
    if (type === 'number') return normalizeNumber(input);
    if (type === 'bigint') throw new TypeError('BigInt is not JSON-compatible.');
    if (type === 'undefined' || type === 'function' || type === 'symbol') {
      return inArray ? null : undefined;
    }

    if (input instanceof Date) return input.toJSON();

    if (Array.isArray(input)) {
      if (seen.has(input)) throw new TypeError('Cannot canonicalize cyclic data.');
      seen.add(input);
      const output = input.map(item => visit(item, true));
      seen.delete(input);
      return output;
    }

    if (!isPlainObject(input)) {
      if (typeof input.toJSON === 'function') return visit(input.toJSON(), inArray);
      throw new TypeError('Canonical JSON only supports JSON-compatible plain objects and arrays.');
    }

    if (seen.has(input)) throw new TypeError('Cannot canonicalize cyclic data.');
    seen.add(input);

    const output = {};
    for (const key of Object.keys(input).sort()) {
      if (omitted.has(key)) continue;
      const normalized = visit(input[key], false);
      if (normalized !== undefined) output[key] = normalized;
    }

    seen.delete(input);
    return output;
  }

  return visit(value, false);
}

export function canonicalJson(value, options) {
  const normalized = canonicalize(value, options);
  if (normalized === undefined) return undefined;
  return JSON.stringify(normalized);
}
