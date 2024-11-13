import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { Auth0Strategy } from './strategies/auth0.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthMiddleware } from './auth.middleware';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService,Auth0Strategy, JwtStrategy],
  exports: [AuthService],
})

export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/callback', method: RequestMethod.GET },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/jwt', method: RequestMethod.GET },
        { path: 'auth/authorize-social', method: RequestMethod.GET },
        { path: 'auth/authorize-email', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}