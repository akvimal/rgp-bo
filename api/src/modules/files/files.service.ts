import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';


@Injectable()
export class FilesService { 

    constructor(@InjectEntityManager() private manager: EntityManager){}

    upload(){}

    imageBuffer(filepath) {
        return readFileSync(filepath);
      }
}