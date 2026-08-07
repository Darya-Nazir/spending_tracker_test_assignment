import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { RequestContext } from '../../src/http/middleware/request-context.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const config = Config.load({ NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'debug' });

// Здесь проверяется только requestId, поэтому заглушки дают ровно то, к чему
// middleware обращается по пути к нему: у запроса — headers, у ответа —
// setHeader() и подписку on(). Заголовок ответа и access-лог проверяются
// интеграционными тестами, на настоящих объектах express.
const fakeRequest = (headers: Record<string, string> = {}): Request =>
    ({ headers, method: 'GET', originalUrl: '/health' } as unknown as Request);

const fakeResponse = (): Response =>
    ({
        setHeader() { return this; },
        on() { return this; },
    } as unknown as Response);

describe('RequestContext', () => {

    test('sets requestId and a logger carrying it on the request', async () => {
        // ставит на запрос requestId и логгер, который его несёт
        const sink = new MemorySink();
        const context = new RequestContext(Logger.create(config, sink));

        const req = fakeRequest();
        const res = fakeResponse();
        let advanced = false;

        context.attach(req, res, () => { advanced = true; });

        assert.equal(advanced, true, 'next() вызван, цепочка middleware продолжается');
        assert.equal(typeof req.requestId, 'string');
        assert.ok(req.requestId.length > 0);

        req.log.info('handled');

        const records = await sink.records();
        assert.equal(records[0]?.requestId, req.requestId);
    });

    test('generates a different id for each request', async () => {
        // генерирует разный идентификатор для каждого запроса
        const context = new RequestContext(Logger.create(config, new MemorySink()));

        const first = fakeRequest();
        const second = fakeRequest();
        context.attach(first, fakeResponse(), () => {});
        context.attach(second, fakeResponse(), () => {});

        assert.notEqual(first.requestId, second.requestId);
    });

    test('reuses the value of an incoming x-request-id header', async () => {
        // переиспользует значение входящего заголовка x-request-id
        const sink = new MemorySink();
        const context = new RequestContext(Logger.create(config, sink));

        const req = fakeRequest({ 'x-request-id': 'from-upstream-proxy' });
        context.attach(req, fakeResponse(), () => {});

        assert.equal(req.requestId, 'from-upstream-proxy');

        req.log.info('handled');
        const records = await sink.records();
        assert.equal(records[0]?.requestId, 'from-upstream-proxy');
    });

    test('replaces an incoming id that contains unexpected characters', async () => {
        // заменяет входящий идентификатор, содержащий недопустимые символы
        const context = new RequestContext(Logger.create(config, new MemorySink()));

        // Перевод строки внутри значения дал бы в NDJSON-выводе лишнюю строку,
        // которую JSON.parse разберёт как отдельную запись лога.
        const forged = fakeRequest({ 'x-request-id': 'ok\n{"level":"error","msg":"fake"}' });
        context.attach(forged, fakeResponse(), () => {});
        assert.doesNotMatch(forged.requestId, /\n/);

        const empty = fakeRequest({ 'x-request-id': '   ' });
        context.attach(empty, fakeResponse(), () => {});
        assert.ok(empty.requestId.trim().length > 0, 'пустое значение заменено сгенерированным');
    });
});
