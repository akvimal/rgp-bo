import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TodoModule } from '../todos/todo.module';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [AuthModule, TodoModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService, JwtService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
