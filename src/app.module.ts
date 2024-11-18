// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PasskeyModule } from './auth/passkey/passkey.module';
import { MnemonicShareModule } from './mnemonic-share/mnemonic-share.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available globally
    }),
    PrismaModule, // Prisma integration
    AuthModule,   // Authentication
    MnemonicShareModule,  // Mnemonic share management
    PasskeyModule,        // Passkey authentication
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
