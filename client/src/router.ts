import {ProfileManager} from "./components/profile-manager";
import {Auth} from "./services/auth";
import {Route, Routes, RoutePath} from "./types/route-type";
import {states} from "./constants/states";
import {routes} from "./constants/routes";


const DEFAULT_PAGE_TITLE = 'Lumincoin Finance';


export class Router {
    public routes: Routes  = routes;
    readonly navbarElement: HTMLElement | null;
    readonly appElement: HTMLElement | null;
    private path: string;
    private page: Route | null;

    constructor() {
        this.initEvents();
        Auth.initialize(this.navigateTo.bind(this));

        this.appElement = document.getElementById('app');
        this.navbarElement = document.getElementById('navbar');

        this.path = window.location.pathname || '/';
        this.page = this.routes[this.path as RoutePath];
    }

    private isAuthenticated(): boolean {
        return localStorage.getItem(Auth.accessTokenKey) !== null;
    }

    private initEvents(): void {
        window.addEventListener('DOMContentLoaded', this.handleNavigation.bind(this));
        window.addEventListener('popstate', this.handleNavigation.bind(this));
        document.body.addEventListener('click', this.openNewRoute.bind(this));
    }

    private openNewRoute(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const link = target.closest('a') as HTMLAnchorElement | null;

        if (link) {
            event.preventDefault();
            const path = link.getAttribute('href');
            if (path) {
                this.navigateTo(path);
            }
        }
    }

    public navigateTo(route: string): void {
        const normalizedCurrentPath = this.path.startsWith('/') ? this.path : `/${this.path}`;
        const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

        if (normalizedCurrentPath === normalizedRoute) {
            return;
        }

        history.pushState(null, '', route); // Изменяем историю
        this.path = window.location.pathname; // Обновляем текущий путь
        this.page = this.routes[this.path as RoutePath]; // Обновляем текущую страницу
        this.handleNavigation(); // Загружаем новую страницу
    }

    private startLoad(): void {
        if (this.page && typeof this.page.component) {
            const componentInstance = new this.page.component(this.navigateTo.bind(this));
            componentInstance.init();
        }
    }

    private addTitle(): void {
        document.title = this.page?.title ? this.page.title : DEFAULT_PAGE_TITLE;
    }

    private async handleNavigation(): Promise<void> {
        const handlePage = this.page ?? null;

        if (handlePage?.state === states.STATE_AUTHORIZED && !this.isAuthenticated()) {
            this.navigateTo('/login');
            return;
        }

        if (!handlePage) {
            console.error('Route not found:', this.path);
            if (this.appElement) {
                this.appElement.innerHTML = '<h1>Маршрут не найден</h1>';
            }
            this.addTitle();
            this.toggleNav();
            return;
        }

        try {
            const html = await fetch(handlePage.html).then(response => response.text());

            // Создаем промис, который разрешится, когда DOM будет готов
            const domReadyPromise = new Promise(resolve => {
                requestAnimationFrame(() => {
                    this.appElement!.innerHTML = html;
                    // Даем браузеру время на обработку DOM
                    setTimeout(resolve, 0);
                });
            });

            // Ждем, пока DOM будет готов
            await domReadyPromise;

            // Теперь можно безопасно инициализировать компонент
            this.startLoad();
            this.addTitle();
            this.toggleNav();

        } catch (error) {
            console.error('Error during page loading:', error);
            if (this.appElement) {
                this.appElement.innerHTML = '<h1>Страница не найдена</h1>';
            }
        }
    }

    private toggleNav(): void {
        if (!this.navbarElement) return;

        const showNavbar = this.page?.state === states.STATE_AUTHORIZED;

        if (showNavbar) {
            this.navbarElement.style.display = 'block';
            this.navbarElement.classList.add('d-flex');
            this.turnOnLogoutButton();
        } else {
            this.navbarElement.style.display = 'none';
            this.navbarElement.classList.remove('d-flex');
        }
    }

    private turnOnLogoutButton(): void {
        new ProfileManager(this.navigateTo.bind(this)).init();
    }
}

