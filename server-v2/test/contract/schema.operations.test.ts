import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();

type ReferencedOperation = {
    categoryId: number;
    operationId: number;
};

const createReferencedOperation = async (): Promise<ReferencedOperation> => {
    const user = await createUser(database);
    const { rows: categoryRows } = await database.query<{ id: number }>(
        `insert into categories (user_id, type, title)
         values ($1, $2, $3)
         returning id`,
        [user.id, 'expense', 'Еда'],
    );
    const category = categoryRows[0];
    assert.ok(category);

    const { rows: operationRows } = await database.query<{ id: number }>(
        `insert into operations (user_id, category_id, type, amount, date, comment)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [user.id, category.id, 'expense', 100, '2026-09-01', 'Обед'],
    );
    const operation = operationRows[0];
    assert.ok(operation);

    return { categoryId: category.id, operationId: operation.id };
};

describe('operations schema', () => {

    test('rejects deleting a category while an operation references it', async () => {
        // Foreign Key запрещает удалять категорию, пока на неё ссылается операция
        const fixture = await createReferencedOperation();

        await assert.rejects(
            database.query('delete from categories where id = $1', [fixture.categoryId]),
            (error: unknown) => {
                assert.equal((error as { code?: string }).code, '23503');
                return true;
            },
        );
    });

    test('allows deleting a category after its operation is deleted', async () => {
        // после удаления операции категория становится пустой и удаляется
        const fixture = await createReferencedOperation();

        await database.query(
            'delete from operations where id = $1',
            [fixture.operationId],
        );
        const deletion = await database.query(
            'delete from categories where id = $1',
            [fixture.categoryId],
        );

        assert.equal(deletion.rowCount, 1);
    });
});
