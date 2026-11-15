const redactedValue = '[REDACTED]';

const sensitiveKeys = new Set([
  'amount',
  'amountetb',
  'anthropicapikey',
  'apikey',
  'authorization',
  'bot_token',
  'bottoken',
  'cookie',
  'databaseurl',
  'initdata',
  'message',
  'messagetext',
  'note',
  'password',
  'rawtranscript',
  'redisurl',
  'secret',
  'telegrambottoken',
  'telegramwebhooksecret',
  'text',
  'token',
  'transcript',
  'voice',
]);

function normalizeKey(key: string): string {
  return key.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function redactText(value: string): string {
  return value
    .replaceAll(/\b\d{6,12}:[a-zA-Z0-9_-]{20,}\b/g, redactedValue)
    .replaceAll(
      /\b(authorization|token|secret|password|initdata|transcript|note|amount)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    );
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MAX_DEPTH]';
  }

  if (typeof value === 'string') {
    return redactText(value);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeys.has(normalizeKey(key)) ? redactedValue : redactValue(item, depth + 1),
    ]),
  );
}
