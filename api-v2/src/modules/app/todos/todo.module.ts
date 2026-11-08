import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';

@Module({
  imports: [AuthModule],
  controllers: [TodoController],
  providers: [TodoService],
  exports: [TodoService],
})
export class TodoModule {}
