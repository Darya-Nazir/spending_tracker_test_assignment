import { Router } from 'express';

import type { HealthController } from './health.controller.ts';

/**
 * Соответствие путей и методов обработчикам. Логики нет.
 *
 * Путь /health без префикса /api: клиент этот эндпоинт не вызывает,
 * он для мониторинга и для проверки, что процесс поднялся.
 */
export class HealthRouter {
    static create(controller: HealthController): Router {
        const router = Router();

        router.get('/health', controller.get);

        return router;
    }
}
