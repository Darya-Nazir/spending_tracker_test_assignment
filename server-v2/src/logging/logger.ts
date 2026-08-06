import type { Writable } from 'node:stream';

import { pino, type Logger as PinoLogger, type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';

import type { Config } from '../config/config.ts';

/**
 * Единственная точка, откуда приложение пишет логи.
 *
 * Наружу отдаётся не сам pino, а узкий фасад из четырёх уровней. Смысл —
 * в том, чтобы решения о формате (NDJSON против pretty), об уровнях и о том,
 * куда всё это уходит, принимались здесь, а не переоткрывались в каждом модуле.
 *
 * Уровни по проекту:
 *   error — сломалось, нужен человек
 *   warn  — отказ по правилам: 401, 403, 422, конфликт
 *   info  — факты бизнес-логики: пользователь зарегистрирован, сервер поднялся
 *   debug — SQL и прочая механика; на проде отсечена порогом LOG_LEVEL
 */

/** Структурированные поля записи. Всё, что не сообщение, идёт сюда. */
export type LogFields = Record<string, unknown>;

type LevelName = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
    readonly #pino: PinoLogger;

    /**
     * @param destination по умолчанию process.stdout — тоже Writable, так что
     *   для логгера подставленный в тестах сток неотличим от настоящего вывода.
     *   Ветки «а если мы в тесте» здесь нет.
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
            // Уровень строковой меткой, а не числом: NDJSON читают и grep, и jq,
            // и ни тому, ни другому не должно приходиться помнить, что 30 — это info.
            // В dev это не нужно: pino-pretty подписывает уровень сам, и число
            // ему нужно нетронутым, чтобы выбрать цвет.
            options.formatters = { level: (label) => ({ level: label }) };
        }

        return options;
    }

    static #prettyStream(destination: Writable): Writable {
        return pretty({
            destination,
            translateTime: 'HH:MM:ss.l',
            // pid и hostname полезны в агрегаторе логов и бесполезны в терминале,
            // где процесс ровно один и он перед глазами.
            ignore: 'pid,hostname',
        });
    }

    constructor(instance: PinoLogger) {
        this.#pino = instance;
    }

    /**
     * Логгер, который проставляет переданные поля в каждую свою запись.
     * Возвращается новый объект — родитель о полях потомка не знает.
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
