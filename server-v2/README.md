# server-v2

## PostgreSQL для локальной разработки

PostgreSQL работает в Docker Desktop, а не как системный сервис Ubuntu.
Docker Desktop должен иметь включённую WSL Integration для Ubuntu.

Создайте локальное окружение и запустите контейнер:

```bash
cd server-v2
cp .env.example .env
docker compose up -d
docker compose ps
```

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
