const UTC_ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function normalizeUtcIsoDate(value) {
  if (typeof value !== 'string' || !UTC_ISO_DATE_PATTERN.test(value)) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const comparableValue = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return date.toISOString() === comparableValue ? value : null;
}
