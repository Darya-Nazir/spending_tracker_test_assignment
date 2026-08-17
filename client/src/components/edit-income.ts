import { EditCard } from "./base-class/edit-card";
import {RoutePath} from "../types/route-type";
import {API_URL} from "../constants/api";

export class EditIncome extends EditCard {
    constructor(navigateTo: (path: RoutePath) => void) {
        super(navigateTo, `${API_URL}/categories/income`, '/incomes');
    }
}

