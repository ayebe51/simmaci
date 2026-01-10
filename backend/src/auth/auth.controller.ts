import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req: Record<string, any>) {
    // Ideally use a LocalGuard, but for simplicity validating directly or we can add LocalStrategy later.
    // Let's assume the body contains username/password and we use AuthService manually or rely on a Guard.
    // For MVP transparency, let's just use AuthService.validateUser inside logic or simpler:
    const user = await this.authService.validateUser(req.username, req.password);
    if (!user) {
      throw new UnauthorizedException(`Login Failed. Backend received: User='${req.username}'`);
    }
    return this.authService.login(user); // Returns access_token
  }

  @Post('register')
  async register(@Body() req: Record<string, any>) {
      return this.authService.register(req);
  }

  @Get('setup-admin')
  async setupAdmin() {
      return this.authService.checkUsers();
  }

  @Get('emergency-restore')
  async emergencyRestore() {
       return this.authService.createDefaultAdmin();
  }



}
