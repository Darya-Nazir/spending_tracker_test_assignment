import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../../src/config/config.ts';
import { Logger } from '../../src/logging/logger.ts';
import { Database } from '../../src/db/database.ts';
import { MemorySink } from '../helpers/memory-sink.ts';

process.env.TZ = 'Pacific/Auckland';

const DATABASE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgres://spending:spending@localhost:5432/spending_test';

const config = Config.load({
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'debug',
    DATABASE_URL,
});
const database = new Database(config, Logger.create(config, new MemorySink()));

// Пока соединения открыты, node:test не выходит после последнего теста.
after(async () => {
    await database.close();
});

describe('pg type coercion', () => {

    test('numeric values are summed by Postgres and arrive as an exact number', async () => {
        // сумма нескольких numeric считается в SQL и приходит точным числом
        const { rows } = await database.query<{ total: number }>(
            `select sum(amount) as total
               from (values (0.10::numeric(14,2)), (0.20)) source(amount)`,
        );
        const [row] = rows;
        assert.ok(row, 'запрос должен вернуть одну строку');

        assert.equal(typeof row.total, 'number', 'sum() тоже numeric, OID тот же');
        assert.equal(row.total, 0.3);
    });

    test('the same values added up in JS are not exact', async () => {
        // те же значения, сложенные в JS, точными не являются
        //
        // Проверка самой проверки для теста выше: показывает, что sum() в SQL
        // выбран не из удобства. Утверждение о семантике float64, а не о нашем
        // коде, поэтому оно и не должно чиниться приведением типов — от него
        // защищает только то, что складывание остаётся в базе.
        const { rows } = await database.query<{ amount: number }>(
            `select amount
               from (values (0.10::numeric(14,2)), (0.20)) source(amount)`,
        );
        assert.equal(rows.length, 2);

        const total = rows.reduce((accumulated, row) => accumulated + row.amount, 0);

        assert.equal(typeof total, 'number', 'без парсера + склеивает строки: "00.100.20"');

        assert.notEqual(total, 0.3, 'сложение в JS оказалось точным — тест выше ничего не охраняет');
        assert.equal(total, 0.30000000000000004);
    });

    test('the largest value numeric(14,2) allows survives the coercion', async () => {
        // наибольшее значение numeric(14,2) переживает приведение без потерь
        //
        // Предел схемы: 14 значащих цифр, 2 после точки. В копейках это
        // 99999999999999 — меньше Number.MAX_SAFE_INTEGER (9007199254740991),
        // поэтому одно значение любой допустимой величины Number передаёт
        // точно. Терять есть что только на сложении.
        const { rows } = await database.query<{ amount: number }>(
            'select 999999999999.99::numeric(14,2) as amount',
        );
        const [row] = rows;
        assert.ok(row, 'запрос должен вернуть одну строку');

        assert.equal(row.amount, 999999999999.99);
    });

    test('a date column is returned as the stored YYYY-MM-DD string in any timezone', async () => {
        // date-колонка возвращается строкой 'YYYY-MM-DD' в любой таймзоне

        // Проверка самой проверки: если TZ не применилась, тест зеленел бы
        // и без парсера, потому что сдвигать было бы нечего.
        assert.equal(
            new Date(2026, 7, 24).toISOString().slice(0, 10),
            '2026-08-23',
            'TZ=Pacific/Auckland не применилась, тест ничего не проверяет',
        );

        const { rows } = await database.query<{ day: string }>(
            "select '2026-08-24'::date as day",
        );
        const [row] = rows;
        assert.ok(row, 'запрос должен вернуть одну строку');

        assert.equal(typeof row.day, 'string', 'без парсера pg отдаёт объект Date');
        assert.equal(row.day, '2026-08-24');
    });
});
