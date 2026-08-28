# server-v2

## PostgreSQL для локальной разработки

PostgreSQL работает в Docker Desktop, а не как системный сервис Ubuntu.
Docker Desktop должен иметь включённую WSL Integration для Ubuntu.

Контейнер создаёт две базы:

- `spending_dev` — локальная разработка;
- `spending_test` — интеграционные тесты и миграции тестовой базы.

Обе доступны из WSL через `localhost:5432`. Данные хранятся в именованном
Docker volume `spending_tracker_postgres_data` и сохраняются при остановке или
пересоздании контейнера.

Остановить PostgreSQL без удаления данных:

```bash
docker compose stop
```

Удалить контейнер и сеть, сохранив данные:

```bash
docker compose down
```

Команда `docker compose down -v` удаляет обе локальные базы без возможности
восстановления из этого volume.


Быстро проверить, что докер работает:
docker compose ps
логи в реальном времени:
docker compose logs -f postgres     

docker compose up -d 
эта команда приводит состояние докера в соответствие с compose.yaml. 

## SQL-логи PostgreSQL

SQL-запросы логирует сам PostgreSQL. PostgreSQL пишет их в
`stderr` контейнера, откуда их показывает Docker:

```bash
docker compose logs -f postgres
```

Режим задаётся в `.env` через `POSTGRES_LOG_MIN_DURATION_MS`:

- `-1` — SQL-логи выключены (значение по умолчанию);
- `0` — логируются все завершённые запросы;
- `100` — логируются запросы длительностью от 100 мс.

После изменения пересоздайте только контейнер PostgreSQL. Именованный volume с
базами при этом сохраняется:

```bash
docker compose up -d --force-recreate postgres
```

Значения bind-параметров в SQL-логи не попадают.
Docker хранит не более трёх файлов логов по 10 МБ для контейнера PostgreSQL.

## Миграции

Миграции хранятся в `migrations` как обычные SQL-файлы. `node-pg-migrate`
отвечает за порядок запуска, транзакции и таблицу применённых миграций.

Создать следующую миграцию:

```bash
npm run db:migration:create -- migration-name
```

Команда создаёт файл с числовым префиксом и секциями `-- Up Migration` и
`-- Down Migration`. Применить миграции или откатить последнюю:

```bash
npm run db:migrate
npm run db:rollback
```

Для тестовой базы:

```bash
npm run db:migrate:test
```
