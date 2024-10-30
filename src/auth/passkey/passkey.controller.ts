import { Controller, Post, Put, Body, Get, Param, NotFoundException } from '@nestjs/common';
import { PasskeyService } from './passkey.service';

@Controller('auth/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}


  @Post('register-credential')
  async registerCredential(@Body() data: { userId: string }) {
    const options = await this.passkeyService.generateRegistrationOptions(data.userId);
    
    return {
      publicKey: {
        ...options,
        challenge: Buffer.from(options.challenge)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, ''),
        user: {
          ...options.user,
          id: Buffer.from(options.user.id)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
        }
      }
    };
  }

  @Post('verify-registration')
  async verifyRegistration(@Body() data: { userId: string; credential: any }) {
    return this.passkeyService.verifyRegistration(data.userId, data.credential);
  }

  @Get('challenge/:userId')
  async getChallenge(@Param('userId') userId: string) {
    return await this.passkeyService.generateAuthenticationChallenge(userId);
  }

  @Post('verify/:userId')
  async verifyAuthentication(
    @Param('userId') userId: string,
    @Body() credential: {
      id: string;
      rawId: string;
      authenticatorData: string;
      clientDataJSON: string;
      signature: string;
    }
  ) {
    return await this.passkeyService.verifyAuthentication(userId, credential);
  }

  @Put('transaction/:userId')
  async storeTransactionHash(
    @Param('userId') userId: string,
    @Body() data: { transactionHash: string; iv: string }
  ) {
    return await this.passkeyService.storeTransactionHash(
      userId,
      data.transactionHash,
      data.iv
    );
  }

  @Get('transaction/:userId')
  async getTransactionHash(@Param('userId') userId: string) {
    try {
      const result = await this.passkeyService.getTransactionHash(userId);
      return {
        transactionHash: result.transactionHash,
        iv: result.iv
      };
    } catch (error) {
      throw new NotFoundException(error.message);
    }
  }
}