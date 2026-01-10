import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PermissionsService } from '../auth/permissions.service';
export declare class UsersService {
    private usersRepository;
    private permissionsService;
    constructor(usersRepository: Repository<User>, permissionsService: PermissionsService);
    findOne(username: string): Promise<User | null>;
    create(userData: Partial<User>): Promise<User>;
    createSuperAdmin(userData: Partial<User>): Promise<User>;
    findAll(): Promise<User[]>;
}
