import { NewCard } from "./base-class/new-card";
import { DatePickerManager } from "../services/date-picker";
import { Http } from "../services/http";
import {RoutePath} from "../types/route-type";
import {Validator} from "../services/validator";
import {TransactionData} from "../types/transaction-type";
import {Category} from "../types/category-type";
import {API_URL} from "../constants/api";

export class NewTransaction extends NewCard {
    private typeInput: HTMLInputElement | null;
    private categoryInput: HTMLInputElement | null;
    private amountInput: HTMLInputElement | null;
    private dateInput: HTMLInputElement | null;
    private commentInput: HTMLInputElement | null;
    private createButton: HTMLButtonElement | null;
    private cancelButton: HTMLButtonElement | null;
    private categoriesList: HTMLElement | null;
    private datePickerManager: DatePickerManager = new DatePickerManager();
    private selectedCategoryId: string | null = null;


    constructor(navigateTo: (path: RoutePath) => void) {
        super(
            navigateTo,
            `${API_URL}/operations`,
            'transactions' as RoutePath
        );

        // Инициализация всех элементов формы
        this.typeInput = document.querySelector('input[placeholder="Тип..."]');
        this.categoryInput = document.getElementById('categoryInput') as HTMLInputElement;
        this.amountInput = document.querySelector('input[placeholder="Сумма в $..."]');
        this.dateInput = document.querySelector('input[placeholder="Дата..."]');
        this.commentInput = document.querySelector('input[placeholder="Комментарий..."]');
        this.createButton = document.getElementById('create') as HTMLButtonElement;
        this.cancelButton = document.getElementById('cancel') as HTMLButtonElement;
        this.categoriesList = document.getElementById('categoriesList');

        this.datePickerManager = new DatePickerManager();
    }

    public async init(): Promise<void> {
        this.setInitialType();
        if (this.dateInput) {
            this.datePickerManager.init(this.dateInput);
        }
        await this.loadCategories();

        // Установка обработчиков событий
        if (Validator.areElementsMissing(
            this.createButton,
            this.cancelButton,
            this.categoryInput
        )) return;
        this.createButton!.addEventListener('click', (event) => this.handleTransactionCreation(event));
        this.cancelButton!.addEventListener('click', () => this.handleCancel());
        this.categoryInput!.addEventListener('focus', () => this.showCategories());
        this.categoryInput!.addEventListener('blur', () => setTimeout(() => this.hideCategories(), 150));
    }

    // Обработка нажатия кнопки отмены
    private handleCancel(): void {
        this.navigateToPath('transactions' as RoutePath);
    }

    // Обработка создания новой транзакции
    private async handleTransactionCreation(event: MouseEvent): Promise<void> {
        event.preventDefault();

        const transactionData: TransactionData | undefined = this.getTransactionData();

        if (!transactionData) return;
        if (!this.validateTransactionData(transactionData)) {
            return;
        }

        try {
            await Http.request(this.apiUrl, 'POST', transactionData);
            this.navigateToPath('transactions' as RoutePath);
        } catch (error) {
            console.error('Transaction creation error:', error);
            alert('Не удалось создать операцию. Пожалуйста, проверьте введенные данные и попробуйте снова.');
        }
    }

    // Сбор данных из формы
    private getTransactionData(): TransactionData | undefined {
        const typeMapping: Record<string, 'income' | 'expense'> = {
            'Доход': 'income',
            'Расход': 'expense'
        };

        if (Validator.areElementsMissing(
            this.typeInput,
            this.amountInput,
            this.dateInput,
            this.commentInput
        )) return;

        return {
            type: typeMapping[this.typeInput!.value] || this.typeInput!.value.toLowerCase(),
            amount: parseFloat(this.amountInput!.value) || 0, // Указываем 0, если значение некорректное
            date: this.datePickerManager.formatDateForAPI(this.dateInput!.value), // Форматируем дату для сервера
            comment: this.commentInput!.value.trim() || '', // Указываем пустую строку, если комментарий не указан
            category_id: this.selectedCategoryId ? parseInt(this.selectedCategoryId, 10) : null // Приводим ID категории к числу
        };
    }

    // Валидация данных формы
    private validateTransactionData(data: TransactionData): boolean {
        if (!['income', 'expense'].includes(data.type)) {
            alert('Тип должен быть "income" или "expense"');
            return false;
        }

        if (isNaN(data.amount) || data.amount <= 0) {
            alert('Введите корректную сумму');
            return false;
        }

        if (!this.dateInput?.value) {
            alert('Выберите дату');
            return false;
        }

        if (!this.selectedCategoryId) {
            alert('Выберите категорию');
            return false;
        }

        return true;
    }

    // Загрузка категорий с сервера
    private async loadCategories(): Promise<void> {
        if (!this.typeInput) return;

        const type: 'income' | 'expense' = this.typeInput.value === 'Доход' ? 'income' : 'expense';
        const apiUrl = `${API_URL}/categories/${type}`;
        try {
            const categories = await Http.request(apiUrl, 'GET');
            this.renderCategories(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Отрисовка списка категорий
    private renderCategories(categories: Category[]): void {
        if (!this.categoriesList) return;

        this.categoriesList.innerHTML = categories.map((category: Category) => `
            <li>
                <button
                    type="button"
                    class="dropdown-item"
                    data-id="${category.id}">
                    ${category.title}
                </button>
            </li>
        `).join('');

        this.categoriesList.querySelectorAll('.dropdown-item')
            .forEach((item: Element) => {
                (item as HTMLButtonElement).addEventListener('click', (event: MouseEvent): void =>
                    this.handleCategorySelect(event));
            });
    }

    // Обработка выбора категории
    private handleCategorySelect(event: MouseEvent): void {
        const button = event.target as HTMLButtonElement;
        this.selectedCategoryId = button.getAttribute('data-id');
        if (Validator.areElementsMissing(
            this.categoryInput,
            this.categoriesList,
            button
        )) return;

        this.categoryInput!.value = button.textContent!.trim();
        this.hideCategories();
    }

    // Показать список категорий
    private showCategories(): void {
        if (this.categoriesList) {
            this.categoriesList.style.display = 'block';
        }
    }

    // Скрыть список категорий
    private hideCategories(): void {
        if (this.categoriesList) {
            this.categoriesList.style.display = 'none';
        }
    }

    // Установка начального типа транзакции из URL
    private setInitialType(): void {
        if (!this.typeInput) return;

        const urlParams = new URLSearchParams(window.location.search);
        const type: string | null = urlParams.get('type');

        if (type === 'income' || type === 'expense') {
            this.typeInput!.value = type === 'income' ? 'Доход' : 'Расход';
            this.typeInput!.readOnly = true;
            this.typeInput!.style.backgroundColor = '#f8f9fa';
        }
    }
}

