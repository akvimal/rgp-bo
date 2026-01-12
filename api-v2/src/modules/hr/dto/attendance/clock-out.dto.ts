import { IsOptional, IsString } from 'class-validator';

export class ClockOutDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClockOutWithPhotoDto extends ClockOutDto {
  photo?: Express.Multer.File; // Handled by multer
}
