import type { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '../../errors/app-error.ts';

/**
 * Регистрируется после всех роутеров и до ErrorHandler. Срабатывает, когда
 * ни один роут не подошёл: неизвестный путь или неподдерживаемый метод.
 *
 * Ответ не формирует, а передаёт NotFoundError дальше через next(). Тело
 * ответа собирает ErrorHandler — форма ошибки задаётся в одном месте.
 * Без этого middleware express отдал бы на неизвестный путь HTML-страницу.
 */
export class NotFoundHandler {
    readonly reject = (req: Request, _res: Response, next: NextFunction): void => {
        next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
    };
}
