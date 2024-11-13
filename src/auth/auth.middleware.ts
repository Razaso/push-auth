import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    
    try {
      const decoded = this.jwtService.verify(token);
      
      // Check if Auth0 session is still valid
      const isAuth0Valid = await this.authService.verifySession(decoded.auth0Token);
      
      if (!isAuth0Valid) {
        throw new UnauthorizedException('Auth0 session expired');
      }

      // Add user info to request
      req['user'] = decoded;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}