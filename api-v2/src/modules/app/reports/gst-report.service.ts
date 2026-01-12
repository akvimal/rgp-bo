import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class GstReportService {
  constructor(
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {}

  /**
   * GSTR-1 Report: B2B Sales (Table 4)
   * Sales to businesses with GSTIN
   */
  async getGstr1B2bSales(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        c.gstn as customer_gstin,
        c.name as customer_name,
        c.state as place_of_supply,
        s.bill_no as invoice_number,
        s.bill_date as invoice_date,
        s.total as invoice_value,

        -- HSN-wise breakdown
        p.hsn_code,
        p.category as hsn_description,
        SUM(si.qty) as total_quantity,
        SUM(si.total) as taxable_value,

        -- Tax breakdown
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100) as total_tax,
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200) as cgst_amount,
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200) as sgst_amount,
        0 as igst_amount,

        p.tax_pcnt as gst_rate

      FROM sale s
      INNER JOIN customer c ON c.id = s.customer_id
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
        AND c.gstn IS NOT NULL
        AND c.gstn != ''
      GROUP BY
        c.gstn, c.name, c.state, s.bill_no, s.bill_date, s.total,
        p.hsn_code, p.category, p.tax_pcnt
      ORDER BY s.bill_date, s.bill_no
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * GSTR-1 Report: B2C Large Sales (Table 6C)
   * Sales > ₹2.5 lakhs without GSTIN
   */
  async getGstr1B2cLarge(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        COALESCE(c.state, 'Local') as place_of_supply,
        s.bill_no,
        s.bill_date,
        s.total as invoice_value,

        SUM(si.total) as taxable_value,
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100) as tax_amount,
        p.tax_pcnt as gst_rate

      FROM sale s
      LEFT JOIN customer c ON c.id = s.customer_id
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
        AND (c.gstn IS NULL OR c.gstn = '')
        AND s.total > 250000
      GROUP BY c.state, s.bill_no, s.bill_date, s.total, p.tax_pcnt
      ORDER BY s.bill_date
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * GSTR-1 Report: B2C Small Summary (Table 7)
   * Sales ≤ ₹2.5 lakhs - consolidated
   */
  async getGstr1B2cSmall(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        COALESCE(c.state, 'Local') as place_of_supply,
        p.tax_pcnt as gst_rate,
        COUNT(DISTINCT s.id) as invoice_count,
        SUM(si.total) as taxable_value,
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100) as tax_amount

      FROM sale s
      LEFT JOIN customer c ON c.id = s.customer_id
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
        AND (c.gstn IS NULL OR c.gstn = '')
        AND s.total <= 250000
      GROUP BY c.state, p.tax_pcnt
      ORDER BY c.state, p.tax_pcnt
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * GSTR-1 Report: HSN Summary (Table 12)
   * HSN-wise summary for all outward supplies
   */
  async getGstr1HsnSummary(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        p.hsn_code,
        p.category as hsn_description,
        'NOS' as uqc,
        SUM(si.qty) as total_quantity,
        SUM(si.total) as total_taxable_value,
        SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100) as total_tax_amount,
        p.tax_pcnt as gst_rate,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as cgst_amount,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as sgst_amount

      FROM sale s
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
      GROUP BY p.hsn_code, p.category, p.tax_pcnt
      ORDER BY p.hsn_code
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * GSTR-3B Report: Sales Summary by Tax Rate (Table 3.1)
   */
  async getGstr3bSalesSummary(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        p.tax_pcnt as gst_rate,
        SUM(si.total) as taxable_value,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as cgst_amount,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as sgst_amount,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100)::numeric, 2) as total_tax

      FROM sale s
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
      GROUP BY p.tax_pcnt
      ORDER BY p.tax_pcnt
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * GSTR-3B Report: ITC Available (Table 4)
   */
  async getGstr3bItcAvailable(startDate: string, endDate: string): Promise<any> {
    const query = `
      SELECT
        ROUND(SUM(pii.cgst_amount)::numeric, 2) as cgst_itc,
        ROUND(SUM(pii.sgst_amount)::numeric, 2) as sgst_itc,
        ROUND(SUM(pii.igst_amount)::numeric, 2) as igst_itc,
        ROUND(SUM(pii.cgst_amount + pii.sgst_amount + pii.igst_amount)::numeric, 2) as total_itc,
        COUNT(DISTINCT pi.id) as invoice_count

      FROM purchase_invoice pi
      INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
      INNER JOIN vendor v ON v.id = pi.vendor_id
      WHERE pi.invoice_date >= $1
        AND pi.invoice_date <= $2
        AND pi.status NOT IN ('CANCELLED', 'DRAFT')
        AND pi.active = true
        AND v.gstn IS NOT NULL
        AND v.gstn != ''
        AND pi.tax_status = 'ITC_ELIGIBLE'
    `;

    const result = await this.entityManager.query(query, [startDate, endDate]);
    return result[0] || {
      cgst_itc: 0,
      sgst_itc: 0,
      igst_itc: 0,
      total_itc: 0,
      invoice_count: 0,
    };
  }

  /**
   * Purchase Reconciliation Report
   * For comparing with GSTR-2B
   */
  async getPurchaseReconciliation(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        v.gstn as vendor_gstin,
        v.business_name as vendor_name,
        pi.invoice_no,
        pi.invoice_date,
        pi.grno as grn_number,
        pi.grdate as grn_date,
        ROUND((pi.total - COALESCE(pi.tax_amount, 0))::numeric, 2) as taxable_value,
        ROUND(SUM(pii.cgst_amount)::numeric, 2) as cgst_amount,
        ROUND(SUM(pii.sgst_amount)::numeric, 2) as sgst_amount,
        ROUND(SUM(pii.igst_amount)::numeric, 2) as igst_amount,
        ROUND(pi.total::numeric, 2) as total_invoice_value,
        pi.payment_status,
        pi.tax_status,
        pi.gstr2b_verified,
        pi.payment_due_date,
        pi.payment_made_date,

        -- HSN details
        p.hsn_code,
        ROUND(SUM(pii.qty)::numeric, 2) as quantity,
        ROUND(SUM(pii.total)::numeric, 2) as item_taxable_value

      FROM purchase_invoice pi
      INNER JOIN vendor v ON v.id = pi.vendor_id
      INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
      INNER JOIN product p ON p.id = pii.product_id
      WHERE pi.invoice_date >= $1
        AND pi.invoice_date <= $2
        AND pi.status NOT IN ('CANCELLED')
      GROUP BY
        v.gstn, v.business_name, pi.invoice_no, pi.invoice_date,
        pi.grno, pi.grdate, pi.total, pi.tax_amount,
        pi.payment_status, pi.tax_status, pi.gstr2b_verified,
        pi.payment_due_date, pi.payment_made_date, p.hsn_code
      ORDER BY v.gstn, pi.invoice_date
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * Vendor-wise ITC Summary
   */
  async getVendorWiseItc(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT
        v.gstn,
        v.business_name as vendor_name,
        COUNT(DISTINCT pi.id) as invoice_count,
        ROUND(SUM(pi.total - COALESCE(pi.tax_amount, 0))::numeric, 2) as total_taxable_value,
        ROUND(SUM(pii.cgst_amount)::numeric, 2) as total_cgst_itc,
        ROUND(SUM(pii.sgst_amount)::numeric, 2) as total_sgst_itc,
        ROUND(SUM(pii.igst_amount)::numeric, 2) as total_igst_itc,
        ROUND(SUM(pii.cgst_amount + pii.sgst_amount + pii.igst_amount)::numeric, 2) as total_itc

      FROM vendor v
      INNER JOIN purchase_invoice pi ON pi.vendor_id = v.id
      INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
      WHERE pi.invoice_date >= $1
        AND pi.invoice_date <= $2
        AND pi.tax_status = 'ITC_ELIGIBLE'
      GROUP BY v.gstn, v.business_name
      ORDER BY total_itc DESC
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * ITC Dashboard - Monthly Summary
   */
  async getItcDashboard(): Promise<any[]> {
    const query = `SELECT * FROM v_itc_dashboard ORDER BY invoice_month DESC LIMIT 12`;
    return await this.entityManager.query(query);
  }

  /**
   * ITC Payment Risk Report
   * Invoices at risk of ITC reversal (payment not made within 180 days)
   */
  async getItcPaymentRisk(): Promise<any[]> {
    const query = `SELECT * FROM v_itc_payment_risk ORDER BY payment_due_date ASC`;
    return await this.entityManager.query(query);
  }

  /**
   * Update invoice ITC status
   */
  async updateItcStatus(
    invoiceIds: number[],
    status: string,
    reason?: string,
  ): Promise<any> {
    const updates: any = { tax_status: status };

    if (status === 'ITC_ELIGIBLE') {
      updates.gstr2b_verified = true;
      updates.gstr2b_verified_date = new Date();
    } else if (status === 'ITC_INELIGIBLE' && reason) {
      updates.itc_ineligible_reason = reason;
    } else if (status === 'ITC_CLAIMED') {
      updates.itc_claim_date = new Date();
    }

    const query = `
      UPDATE purchase_invoice
      SET ${Object.keys(updates)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ')}
      WHERE id = ANY($1)
      RETURNING id, invoice_no, tax_status
    `;

    const values = [invoiceIds, ...Object.values(updates)];
    return await this.entityManager.query(query, values);
  }

  /**
   * Mark invoices as verified in GSTR-2B
   */
  async markGstr2bVerified(invoiceIds: number[]): Promise<any> {
    const query = `
      UPDATE purchase_invoice
      SET gstr2b_verified = true,
          gstr2b_verified_date = CURRENT_DATE,
          tax_status = CASE
            WHEN tax_status = 'PENDING' THEN 'ITC_ELIGIBLE'
            ELSE tax_status
          END
      WHERE id = ANY($1)
      RETURNING id, invoice_no, tax_status, gstr2b_verified
    `;

    return await this.entityManager.query(query, [invoiceIds]);
  }

  /**
   * Bulk claim ITC for a month
   */
  async bulkClaimItc(startDate: string, endDate: string): Promise<any> {
    const query = `
      UPDATE purchase_invoice
      SET tax_status = 'ITC_CLAIMED',
          itc_claim_date = CURRENT_DATE
      WHERE tax_status = 'ITC_ELIGIBLE'
        AND invoice_date >= $1
        AND invoice_date <= $2
        AND gstr2b_verified = true
      RETURNING id, invoice_no, vendor_id
    `;

    return await this.entityManager.query(query, [startDate, endDate]);
  }

  /**
   * Get GST Summary for Dashboard
   */
  async getGstSummary(startDate: string, endDate: string): Promise<any> {
    const salesQuery = `
      SELECT
        'Sales' as type,
        COUNT(DISTINCT s.id) as transaction_count,
        ROUND(SUM(si.total)::numeric, 2) as taxable_value,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as cgst,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 200)::numeric, 2) as sgst,
        ROUND(SUM(si.total * COALESCE(p.tax_pcnt, 0) / 100)::numeric, 2) as total_tax
      FROM sale s
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1 AND s.bill_date <= $2
    `;

    const purchasesQuery = `
      SELECT
        'Purchases' as type,
        COUNT(DISTINCT pi.id) as transaction_count,
        ROUND(SUM(pi.total - COALESCE(pi.tax_amount, 0))::numeric, 2) as taxable_value,
        ROUND(SUM(pii.cgst_amount)::numeric, 2) as cgst,
        ROUND(SUM(pii.sgst_amount)::numeric, 2) as sgst,
        ROUND(SUM(pii.cgst_amount + pii.sgst_amount + pii.igst_amount)::numeric, 2) as total_tax
      FROM purchase_invoice pi
      INNER JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
      WHERE pi.invoice_date >= $1
        AND pi.invoice_date <= $2
        AND pi.status NOT IN ('CANCELLED', 'DRAFT')
        AND pi.tax_status = 'ITC_ELIGIBLE'
    `;

    const sales = await this.entityManager.query(salesQuery, [startDate, endDate]);
    const purchases = await this.entityManager.query(purchasesQuery, [
      startDate,
      endDate,
    ]);

    const salesData = sales[0] || {
      transaction_count: 0,
      taxable_value: 0,
      cgst: 0,
      sgst: 0,
      total_tax: 0,
    };
    const purchaseData = purchases[0] || {
      transaction_count: 0,
      taxable_value: 0,
      cgst: 0,
      sgst: 0,
      total_tax: 0,
    };

    return {
      sales: salesData,
      purchases: purchaseData,
      netTax: {
        cgst: parseFloat(salesData.cgst || 0) - parseFloat(purchaseData.cgst || 0),
        sgst: parseFloat(salesData.sgst || 0) - parseFloat(purchaseData.sgst || 0),
        total:
          parseFloat(salesData.total_tax || 0) -
          parseFloat(purchaseData.total_tax || 0),
      },
    };
  }

  /**
   * Get missing data report (validation)
   */
  async getMissingDataReport(startDate: string, endDate: string): Promise<any> {
    const missingHsnQuery = `
      SELECT
        'Missing HSN' as issue,
        COUNT(*) as count,
        json_agg(json_build_object(
          'invoice_no', s.bill_no,
          'date', s.bill_date,
          'product', p.title
        )) as details
      FROM sale s
      INNER JOIN sale_item si ON si.sale_id = s.id
      INNER JOIN product p ON p.id = si.product_id
      WHERE s.bill_date >= $1
        AND s.bill_date <= $2
        AND (p.hsn_code IS NULL OR p.hsn_code = '')
    `;

    const missingGstinQuery = `
      SELECT
        'Missing Vendor GSTIN' as issue,
        COUNT(*) as count,
        json_agg(json_build_object(
          'invoice_no', pi.invoice_no,
          'date', pi.invoice_date,
          'vendor', v.business_name
        )) as details
      FROM purchase_invoice pi
      INNER JOIN vendor v ON v.id = pi.vendor_id
      WHERE pi.invoice_date >= $1
        AND pi.invoice_date <= $2
        AND (v.gstn IS NULL OR v.gstn = '')
    `;

    const missingHsn = await this.entityManager.query(missingHsnQuery, [
      startDate,
      endDate,
    ]);
    const missingGstin = await this.entityManager.query(missingGstinQuery, [
      startDate,
      endDate,
    ]);

    return {
      missingHsn: missingHsn[0] || { count: 0, details: [] },
      missingGstin: missingGstin[0] || { count: 0, details: [] },
    };
  }
}
