import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(req: Record<string, any>): Promise<any>;
    register(req: Record<string, any>): Promise<any>;
    setupAdmin(): Promise<any>;
    emergencyRestore(): Promise<any>;
}
