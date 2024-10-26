// src/users/users.module.ts

import { Module } from '@nestjs/common';
import { MnemonicShareService } from './mnemonic-share.service';
import { MnemonicShareController } from './mnemonic-share.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MnemonicShareService],
  controllers: [MnemonicShareController],
  exports: [MnemonicShareService],
})
export class MnemonicShareModule {}
