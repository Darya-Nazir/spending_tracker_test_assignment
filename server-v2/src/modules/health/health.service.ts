import type { Database } from '../../db/database.ts';

/**
 * Две проверки с разным смыслом:
 *
 *   check()     — процесс принимает и обрабатывает запросы. В базу не ходит.
 *   readiness() — база отвечает на запрос, значит запрос можно обслужить
 *                 целиком.
 */

export type Health = { status: 'ok' };

export type Readiness = { db: 'up' | 'down' };

export class HealthService {
    readonly #database: Database;

    constructor(database: Database) {
        this.#database = database;
    }

    check(): Health {
        return { status: 'ok' };
    }

    async readiness(): Promise<Readiness> {
        return { db: (await this.#database.isReachable()) ? 'up' : 'down' };
    }
}
