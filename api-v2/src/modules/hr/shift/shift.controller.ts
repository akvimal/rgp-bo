import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from '../dto/shift/create-shift.dto';
import { UpdateShiftDto } from '../dto/shift/update-shift.dto';
import { AssignUserShiftDto } from '../dto/shift/assign-user-shift.dto';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';

@Controller('hr/shifts')
@UseGuards(AuthGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  create(@Body() createShiftDto: CreateShiftDto, @User() user: any) {
    return this.shiftService.create(createShiftDto, user.id);
  }

  @Get()
  findAll(@Query('storeId', new ParseIntPipe({ optional: true })) storeId?: number) {
    return this.shiftService.findAll(storeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shiftService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateShiftDto: UpdateShiftDto,
    @User() user: any,
  ) {
    return this.shiftService.update(id, updateShiftDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.shiftService.remove(id, user.id);
  }

  @Post('assign')
  assignUser(@Body() assignDto: AssignUserShiftDto, @User() user: any) {
    return this.shiftService.assignUserToShift(assignDto, user.id);
  }

  @Get('user/:userId/current')
  getUserCurrentShift(@Param('userId', ParseIntPipe) userId: number) {
    return this.shiftService.getUserCurrentShift(userId);
  }

  @Get('assignments/all')
  getAllAssignments() {
    return this.shiftService.getAllAssignments();
  }
}
