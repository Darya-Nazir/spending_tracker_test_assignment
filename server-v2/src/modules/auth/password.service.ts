import bcrypt from 'bcryptjs';

import type { Config } from '../../config/config.ts';

/** Хеширует пароли и проверяет их, не раскрывая bcrypt остальному приложению. */
export class PasswordService {
    readonly #cost: number;

    constructor(config: Config) {
        this.#cost = config.bcryptCost;
    }

    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.#cost);
    }

    async verify(password: string, passwordHash: string): Promise<boolean> {
        return bcrypt.compare(password, passwordHash);
    }
}
