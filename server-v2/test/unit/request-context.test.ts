import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { RequestContext } from '../../src/http/middleware/request-context.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const config = Config.load({ NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'debug' });

/**
 * Middleware трогает у запроса только заголовки, а у ответа — только setHeader,
 * поэтому поднимать настоящий express ради него незачем: это придёт на этапе 3
 * интеграционными тестами. Здесь проверяется сам контракт контекста.
 */
const fakeRequest = (headers: Record<string, string> = {}): Request =>
    ({ headers } as unknown as Request);

const fakeResponse = (): Response & { sentHeaders: Map<string, unknown> } => {
    const sentHeaders = new Map<string, unknown>();
    return {
        sentHeaders,
        setHeader(name: string, value: unknown) {
            sentHeaders.set(name.toLowerCase(), value);
            return this;
        },
    } as unknown as Response & { sentHeaders: Map<string, unknown> };
};

describe('RequestContext', () => {

    test('gives every request an id and a logger that carries it', async () => {
        // выдаёт каждому запросу идентификатор и логгер, который его несёт
        const sink = new MemorySink();
        const context = new RequestContext(Logger.create(config, sink));

        const req = fakeRequest();
        const res = fakeResponse();
        let advanced = false;

        context.handle(req, res, () => { advanced = true; });

        assert.equal(advanced, true, 'цепочка middleware должна продолжиться');
        assert.equal(typeof req.requestId, 'string');
        assert.ok(req.requestId.length > 0);

        req.log.info('handled');

        const records = await sink.records();
        assert.equal(records[0]?.requestId, req.requestId);
    });

    test('gives two requests two different ids', async () => {
        // выдаёт двум запросам два разных идентификатора
        const context = new RequestContext(Logger.create(config, new MemorySink()));

        const first = fakeRequest();
        const second = fakeRequest();
        context.handle(first, fakeResponse(), () => {});
        context.handle(second, fakeResponse(), () => {});

        assert.notEqual(first.requestId, second.requestId);
    });

    test('adopts an incoming x-request-id so a trace survives across services', async () => {
        // подхватывает входящий x-request-id, чтобы трасса не рвалась между сервисами
        const sink = new MemorySink();
        const context = new RequestContext(Logger.create(config, sink));

        const req = fakeRequest({ 'x-request-id': 'from-upstream-proxy' });
        context.handle(req, fakeResponse(), () => {});

        assert.equal(req.requestId, 'from-upstream-proxy');

        req.log.info('handled');
        const records = await sink.records();
        assert.equal(records[0]?.requestId, 'from-upstream-proxy');
    });

    test('refuses a junk incoming id instead of logging it verbatim', async () => {
        // отвергает мусорный входящий идентификатор вместо того, чтобы залогировать его как есть
        const context = new RequestContext(Logger.create(config, new MemorySink()));

        // Заголовок приходит снаружи и доверия не заслуживает: перевод строки
        // в нём подделал бы лишнюю строку в NDJSON-выводе.
        const forged = fakeRequest({ 'x-request-id': 'ok\n{"level":"error","msg":"fake"}' });
        context.handle(forged, fakeResponse(), () => {});
        assert.doesNotMatch(forged.requestId, /\n/);

        const empty = fakeRequest({ 'x-request-id': '   ' });
        context.handle(empty, fakeResponse(), () => {});
        assert.ok(empty.requestId.trim().length > 0, 'пустой заголовок заменяется своим id');
    });

    test('echoes the id back so the caller can quote it in a bug report', async () => {
        // возвращает идентификатор в ответе, чтобы вызывающий мог указать его в баг-репорте
        const context = new RequestContext(Logger.create(config, new MemorySink()));

        const req = fakeRequest();
        const res = fakeResponse();
        context.handle(req, res, () => {});

        assert.equal(res.sentHeaders.get('x-request-id'), req.requestId);
    });
});
