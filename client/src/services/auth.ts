import {RoutePath} from "../types/route-type";
import {UserInfo} from "../types/user-info-type";
import {API_URL} from "../constants/api";

export class Auth {
    public static navigateToPath: (path: RoutePath) => void;

    // Метод для инициализации
    public static initialize(navigateFunction: (path: RoutePath) => void): void {
        this.navigateToPath = navigateFunction;
    }

    public static accessTokenKey = 'accessToken';
    public static refreshTokenKey = 'refreshToken';
    public static userInfoKey = 'userInfo';

    public static async processUnauthorizedResponse(): Promise<boolean > {
        const refreshToken = localStorage.getItem(this.refreshTokenKey);
        if (refreshToken) {
            const response = await fetch(`${API_URL}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ refreshToken: refreshToken })
            });

            if (response && response.status === 200) {
                const result = await response.json();
                if (result && !result.error) {
                    const tokens = result.tokens;
                    this.setTokens(tokens.accessToken, tokens.refreshToken);
                    return true;
                }
            }
        }

        this.removeTokens();
        if (this.navigateToPath) {
            this.navigateToPath('/login');
        }
        return false;
    }

    public static setTokens(accessToken: string, refreshToken: string): void {
        localStorage.setItem(this.accessTokenKey, accessToken);
        localStorage.setItem(this.refreshTokenKey, refreshToken);
    }

    public static removeTokens(): void {
        localStorage.removeItem(this.accessTokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.userInfoKey);
    }

    public static setUserInfo(info: UserInfo): void {
        localStorage.setItem(this.userInfoKey, JSON.stringify(info))
    }

    public static getUserInfo(): any {
        const userInfo = localStorage.getItem(this.userInfoKey);
        if (userInfo) {
            return JSON.parse(userInfo);
        }

        return null;
    }
}

