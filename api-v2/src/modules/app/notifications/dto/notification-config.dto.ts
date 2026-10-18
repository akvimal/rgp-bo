import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";

export class StoreNotificationDto {
  @IsInt()
  id: number;

  @ApiPropertyOptional({ description: "Telegram chat id, e.g. -1001234567890" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telegramchatid?: string;

  @IsOptional()
  @IsBoolean()
  telegramdigestenabled?: boolean;
}

export class SaveNotificationConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreNotificationDto)
  stores?: StoreNotificationDto[];

  @IsOptional()
  @IsBoolean()
  dailyenabled?: boolean;

  @ApiPropertyOptional({ example: "22:30", description: "HH:mm, Asia/Kolkata" })
  @IsOptional()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: "dailytime must be HH:mm" })
  dailytime?: string;

  @ApiPropertyOptional({ description: "Chat for the all-stores digest incl. purchases; empty disables it" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  consolidatedchatid?: string;
}

export class TestMessageDto {
  @IsString()
  @MaxLength(40)
  chatid: string;
}
