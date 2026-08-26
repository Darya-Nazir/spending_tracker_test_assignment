import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Config, type RawEnv } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const configFor = (patch: RawEnv): Config => Config.load({
    NODE_ENV: 'production',
    PORT: '3000',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://spending:spending@localhost:5432/spending_test',
    ...patch,
});

describe('Logger', () => {

    test('writes one JSON object per line when not in development', async () => {
        // вне development пишет по одному JSON-объекту на строку
        const sink = new MemorySink();
        const logger = Logger.create(configFor({ NODE_ENV: 'production' }), sink);

        logger.info({ requestId: 'req-1' }, 'server started');
        logger.warn({ requestId: 'req-2' }, 'refresh token rejected');

        const lines = await sink.lines();
        assert.equal(lines.length, 2, 'две записи — две строки, без переносов внутри записи');

        const [started, rejected] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);

        // Уровень строкой, а не числом 30: по такому значению фильтруют grep и jq.
        assert.equal(started?.level, 'info');
        assert.equal(started?.msg, 'server started');
        assert.equal(started?.requestId, 'req-1');

        assert.equal(rejected?.level, 'warn');
        assert.equal(rejected?.msg, 'refresh token rejected');
        assert.equal(rejected?.requestId, 'req-2');

        assert.equal(typeof started?.time, 'number', 'в записи есть отметка времени');
    });

    test('writes human-readable text in development', async () => {
        // в development пишет человекочитаемый текст
        const sink = new MemorySink();
        const logger = Logger.create(configFor({ NODE_ENV: 'development' }), sink);

        logger.info({ requestId: 'req-1' }, 'server started');

        const text = await sink.text();

        assert.throws(
            () => JSON.parse(text.split('\n')[0]!),
            'первая строка не разбирается как JSON — значит формат сменился на pretty',
        );
        assert.match(text, /server started/, 'текст сообщения на месте');
        assert.match(text, /INFO/i, 'уровень выведен словом');
        assert.match(text, /req-1/, 'поля записи не потеряны');
    });

    test('drops records below LOG_LEVEL and writes the rest', async () => {
        // отбрасывает записи ниже LOG_LEVEL, остальные пишет
        const quiet = new MemorySink();
        const quietLogger = Logger.create(configFor({ LOG_LEVEL: 'info' }), quiet);

        quietLogger.debug({ component: 'cache' }, 'details');
        quietLogger.info('kept');

        const quietRecords = await quiet.records();
        assert.equal(quietRecords.length, 1, 'запись уровня debug не дошла до стока');
        assert.equal(quietRecords[0]?.msg, 'kept');

        const verbose = new MemorySink();
        const verboseLogger = Logger.create(configFor({ LOG_LEVEL: 'debug' }), verbose);

        verboseLogger.debug({ component: 'cache' }, 'details');
        verboseLogger.info('kept');

        const verboseRecords = await verbose.records();
        assert.equal(verboseRecords.length, 2, 'при LOG_LEVEL=debug та же запись проходит');
        assert.equal(verboseRecords[0]?.msg, 'details');
        assert.equal(verboseRecords[0]?.component, 'cache');
    });

    test('child logger adds its fields to every record it writes', async () => {
        // child-логгер добавляет свои поля в каждую написанную им запись
        const sink = new MemorySink();
        const logger = Logger.create(configFor({}), sink);

        const child = logger.child({ requestId: 'req-42' });
        child.info('handling request');
        child.warn({ status: 401 }, 'rejected');

        // child() возвращает новый объект; поля исходного логгера не меняются.
        logger.info('unrelated background work');

        const records = await sink.records();
        assert.equal(records.length, 3);

        assert.equal(records[0]?.requestId, 'req-42');
        assert.equal(records[0]?.msg, 'handling request');

        assert.equal(records[1]?.requestId, 'req-42', 'поле есть во всех записях child-логгера');
        assert.equal(records[1]?.status, 401, 'поля вызова добавляются к полям child-логгера');

        assert.equal(records[2]?.requestId, undefined, 'у записи исходного логгера поля нет');
    });
});
