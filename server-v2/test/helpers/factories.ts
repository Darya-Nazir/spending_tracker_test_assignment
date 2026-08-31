import type { Database } from '../../src/db/database.ts';

let userSequence = 0;

export type TestUserInput = {
    email: string;
    name: string;
    passwordHash: string;
    initialBalance: number;
};

export type PersistedTestUser = TestUserInput & {
    id: number;
};

export type TestUserOverrides = Partial<TestUserInput>;

/** Возвращает уникальные валидные данные пользователя без записи в БД. */
export const makeUser = (overrides: TestUserOverrides = {}): TestUserInput => {
    userSequence += 1;

    return {
        email: `test-user-${process.pid}-${userSequence}@example.test`,
        name: 'Test User',
        passwordHash: 'not-a-real-password-hash',
        initialBalance: 0,
        ...overrides,
    };
};

/** Создаёт пользователя и возвращает выданный базой числовой id. */
export const createUser = async (
    database: Database,
    overrides: TestUserOverrides = {},
): Promise<PersistedTestUser> => {
    const user = makeUser(overrides);
    const { rows } = await database.query<{
        id: number;
        email: string;
        name: string;
        password_hash: string;
        initial_balance: number;
    }>(
        `insert into users (email, name, password_hash, initial_balance)
         values ($1, $2, $3, $4)
         returning id, email, name, password_hash, initial_balance`,
        [user.email, user.name, user.passwordHash, user.initialBalance],
    );
    const persisted = rows[0];

    if (persisted === undefined || typeof persisted.id !== 'number') {
        throw new Error('User factory did not receive a numeric id from PostgreSQL');
    }

    return {
        id: persisted.id,
        email: persisted.email,
        name: persisted.name,
        passwordHash: persisted.password_hash,
        initialBalance: persisted.initial_balance,
    };
};
