import { Injectable } from "@nestjs/common";
import * as ExcelJS from 'exceljs';

/** printed at the top of every exported report */
const SHOP_LINES = [
    'Ramesh Generic Pharmacy',
    '1/256 Kalamegam Salai, 4th Street, Mogappair West, Chennai - 600037',
    'DL#: TN-Z04-20-00009, TN-Z04-21-00009',
];

@Injectable()
export class GeneratorService {

   /** A workbook that only says why there is nothing to show (an export of an empty report). */
   async excelNote(sheetName: string, message: string) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName || 'Report');
        SHOP_LINES.forEach((line, i) => { worksheet.getCell(`A${i + 1}`).value = line; worksheet.getCell(`A${i + 1}`).font = { name: 'Calibri', size: 10, bold: true }; });
        worksheet.getCell('A5').value = message;
        worksheet.getColumn(1).width = 80;
        return await workbook.xlsx.writeBuffer();
   }

   async excel(request){

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(request.sheet_name || 'Report',{
            pageSetup:{paperSize: 9, orientation:'landscape'}
          });
          
        worksheet.columns = request.header;
        SHOP_LINES.forEach((line, i) => worksheet.insertRow(i + 1, [line]));
        const header_font = {
            name: 'Calibri',
            family: 4,
            size: 10,
            bold: true
        }
        worksheet.getCell('A1').font = header_font;
        worksheet.getCell('A2').font = header_font;
        worksheet.getCell('A3').font = header_font;
        worksheet.getRow(4).font = header_font;
        worksheet.getRow(4).fill = {type: 'pattern',
            pattern:'solid',
            fgColor:{argb:'badefc'}
          }

        let counter = 0;
        let temp = 0;
        let start = 5;
        let begin = 0;
        for(let index = 0; index < request.data.length; index++) {
          const item = request.data[index];
          if(temp !== item['bill_no']){
            counter = 1;
            temp = 0;
            begin = start + index;
          }
          temp = item['bill_no'];

          worksheet.addRow(item);
          // console.log(`A${begin}:A${start+index}`);
          worksheet.unMergeCells(`A${begin}`);
          worksheet.unMergeCells(`B${begin}`);
          worksheet.unMergeCells(`C${begin}`);
          worksheet.unMergeCells(`D${begin}`);
          worksheet.mergeCells(`A${begin}:A${start+index}`);
          worksheet.mergeCells(`B${begin}:B${start+index}`);
          worksheet.mergeCells(`C${begin}:C${start+index}`);
          worksheet.mergeCells(`D${begin}:D${start+index}`);
          counter ++;
        }
        return await workbook.xlsx.writeBuffer();
    }
}