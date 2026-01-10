interface PhoneValidationResult {
    isValid: boolean;
    normalized: string;
    error?: string;
}
interface NIKValidationResult {
    isValid: boolean;
    error?: string;
    warning?: string;
    province?: string;
}
export declare function validatePhoneNumber(phone: string): PhoneValidationResult;
export declare function validateNIK(nik: string): NIKValidationResult;
export declare function isValidPhoneNumber(phone: string): boolean;
export declare function normalizePhoneNumber(phone: string): string;
export {};
