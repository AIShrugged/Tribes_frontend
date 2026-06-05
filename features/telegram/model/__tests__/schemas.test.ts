import { addTelegramChatSchema } from '@/features/telegram/model/schemas';

describe('addTelegramChatSchema', () => {
  it('accepts positive and negative Telegram Chat IDs', () => {
    expect(
      addTelegramChatSchema.safeParse({ telegram_chat_id: 12_345 }).success,
    ).toBe(true);
    expect(
      addTelegramChatSchema.safeParse({ telegram_chat_id: -1_003_888_134_038 })
        .success,
    ).toBe(true);
  });

  it('rejects non-integer Telegram Chat IDs', () => {
    expect(
      addTelegramChatSchema.safeParse({ telegram_chat_id: 123.45 }).success,
    ).toBe(false);
  });
});
