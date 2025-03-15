import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";
import { multerOptions } from "./multer.config";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";

@Module({
    imports: [
      TypeOrmModule.forFeature([]),
      MulterModule.register(multerOptions),
      AuthModule
    ],
    controllers: [FilesController],
    providers: [FilesService,JwtService],
    exports: [FilesService],
  })
  export class FilesModule {}

  