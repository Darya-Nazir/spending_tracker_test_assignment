import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { EmailService } from '../../src/modules/users/email.service.ts';
import { UserRepository } from '../../src/modules/users/user.repository.ts';
import { useTestDatabase } from '../helpers/db.ts';
import { createUser } from '../helpers/factories.ts';

const { database } = useTestDatabase();
const repository = new UserRepository(database);
const emailService = new EmailService();

describe('UserRepository', () => {
    test('findByEmail finds a user by an email normalized in the service', async () => {
        // findByEmail находит пользователя по email, нормализованному в сервисе
        const persisted = await createUser(database, {
            email: emailService.normalize('Darya@Example.test'),
            passwordHash: 'stored-password-hash',
        });

        const found = await repository.findByEmail(
            emailService.normalize('dARYA@eXAMPLE.TEST'),
        );

        assert.ok(found);
        assert.equal(found.id, persisted.id);
        assert.equal(found.email, persisted.email);
        assert.equal(found.passwordHash, persisted.passwordHash);
    });
});
