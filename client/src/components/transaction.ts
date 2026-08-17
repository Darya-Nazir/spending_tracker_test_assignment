import { Http } from "../services/http";
import { BaseOperations } from "./base-class/base-operations";
import { DefaultCategoriesManager } from "../services/default-categories";
import { Filter } from "../services/filter";
import { Unselect } from "../services/unselect";
import {RoutePath} from "../types/route-type";
import {Operation} from "../types/operations-type";
import {API_URL} from "../constants/api";

export class Transaction extends BaseOperations {
    constructor(navigateTo: (path: RoutePath) => void) {
        super(navigateTo);
        document.querySelectorAll('.datepicker').forEach((input) => {
            this.datePickerManager.init(input as HTMLElement);
        });
    }

    public init(): void {
        new Unselect().init();
        this.highlightPage();
        this.renderTransactions();
        this.setupDeleteListener();
        this.redirectToCreateOperation();
        this.setupEditListener();
        this.updateBalance();
        this.filterOperations();
    }

    private highlightPage(): void {
        (document.getElementById('transactionsPage') as HTMLDivElement)
            .classList.add('bg-primary', 'text-white');
    }

    private async fetchTransactions(): Promise<Operation[]> {
        return await Http.request(this.apiUrl + '?period=all&type=income', 'GET');
    }

    private async renderTransactions(): Promise<void> {
        try {
            const transactions = await this.fetchTransactions();

            transactions.sort((a: Operation, b: Operation): number => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateA.getTime() - dateB.getTime();
            });

            this.renderOperations(transactions);
        } catch (error) {
            console.error('Error when loading transactions:', error);
        }
    }

    private setupDeleteListener(): void {
        let rowToDelete: HTMLTableRowElement | null = null;
        let transactionIdToDelete: string | null | undefined = null;

        if (!this.container) return;
        this.container.addEventListener('click', (event: MouseEvent) => {

            const target = event.target as HTMLElement;
            const deleteButton = target.closest('.delete-transaction') as HTMLButtonElement;
            if (!deleteButton) return;

            rowToDelete = deleteButton.closest('tr');
            transactionIdToDelete = rowToDelete?.dataset?.id;

            if (transactionIdToDelete) {
                const deleteModal = new (bootstrap as any).Modal(document.getElementById('deleteCategoryModal'));
                deleteModal.show();
            }
        });

        const confirmButton: HTMLElement | null = document.getElementById('confirmDeleteBtn');
        (confirmButton as HTMLElement).addEventListener('click', async () => {
            if (rowToDelete && transactionIdToDelete) {
                try {
                    await this.deleteTransaction(transactionIdToDelete);
                    rowToDelete.remove();
                    rowToDelete = null;
                    transactionIdToDelete = null;
                } catch (error) {
                    console.error('Error when confirming deletion:', error);
                }
            }
        });
    }

    private async deleteTransaction(transactionId: string): Promise<void> {
        const url = `${this.apiUrl}/${transactionId}`;
        try {
            await Http.request(url, 'DELETE');
            await this.updateBalance();
        } catch (error) {
            console.error('Error when deleting transaction and updating balance:', error);
        }
    }

    private redirectToCreateOperation(): void {
        const createIncomeButton: HTMLElement | null = document.getElementById('createIncome');
        const createExpenseButton: HTMLElement | null = document.getElementById('createExpense');

        if (!createIncomeButton) return;
        createIncomeButton.addEventListener("click", async () => {
            await DefaultCategoriesManager.createIfEmpty(
                `${API_URL}/categories/income`,
                DefaultCategoriesManager.incomeCategories
            );
            this.navigateToPath('create-transaction?type=income' as RoutePath);
        });

        if (!createExpenseButton) return;
        createExpenseButton.addEventListener("click", async () => {
            await DefaultCategoriesManager.createIfEmpty(
                `${API_URL}/categories/expense`,
                DefaultCategoriesManager.expenseCategories
            );
            this.navigateToPath('create-transaction?type=expense' as RoutePath);
        });
    }

    private setupEditListener(): void {
        if (!this.container) return;
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const editButton: Element | null = target.closest('.edit-transaction');
            if (!editButton) return;

            const row: HTMLTableRowElement | null = editButton.closest('tr');
            if (!row) return;
            const transactionId: string | undefined = row.dataset.id;

            if (transactionId) {
                this.navigateToPath(`edit-transaction?id=${transactionId}` as RoutePath);
            }
        });
    }

    private filterOperations(): void {
        new Filter(this.navigateTo);
    }
}

