import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveRequestStatus } from 'src/entities/leave-request.entity';

export class ApproveLeaveDto {
  @IsEnum(LeaveRequestStatus)
  status: LeaveRequestStatus; // APPROVED, REJECTED, or CANCELLED

  @IsString()
  @IsOptional()
  approvalcomments?: string;
}
