import { NewCard } from "./base-class/new-card";
import {RoutePath} from "../types/route-type";
import {API_URL} from "../constants/api";

export class NewIncome extends NewCard {
    constructor(navigateTo: (path: RoutePath) => void) {
        super(navigateTo, `${API_URL}/categories/income`, '/incomes');
    }
}

