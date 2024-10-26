// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GitHubStrategy } from './strategies/github.strategy'; // Import GitHubStrategy
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule, // Access to environment variables
    PrismaModule, // Prisma integration
    UsersModule,  // Users service
    PassportModule, // Passport.js integration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default_jwt_secret'),
        signOptions: { expiresIn: '1h' }, // Token expiration
      }),
    }),
  ],
  providers: [
    AuthService,      // Authentication logic
    JwtStrategy,      // JWT strategy
    GitHubStrategy,   // GitHub OAuth strategy
  ],
  controllers: [AuthController], // Authentication routes
  exports: [AuthService],        // Export AuthService for use in other modules
})
export class AuthModule {}
