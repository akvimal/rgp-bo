import { Body, Controller, Get, Module, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { User } from 'src/core/decorator/user.decorator';
import { RecognitionService } from './recognition.service';

/** Badges and thanks (RECOGNITION_AND_COMPLIANCE 4). A person reads their own; the heads read the people of their stores. No ranking exists. */
@ApiTags('Recognition')
@Controller('recognition')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class RecognitionController {
  constructor(private readonly service: RecognitionService) {}

  @Get('mine') mine(@User() u: any) { return this.service.mine(u); }
  @Get('team') team(@User() u: any) { return this.service.team(u); }
  @Post('seen') seen(@User() u: any) { return this.service.seen(u); }
  @Post('thanks') thanks(@Body() b: any, @User() u: any) { return this.service.thank(u, b); }
  @Post('run') run(@User() u: any) { return this.service.runNow(u); }
}

@Module({ imports: [AuthModule], controllers: [RecognitionController], providers: [RecognitionService], exports: [RecognitionService] })
export class RecognitionModule {}
