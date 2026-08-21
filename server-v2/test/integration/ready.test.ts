import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { AppFactory } from '../../src/http/app.ts';
import { Database } from '../../src/db/database.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

/**
 * Готовность обслуживать запросы. /health отвечает «процесс жив», /ready —
 * «зависимости отвечают». Разделение нужно деплою и мониторингу: живой процесс
 * с недоступной базой не надо перезапускать, ему надо перестать давать трафик.
 *
 * Первому тесту нужен поднятый контейнер: docker compose up -d --wait.
 *
 * Второй тест контейнер не останавливает, а поднимает Database на закрытый
 * порт: прогон тестов не должен трогать общую базу.
 *
 * Замечание к реализации: пул обязан слушать собственное событие 'error'.
 * Без обработчика ошибка простаивающего соединения — необработанное событие,
 * то есть падение всего процесса вместо ответа 503.
 */

// Тестовая база, а не spending_dev: с этапа 7 сюда будет смотреть весь прогон.
const REACHABLE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgres://spending:spending@localhost:5432/spending_test';

// Порт 1 не слушает никто: соединение отклоняется сразу, без ожидания таймаута.
const UNREACHABLE_URL = 'postgres://spending:spending@127.0.0.1:1/spending_test';

const buildApp = (databaseUrl: string) => {
    const config = Config.load({
        NODE_ENV: 'test',
        PORT: '3000',
        LOG_LEVEL: 'debug',
        DATABASE_URL: databaseUrl,
    });
    const logger = Logger.create(config, new MemorySink());
    const database = new Database(config, logger);

    return { app: new AppFactory(config, logger, database).build(), database };
};

describe('readiness', () => {

    test('GET /ready answers 200 {db:"up"} when Postgres is reachable', async () => {
        // GET /ready отвечает 200 {db:"up"}, когда Postgres доступен
        const { app, database } = buildApp(REACHABLE_URL);

        try {
            const response = await request(app).get('/ready');

            assert.equal(response.status, 200);
            assert.equal(response.type, 'application/json');
            assert.deepEqual(response.body, { db: 'up' });
        } finally {
            // Открытый пул не даёт node:test завершиться.
            await database.close();
        }
    });

    test('GET /ready answers 503 {db:"down"} when the pool cannot reach Postgres', async () => {
        // GET /ready отвечает 503 {db:"down"}, когда пул не доходит до Postgres
        const { app, database } = buildApp(UNREACHABLE_URL);

        try {
            const response = await request(app).get('/ready');

            assert.equal(response.status, 503, 'недоступная база — это 503, а не 500');
            assert.equal(response.type, 'application/json');

            // Ровно это тело и ничего сверх: ни текста ошибки pg, ни строки
            // подключения — в ней пароль.
            assert.deepEqual(response.body, { db: 'down' });
        } finally {
            await database.close();
        }
    });
});
