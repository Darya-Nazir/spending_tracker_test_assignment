import { after, beforeEach } from 'node:test';

import { Config } from '../../src/config/config.ts';
import { Database } from '../../src/db/database.ts';
import { Logger } from '../../src/logging/logger.ts';
import { MemorySink } from './memory-sink.ts';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgres://spending:spending@localhost:5432/spending_test';

type DatabaseNameRow = {
    database_name: string;
};

type TableNameRow = {
    qualified_name: string;
};

export type TestDatabaseContext = {
    config: Config;
    database: Database;
    logger: Logger;
    sink: MemorySink;
};

/**
 * Собирает зависимости для тестовой базы
 * Нужен тестам, которые намеренно создают отдельный pool.
 */
export const createTestDatabase = (
    databaseUrl: string = TEST_DATABASE_URL,
): TestDatabaseContext => {
    const config = Config.load({
        NODE_ENV: 'test',
        PORT: '3000',
        LOG_LEVEL: 'debug',
        DATABASE_URL: databaseUrl,
    });
    const sink = new MemorySink();
    const logger = Logger.create(config, sink);
    const database = new Database(config, logger);

    return { config, database, logger, sink };
};

/** Не позволяет очистить development/production базу из-за ошибки в окружении. */
export const assertTestDatabaseName = (databaseName: string): void => {
    if (!databaseName.endsWith('_test')) {
        throw new Error(
            `Refusing to reset database "${databaseName}": its name must end with "_test"`,
        );
    }
};

/**
 * Очищает все прикладные таблицы и сбрасывает identity-последовательности.
 * Список читается из information_schema, поэтому новые миграции не требуют
 * поддерживать этот helper вручную. Таблица истории миграций сохраняется.
 */
export const resetDb = async (database: Database): Promise<void> => {
    const { rows: databaseNameRows } = await database.query<DatabaseNameRow>(
        'select current_database() as database_name',
    );
    const databaseName = databaseNameRows[0]?.database_name;

    if (databaseName === undefined) {
        throw new Error('PostgreSQL did not return the current database name');
    }

    assertTestDatabaseName(databaseName);

    const { rows: tableNameRows } = await database.query<TableNameRow>(
        `select format('%I.%I', table_schema, table_name) as qualified_name
           from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'
            and table_name <> 'pgmigrations'
          order by table_name`,
    );

    if (tableNameRows.length === 0) {
        return;
    }

    const tableNames = tableNameRows.map(({ qualified_name }) => qualified_name).join(', ');
    await database.query(`truncate table ${tableNames} restart identity cascade`);
};

/**
 * Один вызов на верхнем уровне тестового файла: до каждого теста база чистая,
 * после файла pool закрыт и node:test может завершить процесс.
 */
export const useTestDatabase = (): TestDatabaseContext => {
    const context = createTestDatabase();

    beforeEach(async () => {
        await resetDb(context.database);
    });

    after(async () => {
        await context.database.close();
    });

    return context;
};
