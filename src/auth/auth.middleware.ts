import { Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class AuthMiddleware implements NestMiddleware {

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    this.logger.debug(`Processing request to: ${req.method} ${req.path}`);
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      this.logger.warn('No authorization header present');
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      this.logger.warn('Authorization header malformed');
      throw new UnauthorizedException('No token provided');
    }
    
    try {
      const decoded = this.jwtService.verify(token);
      this.logger.info('Token verified successfully', { userId: decoded.sub });
      req['user'] = decoded;
      return next();
    } catch (error) {
      this.logger.error('Token verification failed', {
        error: error.message,
        token: token.substring(0, 10) + '...' // Log only first 10 chars for security
      });
      throw new UnauthorizedException('Invalid token');
    }
  }
}