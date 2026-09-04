declare const normalizedEmailBrand: unique symbol;

export type NormalizedEmail = string & {
    readonly [normalizedEmailBrand]: true;
};

export class EmailService {
    normalize(email: string): NormalizedEmail {
        return email.toLowerCase() as NormalizedEmail;
    }
}
