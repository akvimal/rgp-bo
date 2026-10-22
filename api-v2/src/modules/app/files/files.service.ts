import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';
import { uploadedFilePath } from './upload-path';


@Injectable()
export class FilesService { 

    constructor(@InjectEntityManager() private manager: EntityManager){}

    upload(){}

    /** only files under the upload folder can be read back */
    imageBuffer(filepath) {
        return readFileSync(uploadedFilePath(filepath));
      }
}