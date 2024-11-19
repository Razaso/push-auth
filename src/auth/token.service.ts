import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthToken } from '@prisma/client';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class TokenService {
  private readonly FIVE_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly prisma: PrismaService
  ) {}

  async createToken(status: string, metadata?: { redirectUri?: string }): Promise<AuthToken> {
    this.logger.debug('Creating new auth token', { status });
    
    try {
      const token = await this.prisma.authToken.create({
        data: {
          status,
          token: '',
          expiresAt: new Date(Date.now() + this.FIVE_MINUTES),
          redirectUri: metadata?.redirectUri,
        },
      });
      this.logger.debug('Auth token created successfully', { tokenId: token.id });
      return token;
    } catch (error) {
      this.logger.error('Failed to create auth token', { error: error.message, status });
      throw error;
    }
  }

  async retrieveToken(id: string): Promise<AuthToken | null> {
    this.logger.debug('Retrieving auth token', { tokenId: id });
    
    const token = await this.prisma.authToken.findUnique({
      where: { id },
    });

    if (!token) {
      this.logger.warn('Token not found', { tokenId: id });
      return null;
    }

    if (token.expiresAt < new Date()) {
      this.logger.warn('Token has expired', { tokenId: id, expiresAt: token.expiresAt });
      return null;
    }

    if (token.used) {
      this.logger.warn('Token has already been used', { tokenId: id });
      return null;
    }

    this.logger.debug('Token retrieved successfully', { tokenId: id, status: token.status });
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

  async markAsUsed(id: string): Promise<void> {
    this.logger.debug('Marking token as used', { tokenId: id });
    
    try {
      await this.prisma.authToken.update({
        where: { id },
        data: { used: true }
      });
      this.logger.info('Token marked as used successfully', { tokenId: id });
    } catch (error) {
      this.logger.error('Failed to mark token as used', { 
        tokenId: id, 
        error: error.message 
      });
      throw error;
    }
  }
}