import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UserRepository } from '../../src/modules/users/user.repository.ts';
import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();
const repository = new UserRepository(database);

describe('UserRepository', () => {
    test('findByEmail finds a user regardless of email letter case', async () => {
        // findByEmail находит пользователя независимо от регистра букв в email
        const persisted = await createUser(database, {
            email: 'Darya@Example.test',
            passwordHash: 'stored-password-hash',
        });

        const found = await repository.findByEmail('dARYA@eXAMPLE.TEST');

        assert.ok(found);
        assert.equal(found.id, persisted.id);
        assert.equal(found.email, persisted.email);
        assert.equal(found.passwordHash, persisted.passwordHash);
    });
});
