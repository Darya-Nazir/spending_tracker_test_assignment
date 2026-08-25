import { Pool, types as pgTypes, type QueryResult, type QueryResultRow } from 'pg';

import type { Config } from '../config/config.ts';
import type { LogFields, Logger } from '../logging/logger.ts';

/**
 * Единственная точка приложения, через которую вызывается драйвер и создаётся pg.Pool. 
 * Репозитории получают этот объект и вызывают query()
 */

const PING = 'select 1';

// Денежные поля ограничены numeric(14,2) и безопасно помещаются в Number.
pgTypes.setTypeParser(1700, (value) => Number(value));

// Дату без времени сохраняем строкой, чтобы часовой пояс не менял день.
pgTypes.setTypeParser(1082, (value) => value);

export class Database {
    readonly #pool: Pool;
    readonly #logger: Logger;

    constructor(config: Config, logger: Logger) {
        this.#logger = logger;

        // Соединение открывается при первом query(). Поэтому
        // процесс поднимается и при выключенной базе — она нужна только
        // для ответа на /ready.
        this.#pool = new Pool({ connectionString: config.databaseUrl });

        this.#pool.on('error', (error) => {
            this.#logger.error({ err: error }, 'idle database client failed');
        });
    }

    // запрос
    async query<T extends QueryResultRow = QueryResultRow>(
        sql: string, //обычная строка с SQL-запросом
        params: readonly unknown[] = [], //значения, которые PostgreSQL подставляет вместо $1, $2 и тд
    ): Promise<QueryResult<T>> {
        const startedAt = performance.now();

        try {
            const result = await this.#pool.query<T>(sql, [...params]);
            this.#logQuery(sql, startedAt, { rows: result.rowCount });

            return result;
        } catch (error) {
            // Запись нужна и для упавшего запроса, и для недоступной базы
            this.#logQuery(sql, startedAt, { failed: true });

            throw error;
        }
    }

    /**
     * Отвечает ли база на PING-запрос. Используется для /ready
     */
    async isReachable(): Promise<boolean> {
        try {
            await this.query(PING);

            return true;
        } catch (error) {
            // warn, а не error: недоступная база — предусмотренный ответ 503
            this.#logger.warn({ err: error }, 'database is not reachable');

            return false;
        }
    }

    /**
     * Закрывает все соединения пула
     */
    async close(): Promise<void> {
        await this.#pool.end();
    }

    #logQuery(sql: string, startedAt: number, fields: LogFields): void {
        // В строку идёт текст SQL, но не values: там оказываются пароли,
        // хеши и токены.
        this.#logger.debug({
            sql,
            durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
            ...fields,
        }, 'sql');
    }
}
