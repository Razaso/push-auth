import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthToken } from '@prisma/client';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly FIVE_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(private readonly prisma: PrismaService) {}

  async createToken(status: string): Promise<AuthToken> {
    return this.prisma.authToken.create({
      data: {
        status,
        token: "",
        expiresAt: new Date(Date.now() + this.FIVE_MINUTES),
      },
    });
  }

  async retrieveToken(id: string): Promise<AuthToken | null> {
    const token = await this.prisma.authToken.findUnique({
      where: { id },
    });

    if (!token || token.expiresAt < new Date() || token.used) {
      return null;
    }

    return token;
  }

  async updateToken(id: string, token: string): Promise<AuthToken> {
    return this.prisma.authToken.update({
      where: { id },
      data: { 
        token,
        status: 'active'
      },
    });
  }

  async markAsUsed(id: string): Promise<AuthToken> {
    console.log('markAsUsed id', id);
    
    return this.prisma.authToken.update({
      where: { id },
      data: { used: true }
    });
  }
}