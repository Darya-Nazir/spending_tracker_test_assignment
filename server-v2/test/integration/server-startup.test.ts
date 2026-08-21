import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const SERVER_ENTRY = fileURLToPath(new URL('../../src/server.ts', import.meta.url));

/** Не 3000: там может работать старый server/ или dev-запуск этого. */
const PORT = 3211;

/** Сервер на старте в базу не ходит, но Config требует адрес. */
const DATABASE_URL = 'postgres://spending:spending@localhost:5432/spending_test';

/** Порт, который тест занимает сам, чтобы проверить поведение при конфликте. */
const BUSY_PORT = 3212;

type LogRecord = Record<string, unknown>;

/** Дочерний процесс сервера и то, что он записал в stdout и stderr. */
type RunningServer = {
    child: ChildProcess;
    /** Всё, что процесс написал в stdout: сюда идут логи. */
    stdout: () => string;
    /** Логи идут в stdout; в stderr попадает только аварийный вывод самого Node. */
    stderr: () => string;
    /** Процесс уже завершился? Проверяется, чтобы не ждать строку лога до таймаута. */
    hasExited: () => boolean;
    /**
     * Ждёт в stdout строку NDJSON, подходящую под условие. Строка ищется
     * опросом, а не по событию 'data': запись может прийти несколькими кусками.
     */
    waitForRecord: (matches: (record: LogRecord) => boolean, timeoutMs?: number) => Promise<LogRecord>;
};

const startServer = (env: Record<string, string>): RunningServer => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let exited = false;

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr?.on('data', (chunk: string) => { stderr += chunk; });
    child.on('exit', () => { exited = true; });

    const server: RunningServer = {
        child,
        stdout: () => stdout,
        stderr: () => stderr,
        hasExited: () => exited,

        async waitForRecord(matches, timeoutMs = 10_000) {
            const deadline = Date.now() + timeoutMs;

            while (Date.now() < deadline) {
                for (const line of stdout.split('\n')) {
                    if (line.trim() === '') {
                        continue;
                    }

                    try {
                        const record = JSON.parse(line) as LogRecord;
                        if (matches(record)) {
                            return record;
                        }
                    } catch {
                        // Строка ещё не дописана до конца — ждём следующего оборота.
                    }
                }

                if (exited) {
                    throw new Error(
                        `Процесс завершился, не написав ожидаемой строки.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
                    );
                }

                await new Promise((resolve) => setTimeout(resolve, 25));
            }

            throw new Error(`Не дождались строки лога за ${timeoutMs} мс.\nstdout:\n${stdout}`);
        },
    };

    return server;
};

const stop = async (server: RunningServer): Promise<void> => {
    if (server.hasExited()) {
        return;
    }

    server.child.kill('SIGTERM');
    await once(server.child, 'exit');
};

describe('server startup', () => {

    test('starts, reports the port it listens on, and serves /health', { timeout: 20_000 }, async () => {
        // поднимается, сообщает порт, на котором слушает, и обслуживает /health
        const server = startServer({
            NODE_ENV: 'production',
            PORT: String(PORT),
            LOG_LEVEL: 'info',
            DATABASE_URL,
        });

        try {
            const startup = await server.waitForRecord((record) => record.msg === 'server listening');

            assert.equal(startup.level, 'info', 'старт — событие бизнес-логики, уровень info');
            assert.equal(startup.port, PORT, 'порт взят из конфига, а не задан в коде');

            const response = await fetch(`http://127.0.0.1:${PORT}/health`);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { status: 'ok' });

            assert.equal(server.hasExited(), false, `процесс должен быть жив:\n${server.stderr()}`);
            assert.doesNotMatch(server.stderr(), /Error/, `в stderr не должно быть ошибок:\n${server.stderr()}`);
        } finally {
            await stop(server);
        }
    });

    test('does not report a successful start when the port is taken', { timeout: 20_000 }, async () => {
        // не сообщает об успешном старте, когда порт занят
        //
        // express 5 вешает колбэк, переданный в app.listen(), не только на
        // событие listening, но и на error. Колбэк, который игнорирует свой
        // аргумент, поэтому пишет «server listening» на занятом порту.
        const blocker = createServer();
        await new Promise<void>((resolve) => { blocker.listen(BUSY_PORT, resolve); });

        const server = startServer({
            NODE_ENV: 'production',
            PORT: String(BUSY_PORT),
            LOG_LEVEL: 'info',
            DATABASE_URL,
        });

        try {
            const [code] = await once(server.child, 'exit') as [number | null];
            const output = server.stdout();

            assert.match(output, /port is already in use/, `вывод:\n${output}`);
            assert.doesNotMatch(output, /server listening/, `сервер не слушает, значит и строки быть не должно:\n${output}`);
            assert.equal(code, 1, 'выход с кодом 1');
        } finally {
            await stop(server);
            await new Promise((resolve) => blocker.close(resolve));
        }
    });
});
