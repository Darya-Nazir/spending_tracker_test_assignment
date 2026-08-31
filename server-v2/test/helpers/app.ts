import type { Express } from 'express';

import { AppFactory } from '../../src/http/app.ts';
import type { TestDatabaseContext } from './db.ts';
import { useTestDatabase } from './db.ts';

export type TestAppContext = TestDatabaseContext & {
    app: Express;
};

/** Собирает приложение один раз на тестовый файл и подключает DB-хуки. */
export const useTestApp = (): TestAppContext => {
    const context = useTestDatabase();
    const app = new AppFactory(
        context.config,
        context.logger,
        context.database,
    ).build();

    return { ...context, app };
};
