import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class LookupService {
  // Whitelist of allowed entities and their properties
  private readonly allowedLookups = {
    product: ['brand', 'mfr', 'category', 'hsn_code', 'title', 'product_code'],
    customer: ['city', 'state', 'name', 'mobile', 'area', 'locality'],
    vendor: ['city', 'state', 'name'],
  };

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async findDistinctValues(
    entity: string,
    property: string,
    query: string,
  ): Promise<string[]> {
    // Validate entity and property
    const allowedProperties = this.allowedLookups[entity.toLowerCase()];
    if (!allowedProperties) {
      throw new BadRequestException(`Entity '${entity}' is not supported for lookup`);
    }

    if (!allowedProperties.includes(property.toLowerCase())) {
      throw new BadRequestException(
        `Property '${property}' is not allowed for entity '${entity}'`,
      );
    }

    // Sanitize table and column names to prevent SQL injection
    const tableName = this.sanitizeIdentifier(entity);
    const columnName = this.sanitizeIdentifier(property);
    const searchPattern = `%${query}%`;

    try {
      // Use parameterized query to prevent SQL injection
      const result = await this.dataSource.query(
        `SELECT DISTINCT "${columnName}" as value
         FROM "${tableName}"
         WHERE "${columnName}" ILIKE $1
           AND "${columnName}" IS NOT NULL
           AND "${columnName}" != ''
         ORDER BY "${columnName}"
         LIMIT 20`,
        [searchPattern],
      );

      return result.map((row) => row.value);
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch lookup values: ${error.message}`,
      );
    }
  }

  private sanitizeIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new BadRequestException('Invalid identifier');
    }
    return identifier;
  }
}
