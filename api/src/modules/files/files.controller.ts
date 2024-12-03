import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { multerOptions } from './multer.config';
import { Response } from 'express';

@ApiTags('Files')
@Controller('files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class FilesController {

  constructor(private service:FilesService){}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file',multerOptions))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
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