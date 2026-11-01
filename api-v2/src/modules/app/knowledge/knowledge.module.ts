import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

/** The weekly knowledge check: five questions a week, kept for coaching (not part of any KPI). */
@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
