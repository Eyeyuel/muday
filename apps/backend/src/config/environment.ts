import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ROLE: z.enum(['api', 'worker', 'bot', 'telegram-sync']).default('api'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    PUBLIC_API_URL: z.url().default('http://localhost:3001'),
    MINIAPP_URL: z.url().default('http://localhost:5173'),
    FLUTTER_DEEP_LINK_BASE: z.url().default('http://localhost:5174'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SWAGGER_ENABLED: booleanFromString.default(true),
    SWAGGER_PATH: z
      .string()
      .regex(/^[a-z0-9][a-z0-9/_-]*$/i)
      .default('docs'),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://mezgeb:mezgeb_local_password@localhost:5432/mezgeb?schema=public'),
    REDIS_URL: z.url().default('redis://localhost:6379'),
    TELEGRAM_BOT_TOKEN: z.string().default(''),
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{16,256}$/)
      .default('local_development_secret'),
    TELEGRAM_WEBHOOK_PATH: z.literal('/webhook/telegram').default('/webhook/telegram'),
    STT_PROVIDER: z.enum(['fake', 'hasab', 'local', 'remote', 'addisai']).default('fake'),
    STT_MODEL: z.string().default('fake'),
    STT_LOCAL_COMMAND_OR_URL: z.string().default(''),
    STT_MODEL_PATH: z.string().default('.local/models'),
    ADDISAI_API_KEY: z.string().default(''),
    ADDISAI_BASE_URL: z.url().default('https://api.addisassistant.com/api'),
    ADDISAI_TIMEOUT_MS: z.coerce.number().int().positive().max(180_000).default(60_000),
    ADDISAI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    ADDISAI_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().max(10_000).default(250),
    ADDISAI_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(5_000_000)
      .default(1_000_000),
    ADDISAI_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().max(100_000).default(100),
    ADDISAI_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
    ADDISAI_CIRCUIT_COOLDOWN_SECONDS: z.coerce.number().int().positive().max(86_400).default(300),
    HASAB_API_KEY: z.string().default(''),
    HASAB_BASE_URL: z.url().default('https://api.hasab.ai/api'),
    HASAB_TIMEOUT_MS: z.coerce.number().int().positive().max(180_000).default(60_000),
    HASAB_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    HASAB_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().max(10_000).default(250),
    HASAB_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().max(5_000_000).default(1_000_000),
    HASAB_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().max(100_000).default(100),
    HASAB_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
    HASAB_CIRCUIT_COOLDOWN_SECONDS: z.coerce.number().int().positive().max(86_400).default(300),
    FFMPEG_PATH: z.string().min(1).default('/usr/bin/ffmpeg'),
    FFPROBE_PATH: z.string().min(1).default('/usr/bin/ffprobe'),
    VOICE_TEMP_DIR: z.string().min(1).default('.local/tmp/voice'),
    VOICE_QUEUE_NAME: z.string().min(1).default('mezgeb-voice'),
    RECEIPT_TEMP_DIR: z.string().min(1).default('.local/tmp/receipt'),
    RECEIPT_QUEUE_NAME: z.string().min(1).default('mezgeb-receipts'),
    NOTIFICATION_QUEUE_NAME: z.string().min(1).default('mezgeb-notifications'),
    SMS_QUEUE_NAME: z.string().min(1).default('mezgeb-sms'),
    FAKE_STT_TRANSCRIPT: z.string().default('I spent 250 birr on lunch'),
    EXTRACTION_PROVIDER: z.enum(['fake', 'rule', 'local', 'remote', 'gemini']).default('rule'),
    EXTRACTION_MODEL: z.string().default('fake'),
    EXTRACTION_PROMPT_VERSION: z.string().min(1).default('v1'),
    EXTRACTION_LOCAL_BASE_URL: z.url().default('http://localhost:11434/v1'),
    VOICE_EXTRACTION_MODE: z.enum(['direct', 'stt_then_extract']).default('stt_then_extract'),
    GEMINI_API_KEY: z.string().default(''),
    GEMINI_MODEL: z.string().min(1).default('gemini-3.6-flash'),
    GEMINI_AUDIO_MODEL: z.string().min(1).optional(),
    GEMINI_BASE_URL: z.url().default('https://generativelanguage.googleapis.com/v1beta'),
    GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().max(180_000).default(60_000),
    GEMINI_AUDIO_DEBUG_LOG: booleanFromString.default(false),
    GEMINI_AUDIO_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    GEMINI_MAX_INLINE_AUDIO_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(15_000_000)
      .default(12_000_000),
    ALLOW_LOCAL_DEV_AUTH: booleanFromString,
    LOCAL_DEV_TELEGRAM_ID: z.coerce.bigint().positive().default(100000001n),
    CONSENT_VERSION: z.string().min(1).default('2026-08-voice-v1'),
    DELETION_POLICY_VERSION: z.string().min(1).max(20).default('1.0'),
    MINIAPP_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(3600),
    ADMIN_JWT_SECRET: z.string().min(32).default('fallback_admin_jwt_secret_32_chars_long!'),
    DASHBOARD_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().max(300).default(30),

    DASHBOARD_EVENT_DEDUP_SECONDS: z.coerce.number().int().positive().default(900),
    MAX_VOICE_DURATION_SECONDS: z.coerce.number().int().positive().max(600).default(120),
    MAX_VOICE_FILE_BYTES: z.coerce.number().int().positive().default(20_000_000),
    VOICE_AUDIO_SAMPLE_RATE: z.coerce.number().int().positive().max(48000).default(24000),
    MAX_RECEIPT_FILE_BYTES: z.coerce.number().int().positive().max(20_000_000).default(10_000_000),
    MAX_MESSAGE_CHARACTERS: z.coerce.number().int().positive().default(2000),
    MAX_TRANSACTIONS_PER_MESSAGE: z.coerce.number().int().min(1).max(50).default(10),

    CUSTOMER_AUTH_ENABLED: booleanFromString.default(true),
    CUSTOMER_JWT_SECRET: z.string().min(32).default('fallback_customer_jwt_secret_32_chars_long!'),
    CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

    APP_CODE_PEPPER: z.string().min(32).default('fallback_app_code_pepper_min32chars_long!'),
    APP_CODE_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().max(100).default(5),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.APP_CODE_PEPPER === 'fallback_app_code_pepper_min32chars_long!'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['APP_CODE_PEPPER'],
        message: 'Production requires a real APP_CODE_PEPPER secret (min 32 chars)',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.CUSTOMER_JWT_SECRET === 'fallback_customer_jwt_secret_32_chars_long!'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CUSTOMER_JWT_SECRET'],
        message: 'Production requires an independent CUSTOMER_JWT_SECRET',
      });
    }
    if (environment.NODE_ENV !== 'development' && environment.ALLOW_LOCAL_DEV_AUTH) {
      context.addIssue({
        code: 'custom',
        path: ['ALLOW_LOCAL_DEV_AUTH'],
        message: 'Local development authentication is forbidden outside development',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.ADMIN_JWT_SECRET === 'fallback_admin_jwt_secret_32_chars_long!'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['ADMIN_JWT_SECRET'],
        message: 'Production requires an independent ADMIN_JWT_SECRET',
      });
    }
    if (environment.STT_PROVIDER === 'hasab' && environment.HASAB_API_KEY.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['HASAB_API_KEY'],
        message: 'HASAB_API_KEY is required when STT_PROVIDER=hasab',
      });
    }
    if (environment.STT_PROVIDER === 'addisai' && environment.ADDISAI_API_KEY.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['ADDISAI_API_KEY'],
        message: 'ADDISAI_API_KEY is required when STT_PROVIDER=addisai',
      });
    }
    if (
      (environment.EXTRACTION_PROVIDER === 'gemini' ||
        environment.VOICE_EXTRACTION_MODE === 'direct') &&
      environment.GEMINI_API_KEY.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required for Gemini extraction or direct voice mode',
      });
    }
    if (
      environment.VOICE_EXTRACTION_MODE === 'direct' &&
      environment.EXTRACTION_PROVIDER !== 'gemini'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['VOICE_EXTRACTION_MODE'],
        message: 'Direct voice extraction currently requires EXTRACTION_PROVIDER=gemini',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
