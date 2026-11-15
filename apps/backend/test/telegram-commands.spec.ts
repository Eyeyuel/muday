import { describe, expect, it } from 'vitest';

import {
  TELEGRAM_COMMANDS,
  TELEGRAM_COMMANDS_AM,
  TELEGRAM_PROFILE,
} from '../src/telegram/transport/grammy-transport.js';

describe('Telegram command menu', () => {
  it('registers every implemented user command exactly once', () => {
    const commands = TELEGRAM_COMMANDS.map(({ command }) => command);
    expect(commands).toEqual([
      'start',
      'summary',
      'today',
      'week',
      'month',
      'banks',
      'pending',
      'settings',
      'deletemydata',
      'language',
      'undo',
      'help',
      'mycode',
    ]);
    expect(new Set(commands).size).toBe(commands.length);
  });

  it('uses Telegram-compatible names and descriptions', () => {
    for (const item of TELEGRAM_COMMANDS) {
      expect(item.command).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.description.length).toBeLessThanOrEqual(256);
    }
  });

  it('provides Telegram-compatible localized pre-start profile descriptions', () => {
    for (const profile of Object.values(TELEGRAM_PROFILE)) {
      expect(profile.description.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeLessThanOrEqual(512);
      expect(profile.shortDescription.length).toBeGreaterThan(0);
      expect(profile.shortDescription.length).toBeLessThanOrEqual(120);
    }
    expect(TELEGRAM_PROFILE.en.description).toContain('receipt photo');
    expect(TELEGRAM_PROFILE.en.description).toContain('dashboard');
    expect(TELEGRAM_PROFILE.am.description).toContain('ደረሰኝ');
    expect(TELEGRAM_PROFILE.en.description).toBe(TELEGRAM_PROFILE.am.description);
    expect(TELEGRAM_PROFILE.en.shortDescription).toBe(TELEGRAM_PROFILE.am.shortDescription);
  });

  it('registers the same command names in Amharic and English', () => {
    expect(TELEGRAM_COMMANDS_AM.map(({ command }) => command)).toEqual(
      TELEGRAM_COMMANDS.map(({ command }) => command),
    );
    for (const item of TELEGRAM_COMMANDS_AM) {
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.description.length).toBeLessThanOrEqual(256);
    }
  });
});
