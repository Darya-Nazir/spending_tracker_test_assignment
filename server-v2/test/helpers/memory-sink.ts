import { Writable } from 'node:stream';

/**
 * Writable, который не пишет никуда наружу, а накапливает полученные байты
 * в массиве в памяти процесса. Ни файла, ни вывода в терминал не создаётся.
 *
 * Logger.create() вторым аргументом принимает Writable; по умолчанию это
 * process.stdout, который тоже Writable. Тест подставляет сюда этот класс
 * и потом читает записанное. Отдельной ветки для тестов в логгере нет.
 *
 * Очистки нет: каждый тест создаёт новый экземпляр, старый удаляет сборщик
 * мусора. Между тестами записи не накапливаются.
 */
export class MemorySink extends Writable {
    #chunks: Buffer[] = [];

    override _write(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        done: (error?: Error | null) => void,
    ): void {
        this.#chunks.push(Buffer.from(chunk));
        done();
    }

    /**
     * Всё записанное одной строкой.
     *
     * Перед чтением уступает очередь событий три раза. В режиме development
     * логгер пишет через Transform-поток pino-pretty, и строка доходит до
     * этого стока на следующих тиках, а не в тике вызова logger.info().
     */
    async text(): Promise<string> {
        for (let i = 0; i < 3; i += 1) {
            await new Promise((resolve) => setImmediate(resolve));
        }
        return Buffer.concat(this.#chunks).toString('utf8');
    }

    /** Записанное, разбитое по переводам строки; пустые строки отброшены. */
    async lines(): Promise<string[]> {
        const text = await this.text();
        return text.split('\n').filter((line) => line.trim() !== '');
    }

    /** Строки, разобранные через JSON.parse. Для режима development не подходит. */
    async records(): Promise<Record<string, unknown>[]> {
        const lines = await this.lines();
        return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    }
}
