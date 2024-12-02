// export.controller.ts

import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

@Controller('export')
export class ExportController {

    @Get('xls')
    async exportXLS(@Res() res: Response) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('TestExportXLS');

        worksheet.columns = [
            { header: 'name', key: 'name' },
            { header: 'age', key: 'age' }
        ];

        worksheet.addRow({
            name: 'Neo Luo',
            age: 18
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.header('Content-Disposition', 'attachment; filename=anlikodullendirme.xlsx');
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    }
}