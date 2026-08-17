import { CardPage } from "./base-class/card-page";
import {RoutePath} from "../types/route-type";
import {Validator} from "../services/validator";
import {API_URL} from "../constants/api";

export class Costs extends CardPage {
    constructor(navigateTo: (path: RoutePath) => void) {
        super(
            navigateTo,
            'costsContainer',
            `${API_URL}/categories/expense`,
            '/create-cost',
            '/edit-cost',
        );
    }

    public highlightPage(): void {
        const categoriesElement: HTMLElement | null = document.getElementById('dropdownMenuButton1');
        const costsElement: HTMLElement | null = document.getElementById('costsPage');

        if (Validator.areElementsMissing(categoriesElement, costsElement)) return;

        categoriesElement!.classList.add('btn-primary', 'text-white');
        costsElement!.classList.add('bg-primary', 'text-white');
    }
}

