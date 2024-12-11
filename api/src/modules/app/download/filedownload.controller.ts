import { Body, Controller, Get, Param, Post, Res, StreamableFile, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { User } from '../../../core/decorator/user.decorator';
import { PurchaseService } from '../../../modules/purchases/purchase.service';
import { SaleService } from '../../../modules/sales/sale.service';

import { RoleService } from '../roles/role.service';
import { PdfGenerateService } from './pdfgenerate.service';

@Controller('download')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class FileDownloadController {

  business = 'Ramesh Generic Pharmacy, No.1/256, 4th Street, Kalamegam Salai, Tiruvallur, TAMIL NADU - 600037'
  
  constructor(private service:PdfGenerateService, 
    private saleService:SaleService, 
    private roleService:RoleService,
    private poService:PurchaseService){}

  @Post('/salereport')
  async getH1Schedule(@Body() criteria, @User() currentUser: any, @Res() res: Response) {
   
    const {sign} = criteria;
    const role = await this.roleService.findById(currentUser.roleid);
    const sale = Object.values(role.permissions).find((p:any) => p.resource === 'sales');
    
    const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;
    
    const items = (await this.saleService.findAllItems(criteria,owned)).map(item => {
    
      return {    
        documents:item.sale.props && item.sale.props['documents'] ? item.sale.props['documents']: [],
        billno:item.sale.billno,
        product:item.purchaseitem.product.title,
        billdate:this.formatDate(new Date(item.sale.billdate)),
        batch:item.batch,expiry:item.expdate,
        qty:item.qty
      }
    });
    
    const stream = await this.service.generate('templates/pdf/sale-report.html',{business:this.business, criteria: this.format(criteria),sign:sign||false,items});
    stream.pipe(res);
  }

  format(obj){
    let out = ''
   
    const props = Object.entries(obj) 
    props.forEach(p => {
      if(typeof p[1] == 'string')
      out += `${p[0]}: ${p[1]}  `
    });
   
    if(obj.props){
      obj.props.forEach(p => {
        out += `${p.id}: ${p.value}  `
      })
    }
   
   return out;
  }

  @Post('/po')
  async getPO(@Body() criteria, @User() currentUser: any, @Res() res: Response) {
   
    const order = (await this.poService.findOrderById(criteria.id));
    
    if(order) {
      
      const requests = order.requests.map(req => {
  
      return {
        // id:req.sale.id,
        product:req.product.title,
        // date:this.formatDate(new Date(item.sale.billdate)),
        // customer:item.sale.props['ptntname'],
        // mobile:item.sale.props['ptntmobile'],
        // address:item.sale.props['ptntaddr'],
        // doctor:item.sale.props['prescdoctor'],
        qty:req.qty
      }
    });
    
    const data = {order, orderdate: this.formatDate(new Date(order.createdon)), requests};
    const stream = await this.service.generate('templates/pdf/po-template.html',data);
    stream.pipe(res);
  }
  }

  formatDate(dt:Date){
    let day = dt.getDate();
    let month = dt.getMonth()+1;
    let year = dt.getFullYear();
   
    return ''+(day < 10 ? '0'+day : day) + '/' +
    (month < 10 ? '0'+month : month) + '/' + (year%2000);
  }
}