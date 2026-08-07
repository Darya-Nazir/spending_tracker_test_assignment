import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from '../helpers/memory-sink.ts';
import { ErrorHandler } from '../../src/http/middleware/error-handler.ts';
import {
    AppError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} from '../../src/errors/app-error.ts';

const config = Config.load({ NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'debug' });

// Обработчик вызывает у ответа только status() и json(), а у запроса читает
// req.log и метаданные для лога. Вместо объектов express подставляются заглушки
// с этими полями, записывающие переданные им значения.
type Captured = {
    statusCode: number | undefined;
    body: Record<string, unknown> | undefined;
};

const fakeResponse = (): { res: Response; captured: Captured } => {
    const captured: Captured = { statusCode: undefined, body: undefined };
    const res = {
        headersSent: false,
        status(code: number) {
            captured.statusCode = code;
            return this;
        },
        json(payload: Record<string, unknown>) {
            captured.body = payload;
            return this;
        },
    };

    return { res: res as unknown as Response, captured };
};

const handleError = async (thrown: unknown) => {
    const sink = new MemorySink();
    const logger = Logger.create(config, sink);

    const req = {
        method: 'POST',
        originalUrl: '/api/operations',
        requestId: 'req-1',
        log: logger.child({ requestId: 'req-1' }),
    } as unknown as Request;

    const { res, captured } = fakeResponse();
    let advanced = false;

    new ErrorHandler(logger).respond(thrown, req, res, () => { advanced = true; });

    return { ...captured, advanced, logged: await sink.records() };
};

describe('ErrorHandler', () => {

    test('maps each error class to its own status code', async () => {
        // переводит каждый класс ошибок в свой код статуса
        const cases: { error: AppError; status: number }[] = [
            { error: new ValidationError('name must be at least 3 characters'), status: 400 },
            { error: new UnauthorizedError('incorrect email or password'), status: 401 },
            { error: new NotFoundError('operation not found'), status: 404 },
            { error: new ConflictError('category already exists'), status: 409 },
        ];

        for (const { error, status } of cases) {
            const result = await handleError(error);

            assert.equal(result.statusCode, status, error.constructor.name);
            assert.deepEqual(result.body, { error: true, message: error.message });
            assert.equal(result.advanced, false, 'обработчик формирует ответ сам и не вызывает next()');
        }
    });

    test('answers an unknown Error with 500 and no internal details', async () => {
        // отвечает на неизвестную Error пятисоткой без внутренних подробностей
        const internal = new Error('column "usr_id" does not exist');
        const result = await handleError(internal);

        assert.equal(result.statusCode, 500);
        assert.equal(result.body?.error, true);
        assert.equal(typeof result.body?.message, 'string');
        assert.ok((result.body?.message as string).length > 0, 'message непустой');
        assert.deepEqual(
            Object.keys(result.body ?? {}).sort(),
            ['error', 'message'],
            'в теле два ключа: error и message',
        );

        const serialized = JSON.stringify(result.body);
        assert.doesNotMatch(serialized, /usr_id/, 'текст ошибки базы в ответ не попадает');
        assert.doesNotMatch(serialized, /at /, 'стек в ответ не попадает');

        // Текст и стек уходят в лог. Найти их можно по requestId, который
        // клиент получает в заголовке ответа x-request-id.
        const failure = result.logged.find((record) => record.level === 'error');
        assert.ok(failure, 'непредвиденная ошибка логируется уровнем error');
        assert.equal(failure.requestId, 'req-1');
        assert.match(JSON.stringify(failure), /usr_id/);
    });

    test('answers 500 in the same form when the thrown value is not an Error', async () => {
        // отвечает пятисоткой той же формы, когда брошено не Error
        const thrown: unknown[] = ['boom', 42, null, undefined, { code: '23505' }, []];

        for (const value of thrown) {
            const result = await handleError(value);

            assert.equal(result.statusCode, 500, `брошено: ${JSON.stringify(value)}`);
            assert.equal(result.body?.error, true);
            assert.equal(typeof result.body?.message, 'string');
            assert.deepEqual(Object.keys(result.body ?? {}).sort(), ['error', 'message']);
        }
    });
});
