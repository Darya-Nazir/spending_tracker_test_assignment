import type { Database } from '../../db/database.ts';

/**
 * Две проверки с разным смыслом:
 *
 *   check()     — процесс принимает и обрабатывает запросы. В базу не ходит.
 *   readiness() — база отвечает на запрос, значит запрос можно обслужить
 *                 целиком.
 *
 * Разделение нужно деплою: по /health процесс перезапускают, по /ready его
 * убирают из балансировки. Перезапуск процесса при выключенной базе ничего
 * не меняет — база от него не поднимется.
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
