import { Module } from '@nestjs/common';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PasskeyController],
  providers: [PasskeyService],
  exports: [PasskeyService]
})
export class PasskeyModule {}