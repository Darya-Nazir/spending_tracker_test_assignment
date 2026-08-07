import express, { json, type Express, type Router } from 'express';
// Express — библиотека поверх встроенного модуля Node node:http. 
// Объект, который возвращает express(), физически является 
// функцией-обработчиком запроса
import type { Config } from '../config/config.ts';
import type { Logger } from '../logging/logger.ts';
import { ErrorHandler } from './middleware/error-handler.ts';
import { NotFoundHandler } from './middleware/not-found.ts';
import { HealthController } from '../modules/health/health.controller.ts';
import { HealthRouter } from '../modules/health/health.router.ts';
import { HealthService } from '../modules/health/health.service.ts';
import { RequestContext } from './middleware/request-context.ts';

/**
 * Сборка объекта express-приложения: создаёт его, регистрирует middleware
 * и роутеры, возвращает.
 * */

const BODY_LIMIT = '100kb';

export class AppFactory {
    readonly #config: Config;
    readonly #logger: Logger;

    constructor(config: Config, logger: Logger) {
        this.#config = config;
        this.#logger = logger;
    }

    build(): Express {
        const app = express();

        // По умолчанию express добавляет к каждому ответу заголовок
        // X-Powered-By: Express. Он называет используемый фреймворк и ничего
        // не даёт клиенту, поэтому выключен.
        app.disable('x-powered-by');

        // Порядок регистрации —  порядок строк
        
        app.use(new RequestContext(this.#logger).attach); // помечает все записи одного запроса requestId
        app.use(json({ limit: BODY_LIMIT }));

        app.use(this.#healthRouter());

        app.use(new NotFoundHandler().reject);
        app.use(new ErrorHandler(this.#logger).respond);

        return app;
    }

    /**
     * Сборка модуля health: сервис отдаётся контроллеру, контроллер — роутеру.
     * Зависимости создаются здесь и передаются в конструкторы, поэтому сами
     * классы друг друга не создают и их можно собрать иначе в тестах.
     */
    #healthRouter(): Router {
        return HealthRouter.create(new HealthController(new HealthService()));
    }
}
