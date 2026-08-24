import { Config } from './config/config.ts';
import { Database } from './db/database.ts';
import { AppFactory } from './http/app.ts';
import { Logger } from './logging/logger.ts';

/**
 * Единственный файл, который вызывает listen() и process.exit().
 */

const loadConfig = (): Config => {
    try {
        return Config.load();
    } catch (error) {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exit(1);
    }
};

const config = loadConfig();
const logger = Logger.create(config);

// Пул создаётся до listen(), но соединение не открывает: при выключенной
// базе процесс всё равно поднимается и отвечает 503 на /ready. Закрытие
// пула по SIGTERM — этап 23.
const database = new Database(config, logger);

const app = new AppFactory(config, logger, database).build();

// Колбэк в app.listen() не передаётся намеренно: express 5 вешает его не только
// на событие listening, но и на error (lib/application.js), поэтому на занятом
// порту он вызвался бы тоже и записал бы в лог успешный старт.
const server = app.listen(config.port);

server.on('listening', () => {
    // Порт берётся у самого сокета, а не из конфига: в логе должно быть то,
    // что сервер занял на самом деле.
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : config.port;

    logger.info({ port, nodeEnv: config.nodeEnv }, 'server listening');
});

// Порт занят другим процессом — частый случай, пока рядом работает старый server/.
server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
        logger.error({ port: config.port }, 'port is already in use');
    } else {
        logger.error({ err: { name: error.name, message: error.message } }, 'server failed to start');
    }

    process.exit(1);
});
