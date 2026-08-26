import type { Writable } from 'node:stream';

import { pino, type Logger as PinoLogger, type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';

import type { Config } from '../config/config.ts';

/**
 * Обёртка над pino. Наружу отдаёт четыре метода уровней и child().
 * Настройки формата и уровня задаются один раз здесь, в остальных модулях
 * pino не импортируется.
 *
 * Какой уровень когда использовать:
 *   error — непредвиденный сбой
 *   warn  — отказ по правилам приложения: 401, 403, 409, 422
 *   info  — событие бизнес-логики: пользователь зарегистрирован, сервер поднялся
 *   debug — детали выполнения приложения
 */

/** Поля записи. Всё, кроме текста сообщения, передаётся через этот объект. */
export type LogFields = Record<string, unknown>;

type LevelName = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
    readonly #pino: PinoLogger;

    /**
     * @param destination куда писать. process.stdout по умолчанию; тесты
     *   передают сюда свой Writable, накапливающий записи в памяти.
     */
    static create(config: Config, destination: Writable = process.stdout): Logger {
        return new Logger(pino(
            Logger.#options(config),
            config.isDevelopment ? Logger.#prettyStream(destination) : destination,
        ));
    }

    static #options(config: Config): LoggerOptions {
        const options: LoggerOptions = { level: config.logLevel };

        if (!config.isDevelopment) {
            // По умолчанию pino пишет уровень числом: 30 вместо "info".
            // В NDJSON нужна строка — по ней фильтруют grep и jq.
            // В development форматтер не ставится: pino-pretty читает
            // именно число, чтобы выбрать цвет и подпись уровня.
            options.formatters = { level: (label) => ({ level: label }) };
        }

        return options;
    }

    static #prettyStream(destination: Writable): Writable {
        return pretty({
            destination,
            translateTime: 'HH:MM:ss.l',
            // pid и hostname нужны при сборе логов с нескольких процессов.
            // При локальном запуске процесс один, поэтому в dev они убраны.
            ignore: 'pid,hostname',
        });
    }

    constructor(instance: PinoLogger) {
        this.#pino = instance;
    }

    /**
     * Новый Logger, который добавляет переданные поля в каждую свою запись.
     * Исходный объект не меняется: его записи этих полей не получают.
     */
    child(fields: LogFields): Logger {
        return new Logger(this.#pino.child(fields));
    }

    error(fields: LogFields, message: string): void;
    error(message: string): void;
    error(first: LogFields | string, second?: string): void {
        this.#write('error', first, second);
    }

    warn(fields: LogFields, message: string): void;
    warn(message: string): void;
    warn(first: LogFields | string, second?: string): void {
        this.#write('warn', first, second);
    }

    info(fields: LogFields, message: string): void;
    info(message: string): void;
    info(first: LogFields | string, second?: string): void {
        this.#write('info', first, second);
    }

    debug(fields: LogFields, message: string): void;
    debug(message: string): void;
    debug(first: LogFields | string, second?: string): void {
        this.#write('debug', first, second);
    }

    #write(level: LevelName, first: LogFields | string, second?: string): void {
        if (typeof first === 'string') {
            this.#pino[level](first);
            return;
        }

        this.#pino[level](first, second);
    }
}
