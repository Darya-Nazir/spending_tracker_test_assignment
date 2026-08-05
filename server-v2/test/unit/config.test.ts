import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Config, type RawEnv } from '../../src/config/config.ts';

/**
 * Config.load() принимает окружение аргументом вместо чтения process.env
 * напрямую — поэтому тестам никогда не приходится мутировать глобальное состояние.
 */
const validEnv: Readonly<RawEnv> = Object.freeze({
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'debug',
});

const envWith = (patch: RawEnv): RawEnv => ({ ...validEnv, ...patch });

const envWithout = (...keys: string[]): RawEnv => {
    const env: RawEnv = { ...validEnv };
    for (const key of keys) {
        delete env[key];
    }
    return env;
};

describe('Config', () => {

    test('reads every variable off the supplied environment', () => {
        // читает каждую переменную из переданного окружения
        const config = Config.load(validEnv);

        assert.equal(config.nodeEnv, 'test');
        assert.equal(config.port, 3000);
        assert.equal(config.logLevel, 'debug');
    });

    test('applies a default to every optional variable', () => {
        // подставляет значение по умолчанию каждой необязательной переменной
        const config = Config.load(envWithout('NODE_ENV', 'PORT', 'LOG_LEVEL'));

        assert.equal(config.nodeEnv, 'development');
        assert.equal(config.port, 3000);
        assert.equal(config.logLevel, 'info');
    });

    test('rejects invalid values, naming every offending variable at once', () => {
        // отвергает некорректные значения, называя все проблемные переменные сразу
        assert.throws(() => Config.load(envWith({ NODE_ENV: 'staging' })), /NODE_ENV/);
        assert.throws(() => Config.load(envWith({ PORT: 'nope' })), /PORT/);
        assert.throws(() => Config.load(envWith({ PORT: '70000' })), /PORT/);
        assert.throws(() => Config.load(envWith({ LOG_LEVEL: 'verbose' })), /LOG_LEVEL/);

        let message = '';
        try {
            Config.load(envWith({ NODE_ENV: 'staging', PORT: 'nope' }));
        } catch (error) {
            message = (error as Error).message;
        }

        assert.match(message, /NODE_ENV/);
        assert.match(message, /PORT/);
    });
});
