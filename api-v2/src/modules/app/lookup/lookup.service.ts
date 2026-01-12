import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class LookupService {
  constructor(@InjectEntityManager() private manager: EntityManager) {}

  async find(entity: string, property: string, query: string): Promise<string[]> {
    // Map entity names to table names
    const entityTableMap: Record<string, string> = {
      product: 'product',
      customer: 'customer',
      vendor: 'vendor',
      sale: 'sale',
    };

    // Map property names to column names
    const propertyColumnMap: Record<string, string> = {
      brand: 'brand',
      mfr: 'mfr',
      title: 'title',
      product_code: 'product_code',
      name: 'name',
      business_name: 'business_name',
    };

    const tableName = entityTableMap[entity];
    const columnName = propertyColumnMap[property];

    if (!tableName || !columnName) {
      return [];
    }

    try {
      // Use parameterized query to prevent SQL injection
      const result = await this.manager.query(
        `
        SELECT DISTINCT ${columnName}
        FROM ${tableName}
        WHERE ${columnName} IS NOT NULL
          AND ${columnName} != ''
          AND LOWER(${columnName}) LIKE LOWER($1)
          AND active = true
        ORDER BY ${columnName} ASC
        LIMIT 10
      `,
        [`%${query}%`],
      );

      return result.map((r: any) => r[columnName]);
    } catch (error) {
      console.error(`Lookup error for ${entity}.${property}:`, error);
      return [];
    }
  }
}
