import {UserManager} from "./base-class/user-manager";
import {Auth} from "../services/auth";
import {Http} from "../services/http";
import {RoutePath} from "../types/route-type";
import {Validator} from "../services/validator";
import {API_URL} from "../constants/api";

export class Login extends UserManager {
    private rememberMeElement: HTMLInputElement | null = null;

    constructor(navigateTo: (path: RoutePath) => void) {
        super(navigateTo);
        this.rememberMeElement = document.getElementById('rememberMe') as HTMLInputElement;
        Auth.initialize(navigateTo);
    }

    public initializeEventListeners(): void {
        if (!this.form) return;
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    private handleSubmit(event: SubmitEvent): void {
        event.preventDefault();
        this.form!.classList.remove('was-validated');

        const isValid = this.validateEmail() && this.validatePassword();
        this.form!.classList.add('was-validated');

        if (isValid) {
            this.submitForm();
        }
    }

    private jumpIntoApp(): void {
        this.navigateToPath('/');
    }

    private async submitForm(): Promise<void> {
        if (Validator.areElementsMissing(
            this.emailInput,
            this.passwordInput,
            this.rememberMeElement
        )) return;

        const emailValue: string = this.emailInput!.value.trim();
        const passwordValue: string = this.passwordInput!.value;

        try {
            const dataObject = {
                email: emailValue,
                password: passwordValue,
                rememberMe: this.rememberMeElement!.checked,
            };

            const path = `${API_URL}/login`;
            // Указываем false для requiresAuth
            const result = await Http.request(path, 'POST', dataObject, false);

            const userInfo = {
                id: result.user.id,
                name: result.user.name,
            }

            Auth.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
            Auth.setUserInfo(userInfo);
            this.jumpIntoApp();
        } catch (error: unknown) {
            console.error('Error in sending:', error);

            if (error instanceof Error) {
                const statusMatch: RegExpMatchArray | null = error.message.match(/HTTP: (\d+)/);
                if (statusMatch && statusMatch.length > 0 && parseInt(statusMatch[1]) === 401) {
                    alert('Пользователь с такими данными не зарегистрирован');
                    return;
                }

                if (error.message.includes('email or password')) {
                    alert('Неверная электронная почта или пароль');
                    return;
                }
            }
            alert('Произошла ошибка при входе. Пожалуйста, попробуйте позже.');
        }
    }
}

