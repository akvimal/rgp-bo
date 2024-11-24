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
    console.log(file);
    return {status:'SUCCESS',link:file.path}
  }

  @Get('buffer')
  buffer(@Res() response: Response) {
    const file = this.service.imageBuffer();
    response.contentType('image/png');
    response.send(file);
  }

}