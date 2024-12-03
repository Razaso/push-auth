import { Controller, Get, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}
  
  @Get()
  checkHealth() {
    this.logger.info('Health check requested');
    return { status: 'OK' };
  }
}