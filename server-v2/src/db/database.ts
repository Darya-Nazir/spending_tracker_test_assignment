import { Pool, type QueryResult, type QueryResultRow } from 'pg';

import type { Config } from '../config/config.ts';
import type { LogFields, Logger } from '../logging/logger.ts';

/**
 * Единственное место, где создаётся pg.Pool. Репозитории получают этот объект
 * и вызывают query(); пакет pg больше нигде не импортируется.
 *
 * Pool, а не Client: Client — это одно соединение, и параллельные запросы
 * выполняются на нём по очереди. Pool держит несколько соединений и выдаёт
 * свободное, а установка нового соединения занимает больше времени, чем сам
 * запрос.
 *
 * SQL пишется общим логгером, а не req.log: у Database нет объекта запроса,
 * поэтому в этих строках нет поля requestId и найти по нему SQL конкретного
 * HTTP-запроса нельзя. На этапе 23 req.log попадёт сюда через
 * AsyncLocalStorage; передавать логгер параметром в каждый метод каждого
 * репозитория не будем.
 */

/** Запрос для проверки соединения: не читает таблиц и не берёт блокировок. */
const PING = 'select 1';

export class Database {
    readonly #pool: Pool;
    readonly #logger: Logger;

    constructor(config: Config, logger: Logger) {
        this.#logger = logger;

        // Соединение открывается не здесь, а при первом query(). Поэтому
        // процесс поднимается и при выключенной базе — она нужна только
        // для ответа на /ready.
        this.#pool = new Pool({ connectionString: config.databaseUrl });

        // Соединение может закрыться, пока простаивает в пуле: базу
        // перезапустили или разорвалась сеть. Pool сообщает об этом событием
        // 'error' и на следующем query() открывает новое соединение.
        // Событие 'error' без слушателя Node считает необработанной ошибкой
        // и завершает процесс, поэтому слушатель нужен даже такой — только
        // для записи в лог.
        this.#pool.on('error', (error) => {
            this.#logger.error({ err: error }, 'idle database client failed');
        });
    }

    /**
     * Значения передаются вторым аргументом и подставляются в placeholder-ы
     * $1, $2, ... на стороне pg. Вставлять их в текст SQL самим нельзя:
     * значение вида "1; drop table users" тогда выполнится как SQL.
     */
    async query<T extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: readonly unknown[] = [],
    ): Promise<QueryResult<T>> {
        const startedAt = performance.now();

        try {
            const result = await this.#pool.query<T>(sql, [...params]);
            this.#logQuery(sql, startedAt, { rows: result.rowCount });

            return result;
        } catch (error) {
            // Запись нужна и для упавшего запроса: текст ошибки pg не
            // содержит SQL, и без этой строки в логе не видно, что
            // выполнялось. Уровень debug, а не error: ошибку обрабатывает
            // вызывающий код, он и решает, какой у неё уровень.
            this.#logQuery(sql, startedAt, { failed: true });

            throw error;
        }
    }

    /**
     * Отвечает ли база на PING. Возвращает false вместо исключения: результат
     * идёт в тело ответа /ready и обработку запроса не прерывает.
     */
    async isReachable(): Promise<boolean> {
        try {
            await this.query(PING);

            return true;
        } catch (error) {
            // warn, а не error: недоступная база — предусмотренный ответ 503,
            // а не ошибка в коде. Пока база стартует, такая строка пишется на
            // каждый опрос /ready, и на уровне error эти строки попадали бы
            // в отчёты об ошибках.
            this.#logger.warn({ err: error }, 'database is not reachable');

            return false;
        }
    }

    /**
     * Закрывает все соединения пула. Пока они открыты, в event loop остаются
     * активные сокеты: процесс не завершается сам, а node:test не выходит
     * после последнего теста.
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
