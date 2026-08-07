import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import type { Logger } from '../../logging/logger.ts';

/**
 * Регистрируется первым в цепочке middleware. Делает две вещи.
 *
 * Первая: ставит на объект запроса два поля — requestId и log, child-логгер,
 * добавляющий этот requestId в каждую запись. Дальше по цепочке логируют через
 * req.log. Результат: все строки лога, относящиеся к одному HTTP-запросу,
 * содержат одно и то же значение requestId, и их можно отобрать одним grep.
 *
 * Вторая: пишет access-лог — по одной записи на каждый завершённый запрос.
 */

const REQUEST_ID_HEADER = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Допустимые символы входящего идентификатора. Значение заголовка приходит
 * от клиента и попадает в лог. Перевод строки в нём дал бы в NDJSON-выводе
 * лишнюю строку, которую разберёт JSON.parse, — то есть поддельную запись.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

declare global {
    namespace Express {
        interface Request {
            /** Идентификатор запроса: значение заголовка x-request-id или сгенерированный UUID. */
            requestId: string;
            /** Логгер с этим requestId в полях. */
            log: Logger;
        }
    }
}

export class RequestContext {
    readonly #logger: Logger;

    constructor(logger: Logger) {
        this.#logger = logger;
    }

    /** Поле со стрелочной функцией, а не метод: express вызывает обработчик без this. */
    readonly attach = (req: Request, res: Response, next: NextFunction): void => {
        const requestId = RequestContext.#resolveId(req.headers[REQUEST_ID_HEADER]);

        req.requestId = requestId;
        req.log = this.#logger.child({ requestId });

        // Тот же идентификатор в ответе: по нему клиент или тестировщик может
        // указать конкретный запрос, а мы найдём его строки в логе.
        res.setHeader(REQUEST_ID_HEADER, requestId);

        RequestContext.#logWhenFinished(req, res);

        next();
    };

    /**
     * Запись пишется после ответа, а не до обработки: статус и время известны
     * только к этому моменту. Уровень всегда info — сам факт запроса событие
     * нормальное; у отказов рядом лежит запись warn или error от ErrorHandler
     * с причиной, и связывает их общий requestId.
     *
     * Событие finish express-ответа наступает, когда ответ передан клиенту.
     * Оборванное соединение его не даёт, поэтому такой запрос в access-логе
     * не появится: пары «запрос — статус» для него не существует.
     */
    static #logWhenFinished(req: Request, res: Response): void {
        const startedAt = process.hrtime.bigint();

        res.on('finish', () => {
            req.log.info({
                // Порядок полей тот же, что у записей ErrorHandler: строки
                // об одном запросе читаются рядом.
                status: res.statusCode,
                method: req.method,
                url: req.originalUrl,
                durationMs: RequestContext.#elapsedMs(startedAt),
            }, 'request completed');
        });
    }

    /**
     * Монотонные часы, а не Date.now(): системное время может перескочить
     * назад при синхронизации и дать отрицательную длительность.
     */
    static #elapsedMs(startedAt: bigint): number {
        const elapsedNs = process.hrtime.bigint() - startedAt;

        // Наносекунды делятся до микросекунд ещё как bigint, и только потом
        // переводятся в число: так в результате остаётся три знака после
        // запятой без потери точности на больших значениях.
        return Number(elapsedNs / 1000n) / 1000;
    }

    static #resolveId(header: string | string[] | undefined): string {
        const incoming = Array.isArray(header) ? header[0] : header;

        if (typeof incoming === 'string') {
            const candidate = incoming.trim();
            const isUsable = candidate.length > 0
                && candidate.length <= MAX_REQUEST_ID_LENGTH
                && SAFE_REQUEST_ID.test(candidate);

            if (isUsable) {
                return candidate;
            }
        }

        return randomUUID();
    }
}
