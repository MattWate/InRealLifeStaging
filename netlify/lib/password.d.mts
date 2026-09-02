export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, encoded: string | null): Promise<boolean>;
