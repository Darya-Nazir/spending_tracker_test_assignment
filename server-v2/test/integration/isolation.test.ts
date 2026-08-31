import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();

type UserCountRow = {
    count: number;
};

const countUsers = async (): Promise<number> => {
    const { rows } = await database.query<UserCountRow>(
        'select count(*)::integer as count from users',
    );

    return rows[0]?.count ?? -1;
};

describe('integration test isolation', { concurrency: false }, () => {

    test('test A inserts one user', async () => {
        // тест A вставляет одного пользователя
        const user = await createUser(database);

        assert.equal(typeof user.id, 'number');
        assert.equal(await countUsers(), 1);
    });

    test('test B sees zero users after test A inserted one', async () => {
        // тест B видит ноль пользователей после того, как тест A вставил одного
        assert.equal(await countUsers(), 0);
    });
});
