import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import { NavigationMenuService } from '../src/onboarding/navigation-menu.service.js';

const createService = (miniAppUrl: string) =>
  new NavigationMenuService(
    { get: () => miniAppUrl } as unknown as ConfigService<Environment, true>,
    new I18nService(),
  );

describe('NavigationMenuService', () => {
  it('builds localized navigation callbacks and omits an unusable local dashboard URL', () => {
    const keyboard = createService('http://localhost:5173').keyboard('en');
    expect(keyboard.flat().map((button) => button.text)).toContain('📊 Today');
    expect(
      keyboard.flat().map((button) => ('callbackData' in button ? button.callbackData : undefined)),
    ).toContain('nav:settings');
    expect(keyboard.flat().some((button) => 'webAppUrl' in button)).toBe(false);
  });

  it('omits webAppUrl buttons from navigation menus for public HTTPS URLs', () => {
    const keyboard = createService('https://muday.example.com').keyboard('am');
    expect(keyboard.flat().some((button) => 'webAppUrl' in button)).toBe(false);
    expect(keyboard.flat().map((button) => button.text)).toContain('📊 ዛሬ');
  });

  it('strictly parses only supported navigation callbacks', () => {
    expect(NavigationMenuService.parseCallback('nav:today')).toBe('today');
    expect(NavigationMenuService.parseCallback('nav:today:extra')).toBeNull();
    expect(NavigationMenuService.parseCallback('nav:delete')).toBeNull();
  });
});
