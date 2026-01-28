import { PartialType } from '@nestjs/swagger';
import { CreateHrPolicyDto } from './create-hr-policy.dto';

export class UpdateHrPolicyDto extends PartialType(CreateHrPolicyDto) {}
