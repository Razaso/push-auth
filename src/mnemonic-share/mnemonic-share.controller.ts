import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MnemonicShareService } from './mnemonic-share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mnemonic-share')
@UseGuards(JwtAuthGuard)
export class MnemonicShareController {
  constructor(private mnemonicShareService: MnemonicShareService) {}

  @Post(':userId')
  async create(@Param('userId') userId: string, @Body('share1') share1: string) {
    return this.mnemonicShareService.create(userId, share1);
  }

  @Get(':userId')
  async findByUserId(@Param('userId') userId: string) {
    return this.mnemonicShareService.findByUserId(userId);
  }

  @Put(':userId')
  async update(@Param('userId') userId: string, @Body('share1') share1: string) {
    return this.mnemonicShareService.update(userId, share1);
  }

  @Delete(':userId')
  async delete(@Param('userId') userId: string) {
    return this.mnemonicShareService.delete(userId);
  }
}