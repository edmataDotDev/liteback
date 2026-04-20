import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health-like hello endpoint' })
  @ApiOkResponse({ description: 'Returns hello message' })
  getHello(): string {
    return this.appService.getHello();
  }
}
