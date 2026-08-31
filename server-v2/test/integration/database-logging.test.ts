import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDatabase, TEST_DATABASE_URL } from '../helpers/db.ts';

const REACHABLE_URL = TEST_DATABASE_URL;

const UNREACHABLE_URL = 'postgres://spending:spending@127.0.0.1:1/spending_test';

describe('database connection logging', () => {

    test('logs the first real connection and does not log SQL', async () => {
        // Логирует первое реальное подключение и не логирует SQL.
        const { database, sink } = createTestDatabase(REACHABLE_URL);

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
        const { database, sink } = createTestDatabase(UNREACHABLE_URL);

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
