import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';


@Injectable()
export class FilesService { 

    constructor(@InjectEntityManager() private manager: EntityManager){}

    upload(){}

    imageBuffer() {
        return readFileSync('/Users/vimalkrishnan/temp/upload/ef4745e9-21f5-46d4-b159-35415bb6c42b.jpeg');
      }
}