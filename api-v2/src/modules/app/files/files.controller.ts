import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { multerOptions } from './multer.config';
import { Response } from 'express';
import { AuthGuard } from "src/modules/auth/auth.guard";
import { DocumentQuotaGuard, PlatformService } from "src/core/platform/platform.service";
@ApiTags('Files')
@Controller('files')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class FilesController {

  constructor(private service:FilesService, private platform: PlatformService){}

  @Post('upload')
  @UseGuards(DocumentQuotaGuard)
  @UseInterceptors(FileInterceptor('file',multerOptions))
  async uploadFile(@UploadedFile() file: any) {
    await this.platform.bump('documents');
    return file;
  }

  @Post('view')
  view(@Body() body, @Res() response: Response) {
    const filepath = body.path;
    const file = this.service.imageBuffer(filepath);
    if(filepath.toLowerCase().endsWith('pdf')){
      response.contentType('application/pdf');
    }
    else if(filepath.toLowerCase().endsWith('jpeg')||filepath.toLowerCase().endsWith('jpg')){
      response.contentType('image/jpeg');
    }
    response.send(file);
  }

  // @Get('buffer')
  // buffer(@Res() response: Response) {
  //   const filepath = '/Users/vimalkrishnan/temp/upload/1000/cf6c3ab4-be73-47ac-92be-50bc125e086c.PDF';
  //   // const filepath = '/Users/vimalkrishnan/temp/upload/1000/731e61fd-a96f-4880-922b-e2904bf7b5b4.jpeg';
  //   const file = this.service.imageBuffer(filepath);
  //   if(filepath.toLowerCase().endsWith('pdf')){
  //     response.contentType('application/pdf');
  //   }
  //   else if(filepath.toLowerCase().endsWith('jpeg')||filepath.toLowerCase().endsWith('jpg')){
  //     response.contentType('image/jpeg');
  //   }
  //   response.send(file);
  // }

}