import { Body, Controller, Get, Post, Res, StreamableFile, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { User } from 'src/core/decorator/user.decorator';
import { SaleService } from 'src/modules/sales/sale.service';
import { RoleService } from '../roles/role.service';
import { PdfGenerateService } from './pdfgenerate.service';

@Controller('download')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class FileDownloadController {
  
  constructor(private service:PdfGenerateService, 
    private saleService:SaleService, 
    private roleService:RoleService){}

  @Post('/h1schedule')
  async getH1Schedule(@Body() criteria, @User() currentUser: any, @Res() res: Response) {
   
    const role = await this.roleService.findById(currentUser.roleid);
    const sale = Object.values(role.permissions).find((p:any) => p.resource === 'sales');
    const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;
    const items = (await this.saleService.findAllItems(criteria,owned)).map(item => {
  
      return {
        id:item.sale.id,
        product:item.purchaseitem.product.title,
        date:this.formatDate(new Date(item.sale.billdate)),
        customer:item.sale.props['ptntname'],
        mobile:item.sale.props['ptntmobile'],
        address:item.sale.props['ptntaddr'],
        doctor:item.sale.props['prescdoctor'],
        qty:item.qty
      }
    });
    
    const data = {fromdate:criteria.fromdate,todate:criteria.todate, items};
    const stream = await this.service.generate('templates/pdf/template.html',data);
    stream.pipe(res);
  }

  formatDate(dt:Date){
    let day = dt.getDate();
    let month = dt.getMonth();
    let year = dt.getFullYear();

   
    return ''+(day < 10 ? '0'+day : day) + '/' +
    (month < 10 ? '0'+(month+1) : (month+1)) + '/' + year;
  }
}