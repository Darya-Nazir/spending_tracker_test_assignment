import { z } from 'zod';

/**
 * Единственное место, где читается и проверяется окружение.
 *
 * Смысл — падать на старте, а не в проде: все переменные, которые
 * приложению нужны, проверяются здесь один раз, и процесс отказывается
 * подниматься, выдав читаемый список всего, что не так.
 *
 * Схема растёт вместе с приложением: переменная добавляется в тот этап,
 * который её впервые использует, а не заранее. Ниже закомментированы те,
 * что уже спроектированы, но пока никем не читаются — у каждой указан этап,
 * который её вернёт.
 */

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

// --- этап 4 (Postgres + Database) ---
// const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\/.+/;

// --- этап 4 (CORS) ---
// const HTTP_URL_PATTERN = /^https?:\/\/[^\s/]+/;

// --- этап 13 (минимальная аутентификация) ---
// const TTL_PATTERN = /^\d+[smhd]$/;
//
// const ttl = (name: string, fallback: string) => z
//     .string()
//     .regex(TTL_PATTERN, `${name} must look like 15m, 2h, 1d or 30s`)
//     .default(fallback);

// --- этап 19 (фильтры периода) ---
// const isKnownTimezone = (value: string): boolean => {
//     try {
//         new Intl.DateTimeFormat('en-US', { timeZone: value });
//         return true;
//     } catch {
//         return false;
//     }
// };

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    PORT: z.coerce
        .number()
        .int('PORT must be a whole number')
        .min(1, 'PORT must be between 1 and 65535')
        .max(65535, 'PORT must be between 1 and 65535')
        .default(3000),

    LOG_LEVEL: z
        .enum(LOG_LEVELS, `LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`)
        .default('info'),

    // --- этап 4 (Postgres + Database) ---
    // DATABASE_URL: z
    //     .string()
    //     .regex(
    //         POSTGRES_URL_PATTERN,
    //         'DATABASE_URL must be a postgres:// or postgresql:// connection string',
    //     ),

    // --- этап 4 (CORS): webpack dev server, на котором крутится клиент ---
    // CORS_ORIGIN: z
    //     .string()
    //     .regex(HTTP_URL_PATTERN, 'CORS_ORIGIN must be an http(s) URL, including the scheme')
    //     .default('http://localhost:9000'),

    // --- этап 11 (сервис паролей) ---
    // Старый сервер вызывал bcrypt.genSalt(Number('example')) — то есть genSalt(NaN).
    // Целое число не меньше 10 делает такую ошибку невыразимой в принципе.
    // BCRYPT_COST: z.coerce
    //     .number()
    //     .int('BCRYPT_COST must be a whole number')
    //     .min(10, 'BCRYPT_COST must be at least 10')
    //     .max(31, 'BCRYPT_COST must be at most 31')
    //     .default(12),

    // --- этап 13 (минимальная аутентификация) ---
    // JWT_ACCESS_SECRET: z
    //     .string()
    //     .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    //
    // JWT_REFRESH_SECRET: z
    //     .string()
    //     .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    //
    // ACCESS_TTL: ttl('ACCESS_TTL', '15m'),
    // REFRESH_TTL: ttl('REFRESH_TTL', '1d'),
    // REFRESH_TTL_REMEMBER: ttl('REFRESH_TTL_REMEMBER', '30d'),

    // --- этап 19 (фильтры периода) ---
    // Таймзона, относительно которой считаются today/week/month/year.
    // APP_TZ: z
    //     .string()
    //     .refine(isKnownTimezone, 'APP_TZ must be a timezone this runtime knows, e.g. Asia/Almaty')
    //     .default('UTC'),
});

// --- этап 13 (минимальная аутентификация) ---
// Межполевая проверка навешивается на схему после z.object():
// .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
//     message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
//     path: ['JWT_REFRESH_SECRET'],
// });

/** Разобранное и проверенное окружение. Тип выводится из схемы, дублировать нечего. */
type ParsedEnv = z.infer<typeof envSchema>;

/** Сырое окружение: в process.env всё либо строка, либо undefined. */
export type RawEnv = Record<string, string | undefined>;

export type NodeEnv = ParsedEnv['NODE_ENV'];
export type LogLevel = ParsedEnv['LOG_LEVEL'];

export class Config {
    readonly nodeEnv: NodeEnv;
    readonly port: number;
    readonly logLevel: LogLevel;

    // Готовые булевы флаги вместо сравнения строк, разбросанного по всему коду.
    readonly isDevelopment: boolean;
    readonly isTest: boolean;
    readonly isProduction: boolean;

    // --- этап 4 ---
    // readonly databaseUrl: string;
    // readonly corsOrigin: string;

    // --- этап 11 ---
    // readonly bcryptCost: number;

    // --- этап 13 ---
    // readonly jwt: Readonly<{
    //     accessSecret: string;
    //     refreshSecret: string;
    //     accessTtl: string;
    //     refreshTtl: string;
    //     refreshTtlRemember: string;
    // }>;

    // --- этап 19 ---
    // readonly appTz: string;

    /**
     * @param env по умолчанию process.env; тесты передают окружение явно,
     *   чтобы не мутировать глобальное состояние.
     * @throws Error с перечислением всех недостающих и некорректных переменных сразу.
     */
    static load(env: RawEnv = process.env): Config {
        const result = envSchema.safeParse(env);

        if (!result.success) {
            throw new Error(Config.#describe(result.error));
        }

        return new Config(result.data);
    }

    static #describe(error: z.ZodError): string {
        const lines = error.issues.map((issue) => {
            const name = issue.path.join('.') || '(environment)';
            return `  - ${name}: ${issue.message}`;
        });

        return [
            'Invalid environment configuration:',
            ...lines,
            '',
            'See .env.example for the expected shape.',
        ].join('\n');
    }

    constructor(values: ParsedEnv) {
        this.nodeEnv = values.NODE_ENV;
        this.port = values.PORT;
        this.logLevel = values.LOG_LEVEL;

        // --- этап 4 ---
        // this.databaseUrl = values.DATABASE_URL;
        // this.corsOrigin = values.CORS_ORIGIN;

        // --- этап 11 ---
        // this.bcryptCost = values.BCRYPT_COST;

        // --- этап 13 ---
        // this.jwt = Object.freeze({
        //     accessSecret: values.JWT_ACCESS_SECRET,
        //     refreshSecret: values.JWT_REFRESH_SECRET,
        //     accessTtl: values.ACCESS_TTL,
        //     refreshTtl: values.REFRESH_TTL,
        //     refreshTtlRemember: values.REFRESH_TTL_REMEMBER,
        // });

        // --- этап 19 ---
        // this.appTz = values.APP_TZ;

        this.isDevelopment = this.nodeEnv === 'development';
        this.isTest = this.nodeEnv === 'test';
        this.isProduction = this.nodeEnv === 'production';

        // readonly защищает на этапе компиляции, Object.freeze — в рантайме.
        Object.freeze(this);
    }
}
