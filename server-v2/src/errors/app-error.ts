/**
 * Ошибки, которые код бросает намеренно. У каждой есть код HTTP-статуса,
 * и по нему ErrorHandler формирует ответ.
 *
 * Слои ниже HTTP (сервисы, репозитории) бросают эти классы и не работают
 * с объектами req и res. Всё, что не является AppError, обработчик считает
 * непредвиденным сбоем и отвечает 500.
 *
 * Классы лежат в одном файле: тело каждого — одна строка.
 */
export class AppError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        // Иначе во всех наследниках name остался бы 'Error'.
        this.name = new.target.name;
        this.status = status;
    }
}

/** 400. Тело или query-параметры не прошли проверку. */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

/** 401. Нет токена, токен недействителен или пара email + пароль не подошла. */
export class UnauthorizedError extends AppError {
    constructor(message: string) {
        super(message, 401);
    }
}

/**
 * 404. Роут не существует, или запрошенная строка не принадлежит этому
 * пользователю. Чужие данные отдают 404, а не 403: 403 подтвердил бы,
 * что строка с таким id существует.
 */
export class NotFoundError extends AppError {
    constructor(message: string) {
        super(message, 404);
    }
}

/** 409. Строка нарушает уникальность: занятый email, повтор названия категории. */
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409);
    }
}
