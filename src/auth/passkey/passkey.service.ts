import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import base64url from 'base64url';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

interface ChallengeMetadata {
  rpId: string;
  origin: string;
  timestamp: string;
  authenticationType?: string;
  verifiedAt?: string;
  credentialId?: string;
  newCounter?: number;
  error?: string;
  failedAt?: string;
}

@Injectable()
export class PasskeyService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService
  ) {}

  private readonly rpName = 'Push Protocol';
  private readonly rpID = process.env.RP_ID;
  private readonly origin = process.env.FRONTEND_URL;

  async generateRegistrationOptions(userId: string) {
    this.logger.info('Generating registration options', { 
      userId,
      context: 'PasskeyService.generateRegistrationOptions'
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: userId,
      userName: 'push-user',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required'
      }
    });

    const challengeBase64URL = Buffer.from(options.challenge)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Mark any existing active challenges as used
    await this.prisma.challenge.updateMany({
      where: { 
        userId,
        active: true,
        used: false
      },
      data: { 
        active: false,
        used: true,
        usedAt: new Date()
      }
    });

    // Create new challenge
    await this.prisma.challenge.create({
      data: {
        userId,
        challenge: challengeBase64URL,
        type: 'REGISTRATION',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        metadata: {
          rpId: this.rpID,
          origin: this.origin,
          timestamp: new Date().toISOString()
        }
      }
    });

    return options;
  }

  async verifyRegistration(userId: string, credential: any) {
    this.logger.info('Verifying registration', { 
      userId,
      context: 'PasskeyService.verifyRegistration'
    });
    
    const challenge = await this.prisma.challenge.findFirst({
      where: { 
        userId,
        active: true,
        used: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });

      if (verification.verified) {
        // Use transaction to ensure atomicity
        await this.prisma.$transaction(async (tx) => {
          // Mark challenge as used
          await tx.challenge.update({
            where: { id: challenge.id },
            data: { 
              used: true,
              active: false,
              usedAt: new Date(),
              verificationSuccess: true,
              metadata: {
                ...((challenge.metadata as unknown) as ChallengeMetadata),
                verifiedAt: new Date().toISOString(),
                credentialId: credential.id
              }
            }
          });

          // Deactivate any existing transactions
          await tx.mnemonicShareTransaction.updateMany({
            where: { 
              userId,
              active: true 
            },
            data: { 
              active: false 
            }
          });

          // Create new active transaction
          await tx.mnemonicShareTransaction.create({
            data: {
              credentialId: credential.id,
              publicKey: Buffer.from(verification.registrationInfo?.credentialPublicKey).toString('base64'),
              counter: verification.registrationInfo?.counter || 0,
              transactionHash: '',
              iv: '',
              active: true,
              user: {
                connect: {
                  id: userId
                }
              }
            }
          });
        });

        this.logger.info('Registration verified successfully', { 
          userId,
          context: 'PasskeyService.verifyRegistration'
        });
      }

      return verification;
    } catch (error) {
      // Mark challenge as failed
      await this.prisma.challenge.update({
        where: { id: challenge.id },
        data: { 
          used: true,
          active: false,
          usedAt: new Date(),
          verificationSuccess: false,
          metadata: {
            ...((challenge.metadata as unknown) as ChallengeMetadata),
            error: error.message,
            failedAt: new Date().toISOString()
          }
        }
      });

      this.logger.error('Registration verification failed', { 
        userId,
        error: error.message,
        stack: error.stack,
        context: 'PasskeyService.verifyRegistration'
      });
      throw error;
    }
  }

  async generateAuthenticationChallenge(userId: string) {
    this.logger.debug('Generating authentication challenge', { 
      userId,
      context: 'PasskeyService.generateAuthenticationChallenge'
    });

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
    });

    // Mark any existing active challenges as used
    await this.prisma.challenge.updateMany({
      where: { 
        userId,
        active: true,
        used: false
      },
      data: { 
        active: false,
        used: true,
        usedAt: new Date()
      }
    });

    // Convert challenge to base64URL before storing
    const challengeBase64URL = Buffer.from(options.challenge)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Create new challenge
    await this.prisma.challenge.create({
      data: {
        userId,
        challenge: challengeBase64URL,
        type: 'AUTHENTICATION',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        metadata: {
          rpId: this.rpID,
          origin: this.origin,
          timestamp: new Date().toISOString(),
          authenticationType: 'platform'
        }
      }
    });

    return options;
  }

  async verifyAuthentication(userId: string, credential: any) {
    this.logger.debug('Starting authentication verification', { 
      userId,
      credentialId: credential.id,
      context: 'PasskeyService.verifyAuthentication'
    });

    const formattedCredential = {
      id: credential.id,
      rawId: credential.rawId,
      type: 'public-key' as const,
      response: {
        authenticatorData: credential.authenticatorData,
        clientDataJSON: credential.clientDataJSON,
        signature: credential.signature
      },
      clientExtensionResults: {}
    };
  
    // Find active, unused, non-expired challenge
    const expectedChallenge = await this.prisma.challenge.findFirst({
      where: { 
        userId,
        active: true,
        used: false,
        type: 'AUTHENTICATION',
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });
  
    if (!expectedChallenge) {
      this.logger.error('Valid challenge not found or expired', { 
        userId,
        context: 'PasskeyService.verifyAuthentication'
      });
      throw new Error('Challenge not found or expired');
    }
  
    // Find active authenticator
    const authenticator = await this.prisma.mnemonicShareTransaction.findFirst({
      where: { 
        credentialId: credential.id,
        userId,
        active: true
      }
    });
  
    if (!authenticator) {
      this.logger.error('Active authenticator not found', { 
        userId,
        credentialId: credential.id,
        context: 'PasskeyService.verifyAuthentication'
      });

      // Mark challenge as failed
      await this.prisma.challenge.update({
        where: { id: expectedChallenge.id },
        data: { 
          used: true,
          active: false,
          usedAt: new Date(),
          verificationSuccess: false,
          metadata: {
            ...((expectedChallenge.metadata as unknown) as ChallengeMetadata),
            error: 'Authenticator not found',
            failedAt: new Date().toISOString()
          }
        }
      });

      throw new Error('Authenticator not found');
    }
    
    const decodedChallenge = base64url.decode(expectedChallenge.challenge);

    try {
      const verification = await verifyAuthenticationResponse({
        response: formattedCredential,
        expectedChallenge: decodedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        authenticator: {
          credentialID: Buffer.from(authenticator.credentialId),
          credentialPublicKey: Buffer.from(authenticator.publicKey, 'base64'),
          counter: authenticator.counter || 0,
        }
      });
  
      if (verification.verified) {
        // Use transaction to ensure atomicity
        await this.prisma.$transaction(async (tx) => {
          // Mark challenge as used and successful
          await tx.challenge.update({
            where: { id: expectedChallenge.id },
            data: { 
              used: true,
              active: false,
              usedAt: new Date(),
              verificationSuccess: true,
              metadata: {
                ...((expectedChallenge.metadata as unknown) as ChallengeMetadata),
                verifiedAt: new Date().toISOString(),
                credentialId: credential.id,
                newCounter: verification.authenticationInfo.newCounter
              }
            }
          });

          // Update authenticator counter
          await tx.mnemonicShareTransaction.update({
            where: { 
              id: authenticator.id
            },
            data: { 
              counter: verification.authenticationInfo.newCounter,
              updatedAt: new Date()
            }
          });
        });

        this.logger.info('Authentication verified successfully', { 
          userId,
          context: 'PasskeyService.verifyAuthentication'
        });
  
        return { 
          verified: true,
          transactionHash: authenticator.transactionHash
        };
      }
  
      // Mark challenge as failed for unsuccessful verification
      await this.prisma.challenge.update({
        where: { id: expectedChallenge.id },
        data: { 
          used: true,
          active: false,
          usedAt: new Date(),
          verificationSuccess: false,
          metadata: {
            ...((expectedChallenge.metadata as unknown) as ChallengeMetadata),
            error: 'Verification failed',
            failedAt: new Date().toISOString()
          }
        }
      });

      return { verified: false };
    } catch (error) {
      // Mark challenge as failed with error
      await this.prisma.challenge.update({
        where: { id: expectedChallenge.id },
        data: { 
          used: true,
          active: false,
          usedAt: new Date(),
          verificationSuccess: false,
          metadata: {
            ...((expectedChallenge.metadata as unknown) as ChallengeMetadata),
            error: error.message,
            failedAt: new Date().toISOString()
          }
        }
      });

      this.logger.error('Authentication verification failed', { 
        userId,
        error: error.message,
        stack: error.stack,
        context: 'PasskeyService.verifyAuthentication'
      });
      throw error;
    }
  }

  async storeTransactionHash(userId: string, transactionHash: string, iv: string) {
    this.logger.debug('Storing transaction hash', { 
      userId,
      context: 'PasskeyService.storeTransactionHash'
    });

    return this.prisma.mnemonicShareTransaction.updateMany({
      where: { 
        userId,
        active: true 
      },
      data: {
        transactionHash,
        iv
      }
    });
  }

  async getTransactionHash(userId: string) {
    this.logger.debug('Retrieving transaction hash', { 
      userId,
      context: 'PasskeyService.getTransactionHash'
    });

    const transaction = await this.prisma.mnemonicShareTransaction.findFirst({
      where: { 
        userId,
        active: true 
      },
      select: {
        transactionHash: true,
        iv: true
      }
    });

    if (!transaction) {
      this.logger.error('Active transaction not found', { 
        userId,
        context: 'PasskeyService.getTransactionHash'
      });
      throw new Error('Transaction not found');
    }

    return transaction;
  }
}
