import { DocumentService } from "./document.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { AuthGuard } from "@nestjs/passport";

@ApiTags('Documents')
@Controller('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class DocumentController {

    constructor(private service:DocumentService){}

    @Post()
    async create(@Body() dto: CreateDocumentDto) {
        return this.service.save(dto);
    }

    @Post('/filter')
    async filter(@Body() body) {
        return this.service.filter(body.ids);
    }

    @Get()
    async findAll() {
      return this.service.findAll();
    }

    @Get(':id')
    async findById(@Param('id') id: number) {
      return this.service.findById(id);
    }

}