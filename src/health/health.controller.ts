import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../shared/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  root(): { name: string; status: string } {
    return {
      name: 'anonymous-chat-api',
      status: 'ok',
    };
  }

  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string } {
    return { status: 'ok' };
  }
}
