import { readFileSync } from 'node:fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { test, expect, describe, beforeAll, beforeEach, afterEach } from '@jest/globals';

import { Signup } from '../../src/components/signup';
import { Auth } from "../../src/services/auth";
import { DefaultCategoriesManager } from '../../src/services/default-categories';
import { Http } from '../../src/services/http';
import { createHttpMock } from '../mocks/handlers/http';
import { createMockEvent } from '../mocks/utils/event';
import { SignupFormData } from '../../src/types/signup-type';
import { RoutePath } from '../../src/types/route-type';
import { LoginData } from '../../src/types/login-type';
import {API_URL} from "../../src/constants/api";

// Определяем моки
const httpMock = createHttpMock();

const defaultCategoriesManagerMock = {
    processLogin: jest.fn() as jest.MockedFunction<typeof DefaultCategoriesManager.processLogin>,
    setupDefaultCategories: jest.fn() as jest.MockedFunction<typeof DefaultCategoriesManager.setupDefaultCategories>
};

describe('Signup Component', () => {
    let signup: Signup;
    let mockNavigateTo: jest.MockedFunction<(path: RoutePath) => void>;
    let signupFormHtml: string;

    // Объект, содержащий маппинг полей формы
    const formFields: Record<string, string> = {
        fullName: 'fullNameInput',
        email: 'emailInput',
        password: 'passwordInput',
        passwordRepeat: 'confirmPasswordInput'
    };

    // Тестовые данные пользователя
    const user: SignupFormData & { fullName: string } = {
        fullName: 'Иван Иванов',
        name: 'Иван Иванов', // Добавлено для соответствия типу SignupFormData
        email: 'test@example.com',
        password: 'Password123!',
        passwordRepeat: 'Password123!'
    };

    // Вспомогательная функция для заполнения формы
    const fillFormFields = (component: Signup, data: Record<string, string>): void => {
        Object.entries(formFields).forEach(([dataKey, inputField]) => {
            const input = component[inputField] as HTMLInputElement;
            if (input) {
                input.value = data[dataKey];
            }
        });
    };

    beforeAll(() => {
        Http.request = httpMock.request as typeof Http.request;
        DefaultCategoriesManager.processLogin = defaultCategoriesManagerMock.processLogin;
        DefaultCategoriesManager.setupDefaultCategories = defaultCategoriesManagerMock.setupDefaultCategories;

        signupFormHtml = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '../fixtures/html/signup-form.html'),
            'utf8'
        );
    });

    beforeEach(() => {
        Auth.accessTokenKey = 'test_access_token';
        document.body.innerHTML = signupFormHtml;
        mockNavigateTo = jest.fn() as jest.MockedFunction<(path: RoutePath) => void>;
        signup = new Signup(mockNavigateTo);
        signup.initializeEventListeners();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('should successfully submit a registration form', async () => {
        // Заполняем форму используя вспомогательную функцию
        fillFormFields(signup, user);

        (httpMock.request as jest.Mock).mockReturnValue(true);
        defaultCategoriesManagerMock.processLogin.mockResolvedValueOnce(true);
        defaultCategoriesManagerMock.setupDefaultCategories.mockResolvedValueOnce(true);

        await signup['submitForm'](user as SignupFormData);

        expect(httpMock.request).toHaveBeenCalledWith(
            `${API_URL}/signup`,
            'POST',
            user,
            false
        );

        expect(defaultCategoriesManagerMock.processLogin).toHaveBeenCalledWith({
            email: user.email,
            password: user.password,
            rememberMe: false
        } as LoginData);

        expect(mockNavigateTo).toHaveBeenCalledWith('/' as RoutePath);
    });

    test('should show validation errors with empty fields', () => {
        const mockEvent = createMockEvent();
        signup['handleSubmit'](mockEvent as unknown as SubmitEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(signup.form?.classList.contains('was-validated')).toBeTruthy();
        expect(signup.fullNameInput?.classList.contains('is-invalid')).toBeTruthy();
    });

    test('should show an error if passwords do not match', () => {
        const invalidUser = { ...user, passwordRepeat: 'DifferentPassword123!' };
        fillFormFields(signup, invalidUser);

        const mockEvent = createMockEvent();
        signup['handleSubmit'](mockEvent as unknown as SubmitEvent);

        expect(signup.confirmPasswordInput?.classList.contains('is-invalid')).toBeTruthy();
        expect(signup.confirmPasswordInput?.validationMessage).toBe('Пароли не совпадают');
    });
});