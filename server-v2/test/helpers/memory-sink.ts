import { Writable } from 'node:stream';

/**
 * Логгер пишет не в process.stdout напрямую, а в поток, переданный аргументом.
 * Это единственная уступка тестируемости во всём модуле — и она же пригодится
 * в проде, если вывод когда-нибудь придётся увести не в stdout.
 *
 * Для логгера этот сток неотличим от настоящего stdout: тот тоже Writable.
 * Никакой ветки «а если мы в тесте» в коде логгера нет и не будет.
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
     * pino-pretty прогоняет записи через Transform-поток, то есть строка
     * доезжает до стока не в том же тике, в котором её записали. Несколько
     * оборотов очереди макрозадач уравнивают быстрый (NDJSON) и медленный
     * (pretty) путь, так что тесты обоих режимов пишутся одинаково.
     */
    async text(): Promise<string> {
        for (let i = 0; i < 3; i += 1) {
            await new Promise((resolve) => setImmediate(resolve));
        }
        return Buffer.concat(this.#chunks).toString('utf8');
    }

    /** Тот же вывод в форме NDJSON: одна строка — одна запись. */
    async lines(): Promise<string[]> {
        const text = await this.text();
        return text.split('\n').filter((line) => line.trim() !== '');
    }

    /** Разобранные JSON-записи. В pretty-режиме бессмысленно — там не JSON. */
    async records(): Promise<Record<string, unknown>[]> {
        const lines = await this.lines();
        return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    }
}
