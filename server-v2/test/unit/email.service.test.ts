import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { EmailService } from '../../src/modules/users/email.service.ts';

describe('EmailService', () => {
    test('normalize lowercases every letter in an email', () => {
        // normalize переводит все буквы email в нижний регистр
        const service = new EmailService();

        const normalizedEmail = service.normalize('Darya@Example.TEST');

        assert.equal(normalizedEmail, 'darya@example.test');
    });
});
