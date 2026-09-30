export const SCHEMA_VERSION = '2.0';

export const QUESTION_TYPES = Object.freeze({
  SINGLE_CHOICE: 'single-choice',
  MULTIPLE_CHOICE: 'multiple-choice',
  TRUE_FALSE: 'true-false',
  FILL_IN: 'fill-in',
});

export const SUPPORTED_QUESTION_TYPES = Object.freeze(
  Object.values(QUESTION_TYPES),
);

export const LEGACY_TYPE_MAP = Object.freeze({
  single_choice: QUESTION_TYPES.SINGLE_CHOICE,
  multiple_choice: QUESTION_TYPES.MULTIPLE_CHOICE,
  true_false: QUESTION_TYPES.TRUE_FALSE,
  fill_blank: QUESTION_TYPES.FILL_IN,
});

export const SAFE_IMAGE_EXTENSIONS = Object.freeze([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg',
]);

export function createManifest(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    language: 'zh-TW',
    questionCount: 0,
    createdAt: '',
    updatedAt: '',
    metadata: {},
    ...overrides,
  };
}

export function isSchemaV2Package(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.manifest?.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(value.questions),
  );
}
