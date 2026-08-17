import { DatePickerManager } from "../../services/date-picker";
import { ProfileManager } from "../profile-manager";
import {RoutePath} from "../../types/route-type";
import {Operation} from "../../types/operations-type";
import {API_URL} from "../../constants/api";

export class BaseOperations {
    apiUrl: string;
    container: HTMLElement | null;
    datePickerManager: DatePickerManager;
    balanceManager : ProfileManager;
    navigateTo: (path: RoutePath) => void;

    constructor(navigateTo: (path: RoutePath) => void) {
        this.apiUrl = `${API_URL}/operations`;
        this.container = document.querySelector('.table tbody');
        this.datePickerManager = new DatePickerManager();
        this.balanceManager = new ProfileManager(navigateTo);
        this.navigateTo = navigateTo;
    }

    protected navigateToPath(path: RoutePath): void {
        this.navigateTo(path);
    }

    private createTableRow(operation: Operation): HTMLElement {
        const row: HTMLTableRowElement = document.createElement('tr');
        row.dataset.id = operation.id.toString();

        const typeClass = operation.type === 'income' ? 'text-success' : 'text-danger';
        const typeText = operation.type === 'income' ? 'доход' : 'расход';

        const formattedDate = this.datePickerManager.formatDate(operation.date as string);

        row.innerHTML = `
    <td class="align-middle">${operation.number}</td>
    <td class="align-middle ${typeClass}">${typeText}</td>
    <td class="align-middle">${operation.category || '-'}</td>
    <td class="align-middle">${operation.amount}$</td>
    <td class="align-middle"><input type="text" class="datepicker form-control border-0" value="${formattedDate}" readonly></td>
    <td class="align-middle"><input type="text" class="form-control border-0" value="${operation.comment || ''}"></td>
    <td class="align-middle">
        <button class="btn btn-sm btn-light me-1 edit-transaction">
            <i class="bi bi-pencil">
                <img src="images/pen-icon.svg" alt="Pen icon">
            </i>
        </button>
        <button class="btn btn-sm btn-light delete-transaction">
            <i class="bi bi-trash">
                <img src="images/trash-icon.svg" alt="Trash icon">
            </i>
        </button>
    </td>
`;

        return row;
    }

    public async updateBalance(): Promise<void> {
        await this.balanceManager.showBalance();
    }

    public renderOperations(operations: Operation[]): void {
        if (!this.container) {
            console.warn('Container for operations not found');
            return;
        }

        this.container.innerHTML = '';
        operations.forEach((operation: Operation, index: number) => {
            operation.number = index + 1;
            const row: HTMLElement = this.createTableRow(operation);

            this.container!.appendChild(row);

            const dateInput: HTMLInputElement | null = row.querySelector('.datepicker');
            if (dateInput) {
                this.datePickerManager.init(dateInput);
            }
        });
    }
}

