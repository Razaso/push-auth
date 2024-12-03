import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { MnemonicShareService } from './mnemonic-share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mnemonic-share')
@UseGuards(JwtAuthGuard)
export class MnemonicShareController {
  private readonly logger = new Logger(MnemonicShareController.name);

  constructor(private mnemonicShareService: MnemonicShareService) {}

  @Post(':userId')
  async create(@Param('userId') userId: string, @Body('share') share: string) {
    this.logger.debug('Creating mnemonic share request received', { userId });
    return this.mnemonicShareService.create(userId, share);
  }

  @Get(':userId')
  async findByUserId(@Param('userId') userId: string) {
    this.logger.debug('Finding mnemonic share request received', { userId });
    return this.mnemonicShareService.findByUserId(userId);
  }

  @Put(':userId')
  async update(@Param('userId') userId: string, @Body('share') share: string) {
    this.logger.debug('Updating mnemonic share request received', { userId });
    return this.mnemonicShareService.update(userId, share);
  }

  @Delete(':userId')
  async delete(@Param('userId') userId: string) {
    this.logger.debug('Deleting mnemonic share request received', { userId });
    return this.mnemonicShareService.delete(userId);
  }
}