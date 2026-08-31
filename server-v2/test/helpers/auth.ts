export type AuthorizationHeader = Readonly<{
    Authorization: string;
}>;

/** Единый формат Authorization для будущих защищённых API-тестов. */
export const bearerAuth = (accessToken: string): AuthorizationHeader => ({
    Authorization: `Bearer ${accessToken}`,
});
