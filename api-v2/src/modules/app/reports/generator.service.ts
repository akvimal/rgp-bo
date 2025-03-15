import { Injectable } from "@nestjs/common";
import * as ExcelJS from 'exceljs';

@Injectable()
export class GeneratorService {

   async excel(request){

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(request.sheet_name || 'Report',{
            pageSetup:{paperSize: 9, orientation:'landscape'}
          });
          
        worksheet.columns = request.header;
        worksheet.insertRow(1,['Ramesh Generic Pharmacy']);
        worksheet.insertRow(2,['1/256 Kalamegam Salai, 4th Street, Mogappair West, Chennai - 600037']);
        worksheet.insertRow(3,['DL#: TN-Z04-20-00009, TN-Z04-21-00009']);
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