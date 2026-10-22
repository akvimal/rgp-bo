import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve, sep } from 'path';

/** a stored file's path, checked to be an existing file under the upload folder (nothing else on the server can be read through it) */
export function uploadedFilePath(filepath: any): string {
  const root = resolve(process.env.FILEUPLOAD_LOCATION || './upload');
  const target = resolve(String(filepath ?? ''));
  if (target !== root && !target.startsWith(root + sep)) throw new ForbiddenException('That file is not available.');
  if (!existsSync(target)) throw new NotFoundException('That file is not available.');
  return target;
}
