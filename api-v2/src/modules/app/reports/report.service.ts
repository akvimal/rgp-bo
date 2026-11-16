import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { storesVisibleTo } from "src/core/store-scope";
import { BadRequestException } from "@nestjs/common";
import { buildSaleReportQuery, MAX_REPORT_ROWS } from "./sale-report-query";

@Injectable()
export class ReportService {

    constructor(@InjectEntityManager() private manager: EntityManager) { }

    /** the sale report for the days asked, over the stores this person may read; every value the caller sends is a query parameter */
    async saleQuery(criteria:any, userId:number){
      const scope = await storesVisibleTo(this.manager, userId);
      const { sql, params } = buildSaleReportQuery(criteria, scope.stores);
      const rows = await this.manager.query(sql, params);
      if (rows.length > MAX_REPORT_ROWS) throw new BadRequestException(`That is more than ${MAX_REPORT_ROWS.toLocaleString('en-IN')} bill lines: choose fewer days or a product category.`);
      return rows;
    }

}
