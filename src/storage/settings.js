const SETTINGS_KEY = 'moxin.v3.settings';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  fontScale: 'normal',
  optionSpacing: 'normal',
  reduceMotion: false,
});

const VALID_THEMES = new Set(['system', 'light', 'dark']);
const VALID_FONT_SCALES = new Set(['normal', 'large', 'x-large']);
const VALID_OPTION_SPACING = new Set(['compact', 'normal', 'comfortable']);

export function normalizeSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    theme: VALID_THEMES.has(source.theme) ? source.theme : DEFAULT_SETTINGS.theme,
    fontScale: VALID_FONT_SCALES.has(source.fontScale)
      ? source.fontScale
      : DEFAULT_SETTINGS.fontScale,
    optionSpacing: VALID_OPTION_SPACING.has(source.optionSpacing)
      ? source.optionSpacing
      : DEFAULT_SETTINGS.optionSpacing,
    reduceMotion: source.reduceMotion === true,
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to read settings; using defaults.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS };
}
