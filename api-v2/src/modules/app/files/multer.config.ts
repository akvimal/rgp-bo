import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { HttpException, HttpStatus } from '@nestjs/common';

// Multer configuration
export const multerConfig = {
    dest: process.env.FILEUPLOAD_LOCATION,
};

// Multer upload options
export const multerOptions = {
    // Enable file size limits
    limits: {
        fileSize: +(process.env.FILEUPLOAD_SIZE_LIMIT || 10 * 1024 * 1024), // Default 10MB if not set (a phone photo of an invoice is several MB)
    },
    // Check the mimetypes to allow for upload
    fileFilter: (req: any, file: any, cb: any) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf)$/)) {
            // Allow storage of file
            cb(null, true);
        } else {
            // Reject file
            cb(new HttpException(`Unsupported file type ${extname(file.originalname)}`, HttpStatus.BAD_REQUEST), false);
        }
    },
    // Storage properties
    storage: diskStorage({
        // Destination storage path details
        destination: (req: any, file: any, cb: any) => {
            // the folder is named from the query (?expense=12-1700000000): letters, digits, - and _ only, so it cannot leave the upload folder
            const query = req['query'] || {};
            const key = Object.keys(query)[0] || 'misc';
            const safe = (v: any) => String(v ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'x';
            const uploadPath = `${multerConfig.dest}/${safe(key)}/${safe(query[key])}`;
            try {
                // Create folder (and its parent) if doesn't exist
                if (!existsSync(uploadPath)) {
                    mkdirSync(uploadPath, { recursive: true });
                }
            } catch (err) {
                return cb(new HttpException('The file could not be stored.', HttpStatus.INTERNAL_SERVER_ERROR), '');
            }
            cb(null, uploadPath);
        },
        // File modification details
        filename: (req: any, file: any, cb: any) => {
            // Calling the callback passing the random name generated with the original extension name
            cb(null, `${uuid()}${extname(file.originalname)}`);            
        },
    }),
};