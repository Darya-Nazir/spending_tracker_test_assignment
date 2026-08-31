import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();

const insertCategory = async (
    userId: number,
    type: string,
    title: string,
): Promise<number> => {
    const { rows } = await database.query<{ id: number }>(
        `insert into categories (user_id, type, title)
         values ($1, $2, $3)
         returning id`,
        [userId, type, title],
    );
    const category = rows[0];

    assert.ok(category);
    assert.equal(typeof category.id, 'number');
    return category.id;
};

describe('categories schema', () => {

    test('rejects a case-insensitive duplicate within the same user and type', async () => {
        // отвергает Еда и еда внутри одной пары пользователь–тип
        const user = await createUser(database);
        await insertCategory(user.id, 'expense', 'Еда');

        await assert.rejects(
            insertCategory(user.id, 'expense', 'еда'),
            (error: unknown) => {
                assert.equal((error as { code?: string }).code, '23505');
                return true;
            },
        );
    });

    test('allows the same title for another type or user', async () => {
        // разрешает одно название для другого типа или другого пользователя
        const firstUser = await createUser(database);
        const secondUser = await createUser(database);

        const ids = [
            await insertCategory(firstUser.id, 'expense', 'Общее'),
            await insertCategory(firstUser.id, 'income', 'Общее'),
            await insertCategory(secondUser.id, 'expense', 'Общее'),
        ];

        assert.equal(new Set(ids).size, 3);
    });

    test('rejects a type other than income or expense', async () => {
        // разрешает только типы income и expense
        const user = await createUser(database);

        await assert.rejects(
            insertCategory(user.id, 'transfer', 'Перевод'),
            (error: unknown) => {
                assert.equal((error as { code?: string }).code, '22P02');
                return true;
            },
        );
    });
});
