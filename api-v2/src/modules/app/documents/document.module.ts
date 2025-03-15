import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from "src/entities/document.entity";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
import { FilesModule } from "../files/files.module";

@Module({
    imports: [TypeOrmModule.forFeature([Document]),AuthModule,FilesModule],
    controllers: [DocumentController],
    providers: [DocumentService,JwtService],
    exports: [DocumentService],
  })
export class DocumentModule {}