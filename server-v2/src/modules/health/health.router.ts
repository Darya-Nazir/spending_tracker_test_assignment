import { Router } from 'express';

import type { HealthController } from './health.controller.ts';

/**
 * Соответствие путей и методов обработчикам. Логики нет.
 *
 * Пути /health и /ready идут без префикса /api: клиент их не вызывает,
 * они для мониторинга и деплоя. /health — процесс поднялся, /ready —
 * зависимости отвечают.
 */
export class HealthRouter {
    static create(controller: HealthController): Router {
        const router = Router();

        router.get('/health', controller.health);
        router.get('/ready', controller.ready);

        return router;
    }
}
