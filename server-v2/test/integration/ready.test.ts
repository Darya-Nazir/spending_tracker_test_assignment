import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { AppFactory } from '../../src/http/app.ts';
import { createTestDatabase, TEST_DATABASE_URL } from '../helpers/db.ts';

/**
 *  /ready отвечает 200 только когда база отвечает на запрос
 *
 * Первому тесту нужен запущенный контейнер: docker compose up -d --wait.
 *
 * Второй тест контейнер не останавливает, а создаёт Database с адресом
 * закрытого порта: прогон не должен менять состояние базы, с которой в это
 * же время может работать запущенный сервер.
 */

// Адрес spending_test, а не spending_dev: с этапа 7 весь прогон работает
// с тестовой базой.
const REACHABLE_URL = TEST_DATABASE_URL;

// Порт 1 не слушает никто: соединение отклоняется сразу, без ожидания таймаута.
const UNREACHABLE_URL = 'postgres://spending:spending@127.0.0.1:1/spending_test';

const buildApp = (databaseUrl: string) => {
    const { config, logger, database } = createTestDatabase(databaseUrl);

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
            // Пока соединения открыты, node:test не выходит после
            // последнего теста.
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

            // deepEqual запрещает лишние поля: в ответ не должен попасть ни
            // текст ошибки pg, ни строка подключения — в ней пароль.
            assert.deepEqual(response.body, { db: 'down' });
        } finally {
            await database.close();
        }
    });
});
