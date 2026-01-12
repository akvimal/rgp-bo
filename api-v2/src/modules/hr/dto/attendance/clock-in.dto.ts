import { IsOptional, IsString, IsInt } from 'class-validator';

export class ClockInDto {
  @IsInt()
  @IsOptional()
  shiftid?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClockInWithPhotoDto extends ClockInDto {
  photo?: Express.Multer.File; // Handled by multer
}
