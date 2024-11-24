import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

@Module({
    imports: [TypeOrmModule.forFeature([]),
    MulterModule],
    controllers: [FilesController],
    providers: [FilesService],
    exports: [FilesService],
  })
  export class FilesModule {}

  