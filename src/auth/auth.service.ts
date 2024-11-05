import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async exchangeCodeForTokens(code: string) {
    try {
      const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BACKEND_URL}/auth/callback`
      });

      return response.data;
    } catch (error) {
      throw new HttpException('Failed to exchange code for tokens', HttpStatus.BAD_REQUEST);
    }
  }

  async getUserProfile(accessToken: string) {
    try {
      const response = await axios.get(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw new HttpException('Failed to get user profile', HttpStatus.BAD_REQUEST);
    }
  }

  async findOrCreateUser(auth0User: any) {
    const user = await this.prisma.user.upsert({
      where: { email: auth0User.email },
      update: {
        username: auth0User.nickname,
        auth0Id: auth0User.sub,
        avatarUrl: auth0User.picture,
        updatedAt: new Date(),
      },
      create: {
        email: auth0User.email,
        username: auth0User.nickname,
        auth0Id: auth0User.sub,
        avatarUrl: auth0User.picture,
      },
    });

    return user;
  }

  async generateJWT(user: any) {
    const payload = { 
      sub: user.id,
      email: user.email,
      username: user.username
    };
    
    return this.jwtService.sign(payload);
  }

  async validateUser(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });
    
    return user;
  }
}