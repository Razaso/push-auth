// src/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService, // Inject ConfigService
    private readonly usersService: UsersService,     // Inject UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extract JWT from Bearer token
      ignoreExpiration: false,                                   // Do not ignore token expiration
      secretOrKey: configService.get<string>('JWT_SECRET', 'default_jwt_secret'), // JWT secret
    });
  }

  /**
   * Validates the JWT payload and attaches the user to the request object.
   * @param payload JWT payload.
   * @returns The user entity.
   */
  async validate(payload: any): Promise<User> {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    return user; // Attach user to request object
  }
}
