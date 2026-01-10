import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { PermissionsService } from '../auth/permissions.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private permissionsService: PermissionsService,
  ) {}

  async findOne(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async create(userData: Partial<User>): Promise<User> {
    if (!userData.password) {
        throw new Error("Password is required");
    }
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    const role = userData.role || 'operator_madrasah';
    const permissions = this.permissionsService.getRolePermissions(role);
    
    const user = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
      role: role,
      permissions: permissions,
    });
    return this.usersRepository.save(user);
  }

  async createSuperAdmin(userData: Partial<User>): Promise<User> {
     console.log('Creating Super Admin:', userData.username);
     if (!userData.username) {
         throw new Error('Username is required');
     }
     
     const existing = await this.findOne(userData.username);
     if (existing) {
         console.log('User exists. Deleting to ensure clean state...');
         await this.usersRepository.remove(existing);
     }
     
     console.log('Creating new Super Admin entry...');
     if (!userData.password) {
        throw new Error('Password is required');
    }
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const permissions = this.permissionsService.getRolePermissions('super_admin');
    const user = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
      role: 'super_admin',
      permissions: permissions,
    });
    const saved = await this.usersRepository.save(user);
    console.log('Super Admin Created:', saved.username);
    return saved;
  }

  async findAll(): Promise<User[]> {
      return this.usersRepository.find();
  }
}
