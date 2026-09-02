import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Config, type RawEnv } from '../../src/config/config.ts';
import { PasswordService } from '../../src/modules/auth/password.service.ts';

const envWithCost = (bcryptCost: string): RawEnv => ({
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'debug',
    DATABASE_URL: 'postgres://spending:spending@localhost:5432/spending_test',
    BCRYPT_COST: bcryptCost,
});

describe('PasswordService', () => {
    test('hashes a password and verifies only the matching password', async () => {
        // хеширует пароль и подтверждает только совпадающий пароль
        const service = new PasswordService(Config.load(envWithCost('10')));

        const hash = await service.hash('correct horse battery staple');

        assert.notEqual(hash, 'correct horse battery staple');
        assert.equal(await service.verify('correct horse battery staple', hash), true);
        assert.equal(await service.verify('wrong password', hash), false);
    });

    test('uses a validated cost factor from Config', async () => {
        // использует проверенный коэффициент сложности из Config
        const service = new PasswordService(Config.load(envWithCost('10')));

        const hash = await service.hash('secret1');

        assert.match(hash, /^\$2[aby]\$10\$/);
        assert.throws(() => Config.load(envWithCost('not-a-number')), /BCRYPT_COST/);
    });
});
