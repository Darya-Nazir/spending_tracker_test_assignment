import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CategoryTitleService } from '../../src/modules/categories/category-title.service.ts';

describe('CategoryTitleService', () => {
    test('normalize lowercases Latin and Cyrillic letters', () => {
        // normalize переводит латинские и кириллические буквы в нижний регистр
        const service = new CategoryTitleService();

        const normalizedTitle = service.normalize('ЕДА and CaFÉ');

        assert.equal(normalizedTitle, 'еда and café');
    });
});
