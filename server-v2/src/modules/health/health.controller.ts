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

    readonly health = (_req: Request, res: Response): void => {
        res.status(200).json(this.#service.check());
    };

    /**
     * 503, а не 500: 500 означает ошибку в обработке запроса, 503 — что
     * процесс работает, но обслужить запрос сейчас не может.
     */
    readonly ready = async (_req: Request, res: Response): Promise<void> => {
        const readiness = await this.#service.readiness();

        res.status(readiness.db === 'up' ? 200 : 503).json(readiness);
    };
}
