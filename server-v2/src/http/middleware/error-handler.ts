import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../errors/app-error.ts';
import type { Logger } from '../../logging/logger.ts';

/**
 * Текст непредвиденной ошибки в ответ не попадает — он уходит в лог. Найти его
 * можно по requestId, который клиент получает в заголовке x-request-id.
 */

const INTERNAL_MESSAGE = 'Internal server error';

type ErrorResponse = {
    status: number;
    message: string;
    level: 'warn' | 'error';
};

export class ErrorHandler {
    readonly #logger: Logger;

    constructor(logger: Logger) {
        this.#logger = logger;
    }

    /**
     * Четыре параметра обязательны: по их количеству express отличает
     * обработчик ошибок от обычного middleware.
     */
    readonly respond = (error: unknown, req: Request, res: Response, next: NextFunction): void => {
        // req.log ставит RequestContext. Запасной вариант нужен на случай,
        // если ошибка возникла до него.
        const log = req.log ?? this.#logger;

        const { status, message, level } = ErrorHandler.#describe(error);
        const where = { status, method: req.method, url: req.originalUrl };

        if (level === 'error') {
            // pino разложит Error на type, message и stack сам.
            log.error({ ...where, err: ErrorHandler.#serialize(error) }, 'request failed');
        } else {
            // Отказ по правилам приложения — ожидаемое событие. Стек не пишем:
            // он указывает на наш же middleware и ничего не объясняет.
            log.warn({ ...where, reason: message }, 'request rejected');
        }

        // Если заголовки уже ушли клиенту, второй ответ отправить нельзя.
        // Передаём ошибку встроенному обработчику express — он разорвёт соединение.
        if (res.headersSent) {
            next(error);
            return;
        }

        res.status(status).json({ error: true, message });
    };

    static #describe(error: unknown): ErrorResponse {
        if (error instanceof AppError) {
            return { status: error.status, message: error.message, level: 'warn' };
        }

        // express.json() бросает ошибку пакета http-errors: у неё есть status
        // и expose: true, означающее «текст можно показать клиенту». Так сюда
        // приходит битый JSON в теле запроса.
        const exposed = ErrorHandler.#exposedHttpError(error);
        if (exposed) {
            return { ...exposed, level: 'warn' };
        }

        return { status: 500, message: INTERNAL_MESSAGE, level: 'error' };
    }

    static #exposedHttpError(error: unknown): { status: number; message: string } | undefined {
        if (typeof error !== 'object' || error === null) {
            return undefined;
        }

        const candidate = error as { status?: unknown; statusCode?: unknown; expose?: unknown; message?: unknown };

        if (candidate.expose !== true) {
            return undefined;
        }

        const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
        if (typeof status !== 'number' || status < 400 || status > 499) {
            return undefined;
        }

        const message = typeof candidate.message === 'string' && candidate.message.length > 0
            ? candidate.message
            : 'Bad request';

        return { status, message };
    }

    /**
     * Бросить в JS можно любое значение, не только Error. Error отдаётся
     * логгеру как есть — pino разложит его на type, message и stack.
     * Остальное заворачивается в объект, чтобы значение не потерялось.
     */
    static #serialize(error: unknown): unknown {
        if (error instanceof Error) {
            return error;
        }

        return { value: typeof error === 'object' ? JSON.stringify(error) : String(error) };
    }
}
