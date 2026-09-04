declare const normalizedCategoryTitleBrand: unique symbol;

export type NormalizedCategoryTitle = string & {
    readonly [normalizedCategoryTitleBrand]: true;
};

export class CategoryTitleService {
    normalize(title: string): NormalizedCategoryTitle {
        return title.toLowerCase() as NormalizedCategoryTitle;
    }
}
