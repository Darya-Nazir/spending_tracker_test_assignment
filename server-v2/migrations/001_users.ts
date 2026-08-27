import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
    pgm.createTable('users', {
        id: 'id',
        email: {
            type: 'text',
            notNull: true,
        },
        name: {
            type: 'text',
            notNull: true,
        },
        password_hash: {
            type: 'text',
            notNull: true,
        },
        initial_balance: {
            type: 'numeric(14,2)',
            notNull: true,
            default: 0,
        },
        created_at: {
            type: 'timestamptz',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    pgm.sql(
        'create unique index users_email_lower_unique on users (lower(email))',
    );
}

export function down(pgm: MigrationBuilder): void {
    pgm.dropTable('users');
}
