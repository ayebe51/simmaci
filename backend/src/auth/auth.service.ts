import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PermissionsService } from './permissions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private permissionsService: PermissionsService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(username);
    if (!user) {
        console.log('ValidateUser: User not found', username);
        return null;
    }

    try {
        const isMatch = await bcrypt.compare(pass, user.password);
        console.log(`ValidateUser: ${username} found. Password match? ${isMatch}`);
        
        if (user && isMatch) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...result } = user;
          return result;
        }
    } catch (e: any) {
        console.error("Bcrypt Error:", e);
        throw new Error(`Password validation error: ${e.message}`);
    }
    
    return null;
  }

  async login(user: any) {
    try {
        // Ensure user has permissions
        let permissions = user.permissions;
        if (!permissions || permissions.length === 0) {
          console.warn(`User ${user.username} has no permissions. Auto-assigning...`);
          permissions = this.permissionsService.getRolePermissions(user.role);
          // Update user in database
          await this.usersRepository.update(user.id, { permissions });
        }

        const payload = { 
          username: user.username, 
          sub: user.id, 
          role: user.role,
          unitKerja: user.unitKerja,
          kecamatan: user.kecamatan,
          permissions: permissions
        };
        
        return {
          access_token: this.jwtService.sign(payload),
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            unitKerja: user.unitKerja,
            kecamatan: user.kecamatan,
            permissions: permissions
          }
        };
    } catch (e: any) {
        console.error("JWT Error:", e);
        throw new Error(`Token generation error: ${e.message}`);
    }
  }

  async checkUsers() {
      const users = await this.usersService.findAll();
      return { 
          count: users.length, 
          users: users.map(u => ({ 
              id: u.id, 
              username: u.username, 
              role: u.role,
              // Password hash intentionally omitted for security
          })) 
      };
  }

  async register(data: any) {
    return this.usersService.create(data);
  }

  async createDefaultAdmin() {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
          throw new Error('Cannot create default admin in production. Create admin manually.');
      }

      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
          throw new Error('ADMIN_PASSWORD environment variable not set. Cannot create admin.');
      }

      const admin = await this.usersService.createSuperAdmin({
          username: 'admin',
          password: adminPassword,
          name: 'Super Administrator'
      });
      
      // Never return password in response!
      return { 
          message: "Super Admin created/updated successfully", 
          username: 'admin',
          // Password intentionally omitted for security
      };
  }
}
