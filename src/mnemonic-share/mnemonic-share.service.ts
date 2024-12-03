import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
@Injectable()
export class MnemonicShareService {

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService) {}

  async create(userId: string, share: string) {
    this.logger.info('Creating new mnemonic share', { userId });
    
    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // First, deactivate any existing active shares for this user
      await tx.mnemonicShare.updateMany({
        where: { 
          userId,
          active: true 
        },
        data: { 
          active: false 
        }
      });

      // Then create the new active share
      return tx.mnemonicShare.create({
        data: { 
          userId, 
          share,
          active: true 
        },
      });
    });
  }

  async findByUserId(userId: string) {
    this.logger.debug('Finding active mnemonic share', { userId });
    return this.prisma.mnemonicShare.findFirst({
      where: { 
        userId,
        active: true 
      },
    });
  }

  async update(userId: string, share: string) {
    this.logger.debug('Updating mnemonic share', { userId });
    
    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // First, deactivate existing active share
      await tx.mnemonicShare.updateMany({
        where: { 
          userId,
          active: true 
        },
        data: { 
          active: false 
        }
      });

      // Then create new active share
      return tx.mnemonicShare.create({
        data: { 
          userId, 
          share,
          active: true 
        },
      });
    });
  }

  async delete(userId: string) {
    this.logger.debug('Deactivating mnemonic share', { userId });
    return this.prisma.mnemonicShare.updateMany({
      where: { 
        userId,
        active: true 
      },
      data: { 
        active: false 
      },
    });
  }

  // Optional: Method to get share history
  async getShareHistory(userId: string) {
    this.logger.debug('Getting mnemonic share history', { userId });
    return this.prisma.mnemonicShare.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}