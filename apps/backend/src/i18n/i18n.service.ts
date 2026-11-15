import { Injectable } from '@nestjs/common';

import { amCatalog } from './catalogs/am.js';
import { enCatalog } from './catalogs/en.js';
import type { MessageKey } from './message-key.js';

export type Locale = 'am' | 'en';

@Injectable()
export class I18nService {
  translate(
    key: MessageKey,
    locale: Locale = 'am',
    parameters: Record<string, string | number> = {},
  ): string {
    const catalog = locale === 'en' ? enCatalog : amCatalog;
    const template = catalog[key] ?? amCatalog[key] ?? amCatalog['error.generic'];

    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : match,
    );
  }
}
