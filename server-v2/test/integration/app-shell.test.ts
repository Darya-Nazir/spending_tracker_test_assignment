import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { useTestApp } from '../helpers/app.ts';

const { app } = useTestApp();

// Это название группы тестов. Речь про «каркас приложения»: 
// собранный express-объект со всеми middleware и роутерами, но без запуска сервера: listen() не вызывается. 
// Тест проверяет, что этот каркас в целом жив — что через всю цепочку 
// RequestContext → json → healthRouter → NotFoundHandler → ErrorHandler 
// запрос доходит и возвращает корректный ответ.
describe('app shell', () => {

    test('GET /health answers 200 {status:"ok"} as JSON', async () => {
        // GET /health отвечает 200 {status:"ok"} в JSON
        const response = await request(app).get('/health');

        assert.equal(response.status, 200);
        assert.equal(response.type, 'application/json');
        assert.deepEqual(response.body, { status: 'ok' });
    });
});
