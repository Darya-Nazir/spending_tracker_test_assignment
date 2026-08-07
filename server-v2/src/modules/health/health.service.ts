/**
 * Проверка, что процесс жив и обслуживает запросы. В базу не ходит.
 *
 * Проверка внешних зависимостей — это /ready, она появится здесь на этапе 4
 * и будет опрашивать пул Postgres.
 */

export type Health = { status: 'ok' };

export class HealthService {
    check(): Health {
        return { status: 'ok' };
    }
}
