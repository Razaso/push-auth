import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import base64url from 'base64url';

@Injectable()
export class PasskeyService {
  constructor(private prisma: PrismaService) {}

  private readonly rpName = 'Push Protocol';
  private readonly rpID = 'localhost';
  private readonly origin = 'http://localhost:5173';

  async generateRegistrationOptions(userId: string) {
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

    // Convert challenge to base64URL before storing
    const challengeBase64URL = Buffer.from(options.challenge)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    await this.prisma.challenge.create({
      data: {
        userId,
        challenge: challengeBase64URL,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }
    });

    return options;
  }

  async verifyRegistration(userId: string, credential: any) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (verification.verified) {
      await this.prisma.mnemonicShareTransaction.create({
        data: {
          credentialId: credential.id,
          publicKey: Buffer.from(verification.registrationInfo?.credentialPublicKey).toString('base64'),
          counter: verification.registrationInfo?.counter,
          transactionHash: '',
          iv: '',
          user: {
            connect: {
              id: userId
            }
          }
        }
      });
    }

    return verification;
  }

  async generateAuthenticationChallenge(userId: string) {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
    });

    // First, delete any existing challenges for this user
    await this.prisma.challenge.deleteMany({
      where: { userId }
    });

    // Convert challenge to base64URL before storing
    const challengeBase64URL = Buffer.from(options.challenge)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Then create the new challenge
    await this.prisma.challenge.create({
      data: {
        userId,
        challenge: challengeBase64URL,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }
    });

    return options;
  }

  
  async verifyAuthentication(userId: string, credential: any) {
    // Restructure the credential to match expected format
    const formattedCredential = {
      id: credential.id,
      rawId: credential.rawId,
      type: 'public-key' as const, // Add 'as const' to make it a literal type
      response: {
        authenticatorData: credential.authenticatorData,
        clientDataJSON: credential.clientDataJSON,
        signature: credential.signature
      },
      clientExtensionResults: {}
    };
  
    const expectedChallenge = await this.prisma.challenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  
    if (!expectedChallenge) {
      throw new Error('Challenge not found or expired');
    }
  
    const authenticator = await this.prisma.mnemonicShareTransaction.findFirst({
      where: { 
        credentialId: credential.id,
        userId: userId
      }
    });
  
    if (!authenticator) {
      throw new Error('Authenticator not found');
    }
    
    // Decode the base64URL challenge back to original format
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
        await this.prisma.mnemonicShareTransaction.update({
          where: { 
            userId: authenticator.userId,
            credentialId: credential.id
          },
          data: { 
            counter: verification.authenticationInfo.newCounter,
            updatedAt: new Date()
          }
        });
  
        return { 
          verified: true,
          transactionHash: authenticator.transactionHash
        };
      }
  
      return { verified: false };
    } catch (error) {
      console.error('Authentication verification failed:', error);
      throw new Error('Authentication verification failed');
    }
  }

  async storeTransactionHash(
    userId: string,
    transactionHash: string,
    iv: string
  ) {
    return this.prisma.mnemonicShareTransaction.update({
      where: { userId },
      data: {
        transactionHash,
        iv
      }
    });
  }

  async getTransactionHash(userId: string) {
    const transaction = await this.prisma.mnemonicShareTransaction.findUnique({
      where: { userId },
      select: {
        transactionHash: true,
        iv: true
      }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }
}
