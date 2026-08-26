import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../../src/config/config.ts';
import { Database } from '../../src/db/database.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const REACHABLE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgres://spending:spending@localhost:5432/spending_test';

const UNREACHABLE_URL = 'postgres://spending:spending@127.0.0.1:1/spending_test';

const buildDatabase = (databaseUrl: string) => {
    const config = Config.load({
        NODE_ENV: 'test',
        PORT: '3000',
        LOG_LEVEL: 'debug',
        DATABASE_URL: databaseUrl,
    });
    const sink = new MemorySink();
    const logger = Logger.create(config, sink);

    return { database: new Database(config, logger), sink };
};

describe('database connection logging', () => {

    test('logs the first real connection and does not log SQL', async () => {
        // Логирует первое реальное подключение и не логирует SQL.
        const { database, sink } = buildDatabase(REACHABLE_URL);

        try {
            assert.equal(await database.isReachable(), true);
            assert.equal(await database.isReachable(), true);

            const records = await sink.records();
            assert.equal(
                records.filter(({ msg }) => msg === 'database connected').length,
                1,
                'первое физическое соединение с PostgreSQL записано один раз',
            );
            assert.equal(
                records.some(({ msg }) => msg === 'sql'),
                false,
                'SQL-запросы не пишет логгер приложения',
            );
        } finally {
            await database.close();
        }
    });

    test('logs a warning when Postgres is unreachable', async () => {
        // Логирует предупреждение, когда PostgreSQL недоступен.
        const { database, sink } = buildDatabase(UNREACHABLE_URL);

        try {
            assert.equal(await database.isReachable(), false);

            const records = await sink.records();
            assert.equal(
                records.some(({ level, msg }) => level === 'warn' && msg === 'database is not reachable'),
                true,
            );
        } finally {
            await database.close();
        }
    });
});
