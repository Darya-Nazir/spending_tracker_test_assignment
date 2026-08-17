import { CardPage } from "./base-class/card-page";
import {RoutePath} from "../types/route-type";
import {Validator} from "../services/validator";
import {API_URL} from "../constants/api";

export class Incomes extends CardPage {
    constructor(navigateTo: (path: RoutePath) => void) {
        super(
            navigateTo,
            'incomesContainer',
            `${API_URL}/categories/income`,
            '/create-income',
            '/edit-income',
        );
    }

    public highlightPage(): void {
        const categoriesElement: HTMLElement | null = document.getElementById('dropdownMenuButton1');
        const revenuesElement: HTMLElement | null = document.getElementById('revenuesPage');

        if (Validator.areElementsMissing(categoriesElement, revenuesElement)) return;

        categoriesElement!.classList.add('btn-primary', 'text-white');
        revenuesElement!.classList.add('bg-primary', 'text-white');
    }
}

