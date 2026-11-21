import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { ReferenceDataService } from './reference-data.service';

const one = (mb: number) => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: mb * 1024 * 1024 } });
const pdf = one(20);
const sheet = one(25);
const cdci = FilesInterceptor('files', 8, { storage: memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

/** Loading and refreshing the brand dictionary and the price lists from the screen. The Business Head only; the service checks. */
@ApiTags('Reference data')
@Controller('reference-data')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  @Get('status') status(@User() user: any) { return this.service.status(user); }

  // the PMBI Jan Aushadhi list (PDF)
  @Post('pmbi/preview') @UseInterceptors(pdf)
  previewPmbi(@User() user: any, @UploadedFile() file: any, @Body() body: any) { return this.service.previewPmbi(user, file?.buffer, body); }

  @Post('pmbi/apply') @UseInterceptors(pdf)
  applyPmbi(@User() user: any, @UploadedFile() file: any, @Body() body: any) { return this.service.applyPmbi(user, file?.buffer, body); }

  // another seller's list (CSV or Excel)
  @Post('sheet/preview') @UseInterceptors(sheet)
  previewSheet(@User() user: any, @UploadedFile() file: any, @Body() body: any) { return this.service.previewSheet(user, file?.buffer, String(file?.originalname || ''), body); }

  @Post('sheet/apply') @UseInterceptors(sheet)
  applySheet(@User() user: any, @UploadedFile() file: any, @Body() body: any) { return this.service.applySheet(user, file?.buffer, String(file?.originalname || ''), body); }

  @Delete('lists/:id')
  remove(@User() user: any, @Param('id', ParseIntPipe) id: number) { return this.service.deleteList(user, id); }

  // the brand dictionary (the CDCI files)
  @Post('brands/preview') @UseInterceptors(cdci)
  previewBrands(@User() user: any, @UploadedFiles() files: any[]) { return this.service.previewBrands(user, this.named(files)); }

  @Post('brands/apply') @UseInterceptors(cdci)
  applyBrands(@User() user: any, @UploadedFiles() files: any[], @Body() body: any) { return this.service.applyBrands(user, this.named(files), body); }

  private named(files: any[]) {
    if (!files?.length) throw new BadRequestException('Choose the CDCI files.');
    return files.map((f) => ({ originalname: String(f.originalname || ''), buffer: f.buffer as Buffer }));
  }
}
