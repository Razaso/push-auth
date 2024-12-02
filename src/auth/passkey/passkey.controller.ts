import { Controller, Post, Put, Body, Get, Param, NotFoundException, Inject, Headers } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('auth/passkey')
export class PasskeyController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly passkeyService: PasskeyService
  ) {}


  @Post('register-credential')
  async registerCredential(
    @Body() data: { userId: string },
    @Headers('origin') origin: string
  ) {
    this.logger.info('Initiating passkey registration', { 
      userId: data.userId,
      origin,
      context: 'PasskeyController.registerCredential'
    });
  
    const options = await this.passkeyService.generateRegistrationOptions(data.userId, origin);
    
    this.logger.debug('Generated registration options', { 
      userId: data.userId,
      context: 'PasskeyController.registerCredential'
    });

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
  async verifyRegistration(
    @Body() data: { userId: string; credential: any },
    @Headers('origin') origin: string
  ) {

    this.logger.info('Verifying passkey registration', { 
      userId: data.userId,
      context: 'PasskeyController.verifyRegistration'
    });

    return this.passkeyService.verifyRegistration(data.userId, data.credential, origin);
  }

  @Get('challenge/:userId')
  async getChallenge(@Param('userId') userId: string, @Headers('origin') origin: string) {
    this.logger.info('Generating authentication challenge', { 
      userId,
      context: 'PasskeyController.getChallenge'
    });
    return await this.passkeyService.generateAuthenticationChallenge(userId, origin);
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
    },
    @Headers('origin') origin: string
  ) {
    this.logger.info('Verifying authentication', { 
      userId,
      credentialId: credential.id,
      context: 'PasskeyController.verifyAuthentication'
    });
    return await this.passkeyService.verifyAuthentication(userId, credential, origin);
  }

  @Put('transaction/:userId')
  async storeTransactionHash(
    @Param('userId') userId: string,
    @Body() data: { transactionHash: string; iv: string }
  ) {
    this.logger.info('Storing transaction hash', { 
      userId,
      context: 'PasskeyController.storeTransactionHash'
    });
    return await this.passkeyService.storeTransactionHash(
      userId,
      data.transactionHash,
      data.iv
    );
  }

  @Get('transaction/:userId')
  async getTransactionHash(@Param('userId') userId: string) {
    this.logger.info('Retrieving transaction hash', { 
      userId,
      context: 'PasskeyController.getTransactionHash'
    });

    try {
      const result = await this.passkeyService.getTransactionHash(userId);
      this.logger.debug('Successfully retrieved transaction hash', { 
        userId,
        context: 'PasskeyController.getTransactionHash'
      });

      return {
        transactionHash: result.transactionHash,
        iv: result.iv
      };
    } catch (error) {
      this.logger.error('Failed to retrieve transaction hash', { 
        userId,
        error: error.message,
        stack: error.stack,
        context: 'PasskeyController.getTransactionHash'
      });
      throw new NotFoundException(error.message);
    }
  }
}