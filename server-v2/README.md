# server-v2

## Docker

Быстро проверить, что докер работает:
docker compose ps
логи в реальном времени:
docker compose logs -f postgres     

docker compose up -d 
эта команда приводит состояние докера в соответствие с compose.yaml. 

## PostgreSQL

Список всех таблиц
docker compose exec postgres psql -U spending -d spending_test -c '\dt'

Структура таблицы, например categories
docker compose exec postgres psql -U spending -d spending_test -c '\d categories'

Содержимое таблицы
docker compose exec postgres psql -U spending -d spending_test -c 'select * from categories;'


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

Применить миграции или откатить последнюю:

```bash
npm run db:migrate
npm run db:rollback
```

Для тестовой базы:

```bash
npm run db:migrate:test
```
Посмотреть применённые миграции
docker compose exec postgres psql -U spending -d spending_dev \
  -c 'select * from pgmigrations order by id;'

docker compose exec postgres psql -U spending -d spending_test \
  -c 'select * from pgmigrations order by id;'

## Тесты

Полный прогон сам применяет миграции к `spending_test`, затем запускает файлы
последовательно:

```bash
npm test
```
запустить конкретный тест
Из папки server-v2:
npm run db:migrate:test && node --test --test-concurrency=1 {ptest path}

Если тестовая база уже мигрирована, достаточно:
node --test test/integration/isolation.test.ts
