import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { AppFactory } from '../../src/http/app.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const buildApp = () => {
    const config = Config.load({ NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'debug' });
    return new AppFactory(config, Logger.create(config, new MemorySink())).build();
};

// Это название группы тестов. Речь про «каркас приложения»: 
// собранный express-объект со всеми middleware и роутерами, но без запуска сервера: listen() не вызывается. 
// Тест проверяет, что этот каркас в целом жив — что через всю цепочку 
// RequestContext → json → healthRouter → NotFoundHandler → ErrorHandler 
// запрос доходит и возвращает корректный ответ.
describe('app shell', () => {

    test('GET /health answers 200 {status:"ok"} as JSON', async () => {
        // GET /health отвечает 200 {status:"ok"} в JSON
        const response = await request(buildApp()).get('/health');

        assert.equal(response.status, 200);
        assert.equal(response.type, 'application/json');
        assert.deepEqual(response.body, { status: 'ok' });
    });
});
