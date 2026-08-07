import type { Request, Response } from 'express';

import type { HealthService } from './health.service.ts';

/**
 * Слой HTTP: читает запрос, вызывает сервис, записывает ответ.
 * Правил здесь нет — они в сервисе.
 */
export class HealthController {
    readonly #service: HealthService;

    constructor(service: HealthService) {
        this.#service = service;
    }

    readonly get = (_req: Request, res: Response): void => {
        res.status(200).json(this.#service.check());
    };
}
