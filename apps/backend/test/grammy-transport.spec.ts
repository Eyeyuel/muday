import { describe, expect, it, vi } from 'vitest';

import { GrammyTelegramTransport } from '../src/telegram/transport/grammy-transport.js';

describe('GrammyTelegramTransport', () => {
  const createTransport = () => {
    const config = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
        return undefined;
      }),
    };
    const logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    const profileSync = { sync: vi.fn() };
    const transport = new GrammyTelegramTransport(
      config as never,
      logger as never,
      profileSync as never,
    );
    const sendMessageMock = vi.fn().mockResolvedValue({});
    (
      transport as unknown as { bot: { api: { sendMessage: typeof sendMessageMock } } }
    ).bot.api.sendMessage = sendMessageMock;
    return { transport, sendMessageMock };
  };

  it('maps a url button correctly in inlineKeyboard and passes parse_mode to Grammy API', async () => {
    const { transport, sendMessageMock } = createTransport();

    await transport.sendMessage(12345, 'Your code is ready', {
      parseMode: 'HTML',
      inlineKeyboard: [
        [
          { text: '🚀 Open Muday App', url: 'https://app.muday.et/auth?code=aB3kX9' },
          { text: 'Help', callbackData: 'help:general' },
          { text: 'Mini App', webAppUrl: 'https://miniapp.muday.et' },
        ],
      ],
    });

    expect(sendMessageMock).toHaveBeenCalledWith(12345, 'Your code is ready', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 Open Muday App', url: 'https://app.muday.et/auth?code=aB3kX9' },
            { text: 'Help', callback_data: 'help:general' },
            { text: 'Mini App', web_app: { url: 'https://miniapp.muday.et' } },
          ],
        ],
      },
    });
  });

  it('sends message without parse_mode or reply_markup when not provided', async () => {
    const { transport, sendMessageMock } = createTransport();

    await transport.sendMessage(12345, 'Plain text message');

    expect(sendMessageMock).toHaveBeenCalledWith(12345, 'Plain text message', {});
  });
});
