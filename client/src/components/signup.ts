import {Http} from "../services/http";
import {UserManager} from "./base-class/user-manager";
import {DefaultCategoriesManager} from "../services/default-categories";
import {RoutePath} from "../types/route-type";
import {SignupFormData} from "../types/signup-type";
import {Validator} from "../services/validator";
import {API_URL} from "../constants/api";

export class Signup extends UserManager {
    readonly fullNameInput: HTMLInputElement | null;
    readonly confirmPasswordInput: HTMLInputElement | null;

    constructor(navigateTo: (path: RoutePath) => void) {
        super(navigateTo);
        this.fullNameInput = document.getElementById('fullName') as HTMLInputElement;
        this.confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
    }

    public initializeEventListeners(): void {
        if (!this.form) return;
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    private handleSubmit(event: SubmitEvent): void {
        event.preventDefault();
        this.form!.classList.remove('was-validated');

        if (Validator.areElementsMissing(
            this.fullNameInput,
            this.emailInput,
            this.passwordInput,
            this.confirmPasswordInput
        )) return;

        let isValid: boolean = true;
        isValid = this.validateField(this.fullNameInput!, (value: string): boolean =>
            value.trim() !== '', 'Пожалуйста, введите полное имя') && isValid;
        isValid = this.validateEmail() && isValid;
        isValid = this.validatePassword() && isValid;
        isValid = this.validateField(this.confirmPasswordInput!, (value: string): boolean =>
            value === this.passwordInput!.value, 'Пароли не совпадают') && isValid;

        this.form!.classList.add('was-validated');

        if (isValid) {
            this.submitForm({
                name: this.fullNameInput!.value.trim(),
                email: this.emailInput!.value.trim(),
                password: this.passwordInput!.value,
                passwordRepeat: this.confirmPasswordInput!.value
            });
        }
    }

    private validateField(field: HTMLInputElement, validationFn: (value: string) => boolean, errorMessage: string): boolean {
        if (!validationFn(field.value)) {
            field.classList.add('is-invalid');
            field.setCustomValidity(errorMessage);
            return false;
        }
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        field.setCustomValidity('');
        return true;
    }

    private async submitForm(data: SignupFormData) {
        try {
            const signupPath = `${API_URL}/signup`;
            const signupResult = await Http.request(signupPath, 'POST', data, false);

            if (signupResult) {
                const loginData = {
                    email: data.email,
                    password: data.password,
                    rememberMe: false
                };

                const loginSuccess = await DefaultCategoriesManager.processLogin(loginData);

                if (loginSuccess) {
                    await DefaultCategoriesManager.setupDefaultCategories();
                    this.navigateToPath('/');
                }
            }
        } catch (error) {
            console.error('Error in sending:', error);
            alert('Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.');
        }
    }
}

