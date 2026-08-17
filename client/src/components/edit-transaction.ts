import {EditCard} from "./base-class/edit-card";
import {DatePickerManager} from "../services/date-picker";
import {Http} from "../services/http";
import {RoutePath} from "../types/route-type";
import {Operation} from "../types/operations-type";
import {Category} from "../types/category-type";
import {TransactionData} from "../types/transaction-type";
import {Validator} from "../services/validator";
import {API_URL} from "../constants/api";

export class EditTransaction extends EditCard {
    private typeInput: HTMLInputElement | null = null;
    private categoryInput: HTMLInputElement | null = null;
    private amountInput: HTMLInputElement | null = null;
    private dateInput: HTMLInputElement | null = null;
    private commentInput: HTMLInputElement | null = null;
    private categoriesList: HTMLElement | null = null;
    private selectedCategoryId: string | null = null;
    private datePickerManager: DatePickerManager;
    private transactionId: string | null = null;
    private saveButton: HTMLElement | null = document.querySelector('button[type="submit"]');
    private cancelButton: HTMLElement | null = document.getElementById('cancel');
    private typesList: HTMLElement | null = document.querySelector('.type-list');

    constructor(navigateTo: (path: RoutePath) => void) {
        super(
            navigateTo,
            `${API_URL}/operations`,
            'transactions' as RoutePath,
        );

        this.datePickerManager = new DatePickerManager();
    }

    public async init(): Promise<void> {
        const transactionId: string | null = this.getCategoryIdFromUrl();
        if (!transactionId) {
            this.navigateToPath(this.redirectPath);
            return;
        }

        this.transactionId = transactionId;

        // Инициализация элементов формы после загрузки DOM
        if (!this.initializeFormElements()) {
            alert('Ошибка инициализации формы!');
            this.navigateToPath(this.redirectPath);
            return;
        }
        if (this.dateInput) {
            this.datePickerManager.init(this.dateInput);
        }
        await this.loadTransactionData(transactionId);
        this.setupEventListeners();
        this.renderTypes(['income', 'expense']);
    }

    private initializeFormElements() {
        try {
            this.typeInput = document.querySelector('input[name="type"]');
            this.categoryInput = document.querySelector('input[name="category"]');
            this.amountInput = document.querySelector('input[name="amount"]');
            this.dateInput = document.querySelector('input[name="date"]');
            this.commentInput = document.querySelector('input[name="comment"]');
            this.categoriesList = document.querySelector('.categories-list');
            this.saveButton = document.querySelector('button[type="submit"]');
            this.cancelButton = document.getElementById('cancel');
            this.typesList = document.querySelector('.type-list');

            // Проверяем, что все необходимые элементы найдены
            return !!(this.typeInput && this.categoryInput && this.amountInput &&
                this.dateInput && this.commentInput && this.categoriesList &&
                this.saveButton && this.cancelButton);
        } catch (error) {
            console.error('Form elements initialization error:', error);
            return false;
        }
    }

    private setupEventListeners() {
        if (this.saveButton) {
            this.saveButton.addEventListener('click', (event) => this.handleTransactionEdit(event));
        }

        if (this.cancelButton) {
            this.cancelButton.addEventListener('click', () => this.navigateToPath(this.redirectPath));
        }

        if (this.categoryInput && this.categoriesList) {
            this.categoryInput.addEventListener('focus', () => this.showCategories());
            this.categoryInput.addEventListener('blur', () => setTimeout(() => this.hideCategories(), 150));
        }

        if (this.typeInput && this.typesList) {
            this.typeInput.addEventListener('focus', () => this.showTypes());
            this.typeInput.addEventListener('blur', () => setTimeout(() => this.hideTypes(), 150));
        }
    }

    private async loadTransactionData(transactionId: string): Promise<void> {
        try {
            const transaction: Operation = await Http.request<Operation>(`${this.apiUrl}/${transactionId}`, 'GET');
            await this.loadCategories(transaction.type);
            this.fillFormWithTransactionData(transaction);
        } catch (error) {
            console.error('Transaction data loading error:', error);
            alert('Не удалось загрузить данные транзакции!');
            this.navigateToPath(this.redirectPath);
        }
    }

    private async loadCategories(type: 'income' | 'expense'): Promise<void> {
        if (!this.categoriesList) return;

        try {
            const apiUrl = `${API_URL}/categories/${type}`;
            const categories = await Http.request<Category[]>(apiUrl, 'GET');
            this.renderCategories(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    private renderCategories(categories: Category[]): void {
        if (!this.categoriesList) return;

        try {
            this.categoriesList.innerHTML = categories.map((category: Category): string => `
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
                .forEach((item: Element): void => {
                    (item as HTMLButtonElement).addEventListener('click', (event: MouseEvent): void =>
                        this.handleCategorySelect(event));
                });
        } catch (error) {
            console.error('Category rendering error:', error);
        }
    }

    private fillFormWithTransactionData(transaction: Operation): void {
        if (!this.typeInput || !this.amountInput || !this.dateInput ||
            !this.commentInput || !this.categoryInput) return;

        try {
            this.typeInput.value = transaction.type === 'income' ? 'Доход' : 'Расход';
            this.typeInput.readOnly = true;
            this.typeInput.style.backgroundColor = '#f8f9fa';

            this.amountInput.value = transaction.amount.toString();
            this.datePickerManager.setValue(this.dateInput, new Date(transaction.date));
            this.commentInput.value = transaction.comment || '';

            if (this.categoriesList) {
                const categoryButton: Element | undefined =
                    Array.from(this.categoriesList.querySelectorAll('.dropdown-item'))
                    .find((item: Element): boolean =>
                        item.textContent ? item.textContent.trim() === transaction.category : false);

                if (categoryButton) {
                    this.selectedCategoryId = categoryButton.getAttribute('data-id');
                    this.categoryInput.value = categoryButton.textContent!.trim();
                }
            }
        } catch (error) {
            console.error('Error filling form with data:', error);
        }
    }

    private handleCategorySelect(event: MouseEvent): void {
        const button: HTMLElement | null = event.target as HTMLElement;

        if (Validator.areElementsMissing(
            button,
            this.categoryInput
        )) return;

        this.selectedCategoryId = button.getAttribute('data-id');
        this.categoryInput!.value = button.textContent!.trim();
        this.hideCategories();
    }

    private showCategories(): void {
        if (this.categoriesList) {
        this.categoriesList.style.display = 'block';
        }
    }

    private hideCategories(): void {
        if (this.categoriesList) {
        this.categoriesList.style.display = 'none';
        }
    }

    private async handleTransactionEdit(event: MouseEvent): Promise<void> {
        event.preventDefault();

        const transactionData: TransactionData | undefined = this.getTransactionData() as TransactionData;
        if (!this.validateTransactionData(transactionData)) {
            return;
        }

        try {
            await Http.request(
                `${this.apiUrl}/${this.transactionId}`,
                'PUT',
                transactionData
            );
            this.navigateToPath(this.redirectPath);
        } catch (error) {
            console.error('Transaction update error:', error);
            alert('Не удалось обновить транзакцию. Пожалуйста, проверьте введенные данные и попробуйте снова.');
        }
    }

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
            amount: parseFloat(this.amountInput!.value) || 0,
            date: this.datePickerManager.formatDateForAPI(this.dateInput!.value),
            comment: this.commentInput!.value.trim() || '',
            category_id: this.selectedCategoryId ? parseInt(this.selectedCategoryId, 10) : null
        };
    }

    private validateTransactionData(data: TransactionData): boolean {
        if (!['income', 'expense'].includes(data.type)) {
            alert('Тип должен быть "доход" или "расход"');
            return false;
        }

        if (isNaN(data.amount) || data.amount <= 0) {
            alert('Введите корректную сумму');
            return false;
        }

        if (!(this.dateInput as HTMLInputElement).value) {
            alert('Выберите дату');
            return false;
        }

        if (!this.selectedCategoryId) {
            alert('Выберите категорию');
            return false;
        }

        return true;
    }

    private renderTypes(types: ('income' | 'expense')[]): void {
        if (!this.typesList) return;

        try {
            this.typesList.innerHTML = types.map((type: 'income' | 'expense') => `
            <li>
                <button
                    type="button"
                    class="dropdown-item"
                    data-type="${type}">
                    ${type === 'income' ? 'Доход' : 'Расход'}
                </button>
            </li>
        `).join('');

            this.typesList.querySelectorAll('.dropdown-item').forEach((item: Element): void => {
                (item as HTMLButtonElement).addEventListener('click', (event: MouseEvent): void =>
                    this.handleTypeSelect(event));
            });
        } catch (error) {
            console.error('Type rendering error:', error);
        }
    }

    private handleTypeSelect(event: MouseEvent): void {
        const button = event.target as HTMLButtonElement;
        const selectedType: string | null = button.getAttribute('data-type');
        if (Validator.areElementsMissing(
            this.typeInput,
            this.categoriesList,
        )) return;

        if (selectedType !== 'income' && selectedType !== 'expense') return;

        this.typeInput!.value = selectedType === 'income' ? 'Доход' : 'Расход';
        this.typeInput!.setAttribute('data-type', selectedType); // Сохраняем текущий тип

        this.selectedCategoryId = null; // Сбрасываем выбранную категорию
        this.categoryInput!.value = ''; // Очищаем поле категории
        this.loadCategories(selectedType); // Подгружаем категории нового типа
        this.hideTypes();
    }

    private showTypes(): void {
        if (this.typesList) {
            this.typesList.style.display = 'block';
        }
    }

    private hideTypes(): void {
        if (this.typesList) {
        this.typesList.style.display = 'none';

        }
    }
}

