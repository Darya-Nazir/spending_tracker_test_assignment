import type { Database } from '../../db/database.ts';

type UserRow = {
    id: number;
    email: string;
    name: string;
    password_hash: string;
    initial_balance: number;
    created_at: Date;
};

export type User = {
    id: number;
    email: string;
    name: string;
    passwordHash: string;
    initialBalance: number;
    createdAt: Date;
};

export class UserRepository {
    readonly #database: Database;

    constructor(database: Database) {
        this.#database = database;
    }

    async findByEmail(email: string): Promise<User | null> {
        const { rows } = await this.#database.query<UserRow>(
            `select id, email, name, password_hash, initial_balance, created_at
               from users
              where lower(email) = lower($1)`,
            [email],
        );
        const row = rows[0];

        if (row === undefined) {
            return null;
        }

        return {
            id: row.id,
            email: row.email,
            name: row.name,
            passwordHash: row.password_hash,
            initialBalance: row.initial_balance,
            createdAt: row.created_at,
        };
    }
}
