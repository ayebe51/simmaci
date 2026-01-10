import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PermissionsService } from './permissions.service';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
export declare class AuthService {
    private usersService;
    private jwtService;
    private permissionsService;
    private usersRepository;
    constructor(usersService: UsersService, jwtService: JwtService, permissionsService: PermissionsService, usersRepository: Repository<User>);
    validateUser(username: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            role: any;
            name: any;
            unitKerja: any;
            kecamatan: any;
            permissions: any;
        };
    }>;
    checkUsers(): Promise<{
        count: any;
        users: any;
    }>;
    register(data: any): Promise<any>;
    createDefaultAdmin(): Promise<{
        message: string;
        username: string;
    }>;
}
