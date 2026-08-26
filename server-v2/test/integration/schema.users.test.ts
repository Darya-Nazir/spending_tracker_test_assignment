import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { Config } from '../../src/config/config.ts';
import { Database } from '../../src/db/database.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

const DATABASE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgres://spending:spending@localhost:5432/spending_test';

const config = Config.load({
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'debug',
    DATABASE_URL,
});
const database = new Database(config, Logger.create(config, new MemorySink()));

after(async () => {
    await database.close();
});

type ColumnMetadata = {
    column_name: string;
    data_type: string;
    is_nullable: 'YES' | 'NO';
    numeric_precision: number | null;
    numeric_scale: number | null;
};

describe('users schema', () => {
    test('users has the required columns and initial_balance contract', async () => {
        // в users есть обязательные колонки и соблюдается контракт initial_balance
        const { rows: usersColumnMetadataRows } = await database.query<ColumnMetadata>(
            `select column_name, data_type, is_nullable,
                    numeric_precision, numeric_scale
               from information_schema.columns
              where table_schema = 'public'
                and table_name = 'users'
              order by ordinal_position`,
        );

        const usersColumnsByName = new Map(
            usersColumnMetadataRows.map((columnMetadata) => [
                columnMetadata.column_name,
                columnMetadata,
            ]),
        );

        for (const requiredColumnName of [
            'id',
            'email',
            'name',
            'password_hash',
            'initial_balance',
            'created_at',
        ]) {
            assert.ok(
                usersColumnsByName.has(requiredColumnName),
                `users.${requiredColumnName} must exist`,
            );
        }

        const initialBalanceColumnMetadata = usersColumnsByName.get('initial_balance');
        assert.ok(initialBalanceColumnMetadata);
        assert.equal(initialBalanceColumnMetadata.data_type, 'numeric');
        assert.equal(initialBalanceColumnMetadata.numeric_precision, 14);
        assert.equal(initialBalanceColumnMetadata.numeric_scale, 2);
        assert.equal(initialBalanceColumnMetadata.is_nullable, 'NO');

        const email = 'stage-6-default-balance@example.test';

        try {
            const { rows: insertedUserRows } = await database.query<{ initial_balance: number }>(
                `insert into users (email, name, password_hash)
                 values ($1, $2, $3)
                 returning initial_balance`,
                [email, 'Stage Six', 'not-a-real-password-hash'],
            );

            assert.equal(insertedUserRows[0]?.initial_balance, 0);
        } finally {
            await database.query('delete from users where email = $1', [email]);
        }
    });

    test('email is unique regardless of letter case', async () => {
        // email уникален независимо от регистра букв
        const firstEmail = 'Stage-6-Case@Example.test';
        const sameEmailInAnotherCase = 'stage-6-case@example.TEST';

        try {
            await database.query(
                `insert into users (email, name, password_hash)
                 values ($1, $2, $3)`,
                [firstEmail, 'First User', 'not-a-real-password-hash'],
            );

            await assert.rejects(
                database.query(
                    `insert into users (email, name, password_hash)
                     values ($1, $2, $3)`,
                    [sameEmailInAnotherCase, 'Second User', 'not-a-real-password-hash'],
                ),
                (error: unknown) => {
                    assert.equal(
                        (error as { code?: string }).code,
                        '23505',
                        'PostgreSQL must reject the duplicate with unique_violation',
                    );

                    return true;
                },
            );
        } finally {
            await database.query(
                'delete from users where lower(email) = lower($1)',
                [firstEmail],
            );
        }
    });
});
