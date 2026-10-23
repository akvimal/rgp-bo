import { Body, Controller, Get, Module, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { User } from 'src/core/decorator/user.decorator';
import { StaffDetailsService } from './staff-details.service';

/** The owner's (and a Store Head's) short list of staff details, for shops that do not run the HR module. */
@ApiTags('Staff details')
@Controller('staff-details')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StaffDetailsController {
  constructor(private readonly service: StaffDetailsService) {}

  @Get() list(@User() u: any) { return this.service.list(u); }
  @Put(':userId') save(@Param('userId', ParseIntPipe) userId: number, @Body() b: any, @User() u: any) { return this.service.save(userId, b, u); }
}

@Module({ imports: [AuthModule], controllers: [StaffDetailsController], providers: [StaffDetailsService] })
export class StaffDetailsModule {}
