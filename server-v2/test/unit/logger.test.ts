import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Config, type RawEnv } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const configFor = (patch: RawEnv): Config => Config.load({
    NODE_ENV: 'production',
    PORT: '3000',
    LOG_LEVEL: 'info',
    ...patch,
});

describe('Logger', () => {

    test('writes one machine-readable JSON object per line when not in development', async () => {
        // вне development пишет по одному машиночитаемому JSON-объекту на строку
        const sink = new MemorySink();
        const logger = Logger.create(configFor({ NODE_ENV: 'production' }), sink);

        logger.info({ requestId: 'req-1' }, 'server started');
        logger.warn({ requestId: 'req-2' }, 'refresh token rejected');

        const lines = await sink.lines();
        assert.equal(lines.length, 2, 'каждая запись — ровно одна строка, без переносов внутри');

        const [started, rejected] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);

        // Уровень — строковая метка, а не число: логи читают и люди, и grep,
        // и ни тем, ни другим не должно приходиться помнить, что 30 — это info.
        assert.equal(started?.level, 'info');
        assert.equal(started?.msg, 'server started');
        assert.equal(started?.requestId, 'req-1');

        assert.equal(rejected?.level, 'warn');
        assert.equal(rejected?.msg, 'refresh token rejected');
        assert.equal(rejected?.requestId, 'req-2');

        assert.equal(typeof started?.time, 'number', 'у каждой записи есть отметка времени');
    });

    test('switches to human-readable output in development', async () => {
        // в development переключается на человекочитаемый вывод
        const sink = new MemorySink();
        const logger = Logger.create(configFor({ NODE_ENV: 'development' }), sink);

        logger.info({ requestId: 'req-1' }, 'server started');

        const text = await sink.text();

        assert.throws(
            () => JSON.parse(text.split('\n')[0]!),
            'в dev первая строка — не JSON, иначе pino-pretty не подключился',
        );
        assert.match(text, /server started/, 'сообщение видно как есть');
        assert.match(text, /INFO/i, 'уровень подписан словом');
        assert.match(text, /req-1/, 'поля записи не теряются при форматировании');
    });

    test('honours LOG_LEVEL, dropping records below the configured threshold', async () => {
        // уважает LOG_LEVEL, отбрасывая записи ниже настроенного порога
        const quiet = new MemorySink();
        const quietLogger = Logger.create(configFor({ LOG_LEVEL: 'info' }), quiet);

        quietLogger.debug({ sql: 'select 1' }, 'query');
        quietLogger.info('kept');

        const quietRecords = await quiet.records();
        assert.equal(quietRecords.length, 1, 'debug-строка не должна доехать до стока');
        assert.equal(quietRecords[0]?.msg, 'kept');

        const verbose = new MemorySink();
        const verboseLogger = Logger.create(configFor({ LOG_LEVEL: 'debug' }), verbose);

        verboseLogger.debug({ sql: 'select 1' }, 'query');
        verboseLogger.info('kept');

        const verboseRecords = await verbose.records();
        assert.equal(verboseRecords.length, 2, 'на LOG_LEVEL=debug та же строка проходит');
        assert.equal(verboseRecords[0]?.msg, 'query');
        assert.equal(verboseRecords[0]?.sql, 'select 1');
    });

    test('child logger stamps its bindings onto every record it writes', async () => {
        // child-логгер проставляет свои поля в каждую написанную им запись
        const sink = new MemorySink();
        const logger = Logger.create(configFor({}), sink);

        const child = logger.child({ requestId: 'req-42' });
        child.info('handling request');
        child.warn({ status: 401 }, 'rejected');

        // Родительский логгер про requestId ничего не знает: child-логгер —
        // отдельный объект, а не глобальная мутация.
        logger.info('unrelated background work');

        const records = await sink.records();
        assert.equal(records.length, 3);

        assert.equal(records[0]?.requestId, 'req-42');
        assert.equal(records[0]?.msg, 'handling request');

        assert.equal(records[1]?.requestId, 'req-42', 'поле держится на всех вызовах child-логгера');
        assert.equal(records[1]?.status, 401, 'поля вызова добавляются к полям child-логгера');

        assert.equal(records[2]?.requestId, undefined, 'родитель остался незатронутым');
    });
});
