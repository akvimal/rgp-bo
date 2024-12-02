import { ReportService } from "./report.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from 'express';
import { GeneratorService } from "./generator.service";

@ApiTags('Reports')
@Controller('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ReportController {

    constructor(private service:ReportService, private generator:GeneratorService){}

    @Post('/sale')
    async search(@Body() body: any, @Res() res: Response) {
      // console.log(body);
      const result = await this.service.saleQuery(body.criteria);

      // console.log(result.length);
      


      if(body.action == 'search')
        res.send(result);
      else if(body.action == 'export') {
        //get excel buffer
        const newresult = []
        if(result.length > 0){
          // console.log(result[0]);
          const keys = Object.keys(result[0]);
          if(keys.indexOf('more_props') >= 0) {
            keys.splice(keys.indexOf('more_props'),1);
          }
          result.forEach(rec => {
            // console.log(rec);
            const docs = (rec['more_props'] && rec['more_props']['documents']) || [];
            if(docs.length > 0){ //docs found ?
              // console.log(docs);
              docs.forEach(d => {
                // console.log(d['category'], d['props']);
                if(!keys.includes(d['category']))
                  keys.push(d['category']);
                rec[d['category']] = this.formatProps(d['props']);
              })
              
            }
            newresult.push(this.removeProps(rec, ['more_props']));
          });
          // console.log(keys);
          // console.log(newresult);

          const header = keys.map(k => {return {header: this.transformKeyToLabel(k), key: k}});
          const buffer = await this.generator.excel({sheet_name: 'Sale Report', header, data: newresult});

          //write buffer to output
          res.header('Content-Disposition', 'attachment;');
          res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.send(buffer);
        }
        
      }

    }

    formatProps(props){
      const arr = []
      props.forEach(p => {
        arr.push(`${p.label}: ${p.value}`)
      });
      return arr.join(', ')
    }
    removeProps(obj:any, props:string[]){
      const entries = Object.entries(obj);
      const filtered = entries.filter(entry => !props.includes(entry[0]))
      // console.log(entries);
      return Object.fromEntries(new Map(filtered));
    }

    transformKeyToLabel(input:string){
      const words = input.split('_').map(w => w.substring(0,1).toUpperCase() + w.substring(1));
      return words.join(' ');
    }

}