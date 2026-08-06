import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import type { Logger } from '../../logging/logger.ts';

/**
 * Первый middleware в цепочке: выдаёт запросу идентификатор и логгер, который
 * этот идентификатор несёт.
 *
 * Без этого логи параллельных запросов перемешиваются в одну неразличимую ленту.
 * С ним любую строку можно связать со всеми остальными строками того же запроса
 * одним `grep requestId`, а вызывающий может назвать идентификатор в баг-репорте.
 */

const REQUEST_ID_HEADER = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Заголовок приходит снаружи и доверия не заслуживает. Перевод строки в нём
 * подделал бы лишнюю строку в NDJSON-выводе, поэтому набор символов сужен
 * до того, что реально встречается в идентификаторах трассировки.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

declare global {
    namespace Express {
        interface Request {
            /** Идентификатор запроса: подхваченный у вызывающего или свой. */
            requestId: string;
            /** Логгер этого запроса. Внутри обработчиков логируют только через него. */
            log: Logger;
        }
    }
}

export class RequestContext {
    readonly #logger: Logger;

    constructor(logger: Logger) {
        this.#logger = logger;
    }

    /** Поле-стрелка, а не метод: express вызывает обработчик без this. */
    readonly handle = (req: Request, res: Response, next: NextFunction): void => {
        const requestId = RequestContext.#resolveId(req.headers[REQUEST_ID_HEADER]);

        req.requestId = requestId;
        req.log = this.#logger.child({ requestId });

        // Возвращаем идентификатор вызывающему — иначе связать жалобу клиента
        // с логами сервера можно только по времени, то есть почти никак.
        res.setHeader(REQUEST_ID_HEADER, requestId);

        next();
    };

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
