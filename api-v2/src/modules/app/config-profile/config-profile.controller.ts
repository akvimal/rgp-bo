import { BadRequestException, Body, Controller, Get, Header, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { ConfigProfileService } from './config-profile.service';

const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Export and import of the business setup (business, stores with shifts, staff logins). The Business Head only; the service checks. */
@ApiTags('Business setup file')
@Controller('config-profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ConfigProfileController {
  constructor(private readonly service: ConfigProfileService) {}

  @Get('export')
  export(@User() user: any) {
    return this.service.export(user);
  }

  @Get('export.xlsx')
  async exportXlsx(@User() user: any, @Res() res: Response) {
    const buf = await this.service.exportWorkbook(user);
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': 'attachment; filename="business-setup.xlsx"' }).send(buf);
  }

  @Get('template.xlsx')
  async template(@User() user: any, @Res() res: Response) {
    const buf = await this.service.templateWorkbook(user);
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': 'attachment; filename="business-setup-template.xlsx"' }).send(buf);
  }

  /** an Excel file read into a profile, to be shown and then sent to preview / apply like a JSON one */
  @Post('read-xlsx')
  @UseInterceptors(upload)
  async readXlsx(@User() user: any, @UploadedFile() file: any) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an Excel (.xlsx) file.');
    return this.service.readWorkbook(user, file.buffer);
  }

  @Post('preview')
  preview(@User() user: any, @Body() body: any) {
    return this.service.preview(user, body);
  }

  /** the temporary passwords of new logins are in this answer and nowhere else, so it must not be kept by a cache */
  @Post('apply')
  @Header('Cache-Control', 'no-store')
  apply(@User() user: any, @Body() body: any) {
    return this.service.apply(user, body);
  }
}
