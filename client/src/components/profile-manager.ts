import { Auth } from "../services/auth";
import { Http } from "../services/http";
import {RoutePath} from "../types/route-type";
import Popover = bootstrap.Popover;

export class ProfileManager {
    readonly navigateToPath: (path: RoutePath) => void;

    constructor(navigateTo: (path: RoutePath) => void) {
        this.navigateToPath = navigateTo;
    }

    public init(): void {
        this.initUser();
        this.logoutButton();
        this.logOfUser();
        this.showBalance();
    }

    private initUser(): void {
        const userName: HTMLElement | null = document.getElementById('userName');
        const userInfo = Auth.getUserInfo();

        if (userName && userInfo) {
        userName.innerText = userInfo.name;
        }
    }

    private logoutButton(): void {
        document.addEventListener('DOMContentLoaded', (): void => {
            const popoverTriggerList: NodeListOf<Element> = document.querySelectorAll('[data-bs-toggle="popover"]');

            [...Array.from(popoverTriggerList)].map((popoverTriggerEl: Element): Popover =>
                new bootstrap.Popover(popoverTriggerEl as HTMLElement));
        });
    }

    private logOfUser(): void {
        const logoutButton: HTMLElement | null = document.getElementById('logout');
        if (!logoutButton) return;

        // Кнопка живёт в index.html и не пересоздаётся при навигации,
        // поэтому обработчик навешиваем только один раз
        if (logoutButton.dataset.logoutBound) return;
        logoutButton.dataset.logoutBound = 'true';

        logoutButton.addEventListener('click', () => {
            Auth.removeTokens();
            this.navigateToPath('/login');
        });
    }

    public async showBalance(): Promise<void> {
        const url = 'http://localhost:3000/api/balance';
        const balanceSpan: HTMLElement | null = document.getElementById('balance');
        const balance = (await Http.request(url, 'GET')).balance;
        if (balanceSpan) {
        balanceSpan.innerText = `${balance}$`;
        }
    }
}

