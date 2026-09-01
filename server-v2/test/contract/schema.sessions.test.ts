import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();

const insertSession = async (userId: number, tokenHash: string): Promise<number> => {
    const { rows } = await database.query<{ id: number }>(
        `insert into sessions (user_id, token_hash, expires_at, device)
         values ($1, $2, $3, $4)
         returning id`,
        [userId, tokenHash, '2027-01-01T00:00:00Z', 'test device'],
    );
    const session = rows[0];

    assert.ok(session);
    assert.equal(typeof session.id, 'number');
    return session.id;
};

describe('sessions schema', () => {

    test('rejects a duplicate token hash', async () => {
        // хеш refresh-токена уникален среди всех сессий
        const user = await createUser(database);
        const tokenHash = 'a'.repeat(64);
        await insertSession(user.id, tokenHash);

        await assert.rejects(
            insertSession(user.id, tokenHash),
            (error: unknown) => {
                assert.equal((error as { code?: string }).code, '23505');
                return true;
            },
        );
    });

    test('deletes sessions when their user is deleted', async () => {
        // удаление пользователя каскадно удаляет его сессии
        const user = await createUser(database);
        const sessionId = await insertSession(user.id, 'b'.repeat(64));

        await database.query('delete from users where id = $1', [user.id]);

        const { rows } = await database.query<{ count: number }>(
            `select count(*)::integer as count
               from sessions
              where id = $1`,
            [sessionId],
        );

        assert.equal(rows[0]?.count, 0);
    });
});
