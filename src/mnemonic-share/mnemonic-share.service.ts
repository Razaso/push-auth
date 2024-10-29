import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MnemonicShareService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, share: string) {
    return this.prisma.mnemonicShare.create({
      data: {
        userId,
        share,
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.mnemonicShare.findUnique({
      where: { userId },
    });
  }

  async update(userId: string, share: string) {
    return this.prisma.mnemonicShare.update({
      where: { userId },
      data: { share },
    });
  }

  async delete(userId: string) {
    return this.prisma.mnemonicShare.delete({
      where: { userId },
    });
  }
}