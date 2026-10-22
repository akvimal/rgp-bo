import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { createReadStream, existsSync, readFileSync } from 'fs';
import { join, resolve, sep } from 'path';


@Injectable()
export class FilesService { 

    constructor(@InjectEntityManager() private manager: EntityManager){}

    upload(){}

    /** only files under the upload folder can be read back */
    imageBuffer(filepath) {
        const root = resolve(process.env.FILEUPLOAD_LOCATION || './upload');
        const target = resolve(String(filepath ?? ''));
        if (target !== root && !target.startsWith(root + sep)) throw new ForbiddenException('That file is not available.');
        if (!existsSync(target)) throw new NotFoundException('That file is not available.');
        return readFileSync(target);
      }
}