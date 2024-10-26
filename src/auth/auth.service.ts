// src/auth/auth.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OAuthUserProfile } from './interfaces/oauth-user-profile.interface';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // Inject UsersService
    private readonly jwtService: JwtService,     // Inject JwtService
  ) {}

  /**
   * Validates the OAuth login and returns user and JWT token.
   * @param profile OAuth user profile data.
   */
  async validateOAuthLogin(profile: OAuthUserProfile): Promise<{ user: User; token: string }> {
    // Use UsersService to find or create the user
    const user = await this.usersService.findOrCreate(profile);

    // Generate JWT token with user payload
    const payload = { username: user.username, sub: user.id };
    const token = this.jwtService.sign(payload);

    console.log(`Generated JWT token for user ID: ${user.id}`);

    return { user, token };
  }
}
