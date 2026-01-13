import { Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Payroll Migrations')
@Controller('payroll/migrations')
export class MigrationController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  @Post('check-users')
  @ApiOperation({ summary: 'Check users in database' })
  async checkUsers() {
    const users = await this.dataSource.query(`
      SELECT id, email, full_name FROM app_user ORDER BY id LIMIT 10
    `);
    return { users };
  }

  @Post('verify-permissions')
  @ApiOperation({ summary: 'Verify current payroll permissions in database' })
  async verifyPermissions() {
    const roles = await this.dataSource.query(`
      SELECT
        id,
        name,
        jsonb_pretty(
          (SELECT elem
           FROM jsonb_array_elements(permissions::jsonb) elem
           WHERE elem->>'resource' = 'payroll')
        ) as payroll_permissions
      FROM app_role
      WHERE id IN (1, 2, 3)
      ORDER BY id
    `);
    return { roles };
  }

  @Post('create-test-salaries')
  @ApiOperation({ summary: 'Create test salary structures for employees' })
  async createTestSalaries() {
    try {
      // Create salary structures for different employees with different models
      const salaries = [
        // 1. Srividhya - Associate Full-time (₹12,000 + KPI)
        {
          userId: 4,
          employmentType: 'FULLTIME',
          role: 'ASSOCIATE',
          model: 'MONTHLY_FIXED',
          ctc: 12000,
          components: {
            BASIC: 7000,
            HRA: 2500,
            CONVEYANCE: 500,
            FOOD_MEAL: 1000,
            SPECIAL: 1000
          },
          kpiEligible: true,
          maxKpi: 2000,
          kpiBands: {
            '90-100': 2000,
            '75-89': 1500,
            '60-74': 1000,
            '50-59': 500,
            'below-50': 0
          }
        },
        // 2. Lakshmanan - Senior Full-time (₹18,000 + KPI)
        {
          userId: 5,
          employmentType: 'FULLTIME',
          role: 'SENIOR',
          model: 'MONTHLY_FIXED',
          ctc: 18000,
          components: {
            BASIC: 11000,
            DA: 7000
          },
          kpiEligible: true,
          maxKpi: 1000,
          kpiBands: {
            '90-100': 1000,
            '75-89': 750,
            '60-74': 500,
            '50-59': 250,
            'below-50': 0
          }
        },
        // 3. Purushothaman - Part-time Pharmacist (₹6,000 retainer + ₹800/day)
        {
          userId: 6,
          employmentType: 'PARTTIME',
          role: 'PARTTIME_PHARMACIST',
          model: 'RETAINER_PLUS_PERDAY',
          retainer: 6000,
          includedDays: 10,
          perDayRate: 800,
          components: {
            RETAINER: 6000,
            EXTRA_DAYS_RATE: 800
          },
          kpiEligible: true,
          maxKpi: 1000,
          kpiBands: {
            '90-100': 1000,
            '75-89': 750,
            '60-74': 500,
            'below-60': 0
          }
        },
        // 4. Nirmal - Associate Full-time (₹12,000 + KPI)
        {
          userId: 7,
          employmentType: 'FULLTIME',
          role: 'ASSOCIATE',
          model: 'MONTHLY_FIXED',
          ctc: 12000,
          components: {
            BASIC: 7000,
            HRA: 2500,
            CONVEYANCE: 500,
            FOOD_MEAL: 1000,
            SPECIAL: 1000
          },
          kpiEligible: true,
          maxKpi: 2000,
          kpiBands: {
            '90-100': 2000,
            '75-89': 1500,
            '60-74': 1000,
            '50-59': 500,
            'below-50': 0
          }
        },
        // 5. Vimal Krishnan - Senior Full-time (₹18,000 + KPI)
        {
          userId: 8,
          employmentType: 'FULLTIME',
          role: 'SENIOR',
          model: 'MONTHLY_FIXED',
          ctc: 18000,
          components: {
            BASIC: 11000,
            DA: 7000
          },
          kpiEligible: true,
          maxKpi: 1000,
          kpiBands: {
            '90-100': 1000,
            '75-89': 750,
            '60-74': 500,
            '50-59': 250,
            'below-50': 0
          }
        }
      ];

      const created: Array<{ userId: number; type: string }> = [];
      for (const salary of salaries) {
        if (salary.model === 'MONTHLY_FIXED') {
          const ctc = salary.ctc || 0;
          await this.dataSource.query(`
            INSERT INTO employee_salary_structure
              (user_id, employment_type_code, role_code, payment_model,
               monthly_fixed_ctc, salary_components,
               kpi_eligible, max_kpi_incentive, kpi_payout_bands,
               pf_applicable, esi_applicable, pt_applicable, tds_applicable,
               insurance_reimbursement_eligible, annual_insurance_limit,
               effective_from, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT DO NOTHING
          `, [
            salary.userId,
            salary.employmentType,
            salary.role,
            salary.model,
            ctc,
            JSON.stringify(salary.components),
            salary.kpiEligible,
            salary.maxKpi,
            JSON.stringify(salary.kpiBands),
            true,  // PF applicable
            ctc < 21000, // ESI if < 21k
            true,  // PT applicable
            true,  // TDS applicable
            true,  // Insurance reimbursement
            1000,  // Annual limit
            '2026-01-01',
            1, 1
          ]);
          created.push({ userId: salary.userId, type: 'MONTHLY_FIXED' });
        } else if (salary.model === 'RETAINER_PLUS_PERDAY') {
          await this.dataSource.query(`
            INSERT INTO employee_salary_structure
              (user_id, employment_type_code, role_code, payment_model,
               monthly_retainer, included_days, per_day_rate,
               salary_components,
               kpi_eligible, max_kpi_incentive, kpi_payout_bands,
               pf_applicable, esi_applicable, pt_applicable, tds_applicable,
               effective_from, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT DO NOTHING
          `, [
            salary.userId,
            salary.employmentType,
            salary.role,
            salary.model,
            salary.retainer,
            salary.includedDays,
            salary.perDayRate,
            JSON.stringify(salary.components),
            salary.kpiEligible,
            salary.maxKpi,
            JSON.stringify(salary.kpiBands),
            false, // NO PF for part-time
            false, // NO ESI
            false, // NO PT
            true,  // TDS if applicable
            '2026-01-01',
            1, 1
          ]);
          created.push({ userId: salary.userId, type: 'RETAINER_PLUS_PERDAY' });
        }
      }

      // Verify created structures
      const structures = await this.dataSource.query(`
        SELECT
          ess.user_id,
          u.full_name,
          u.email,
          ess.employment_type_code,
          ess.role_code,
          ess.payment_model,
          ess.monthly_fixed_ctc,
          ess.monthly_retainer,
          ess.per_day_rate,
          ess.max_kpi_incentive
        FROM employee_salary_structure ess
        JOIN app_user u ON u.id = ess.user_id
        WHERE ess.active = true
        ORDER BY ess.user_id
      `);

      return {
        message: 'Test salary structures created successfully',
        created,
        structures
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create test salaries: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('enable-all-admin')
  @ApiOperation({ summary: 'Enable all permissions for admin - full access to everything' })
  async enableAllAdminPermissions() {
    try {
      // Give admin full access to ALL routes by adding a wildcard site permission
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(permissions::jsonb) elem
          WHERE elem->>'resource' NOT IN ('payroll', 'site')
        ) || '[
          {
            "resource": "site",
            "path": ["/secure"],
            "policies": [{"action": "read", "properties": []}]
          },
          {
            "resource": "payroll",
            "path": ["/secure/payroll"],
            "policies": [
              {"action": "read", "properties": []},
              {"action": "view", "properties": []},
              {"action": "view.list", "properties": []},
              {"action": "view.details", "properties": []},
              {"action": "view.payslip", "properties": []},
              {"action": "create", "properties": []},
              {"action": "create.run", "properties": []},
              {"action": "edit", "properties": []},
              {"action": "delete", "properties": []},
              {"action": "calculate", "properties": []},
              {"action": "approve", "properties": []},
              {"action": "reject", "properties": []},
              {"action": "request.payment", "properties": []},
              {"action": "process.payment", "properties": []},
              {"action": "salary.read", "properties": []},
              {"action": "salary.view", "properties": []},
              {"action": "salary.view.all", "properties": []},
              {"action": "salary.create", "properties": []},
              {"action": "salary.edit", "properties": []},
              {"action": "salary.delete", "properties": []},
              {"action": "salary.manage", "properties": []},
              {"action": "export", "properties": []},
              {"action": "print", "properties": []}
            ]
          }
        ]'::jsonb,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      const role = await this.dataSource.query(`
        SELECT id, name, permissions
        FROM app_role
        WHERE id = 1
      `);

      return {
        message: 'Admin now has full access to all routes',
        admin: {
          id: role[0].id,
          name: role[0].name,
          permissions: role[0].permissions
        }
      };
    } catch (error) {
      throw new HttpException(
        `Failed to enable all admin permissions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('fix-permissions')
  @ApiOperation({ summary: 'Fix payroll permissions by removing old and adding new comprehensive permissions' })
  async fixPayrollPermissions() {
    try {
      // Remove old payroll permissions and add new comprehensive ones for Admin
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(permissions::jsonb) elem
          WHERE elem->>'resource' != 'payroll'
        ) || '[{
          "resource": "payroll",
          "path": "/secure/payroll",
          "policies": [
            {"action": "read", "properties": []},
            {"action": "view", "properties": []},
            {"action": "view.list", "properties": []},
            {"action": "view.details", "properties": []},
            {"action": "view.payslip", "properties": []},
            {"action": "create", "properties": []},
            {"action": "create.run", "properties": []},
            {"action": "edit", "properties": []},
            {"action": "delete", "properties": []},
            {"action": "calculate", "properties": []},
            {"action": "approve", "properties": []},
            {"action": "reject", "properties": []},
            {"action": "request.payment", "properties": []},
            {"action": "process.payment", "properties": []},
            {"action": "salary.read", "properties": []},
            {"action": "salary.view", "properties": []},
            {"action": "salary.view.all", "properties": []},
            {"action": "salary.create", "properties": []},
            {"action": "salary.edit", "properties": []},
            {"action": "salary.delete", "properties": []},
            {"action": "salary.manage", "properties": []},
            {"action": "export", "properties": []},
            {"action": "print", "properties": []}
          ]
        }]'::jsonb,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      // Store Head
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(permissions::jsonb) elem
          WHERE elem->>'resource' != 'payroll'
        ) || '[{
          "resource": "payroll",
          "path": "/secure/payroll",
          "policies": [
            {"action": "read", "properties": []},
            {"action": "view", "properties": []},
            {"action": "view.list", "properties": []},
            {"action": "view.details", "properties": []},
            {"action": "view.payslip", "properties": []},
            {"action": "create", "properties": []},
            {"action": "create.run", "properties": []},
            {"action": "edit", "properties": []},
            {"action": "calculate", "properties": []},
            {"action": "approve", "properties": []},
            {"action": "reject", "properties": []},
            {"action": "salary.read", "properties": []},
            {"action": "salary.view", "properties": []},
            {"action": "salary.view.all", "properties": []},
            {"action": "salary.create", "properties": []},
            {"action": "salary.edit", "properties": []},
            {"action": "salary.manage", "properties": []},
            {"action": "export", "properties": []},
            {"action": "print", "properties": []}
          ]
        }]'::jsonb,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 3
      `);

      // Sales Staff
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(permissions::jsonb) elem
          WHERE elem->>'resource' != 'payroll'
        ) || '[{
          "resource": "payroll",
          "path": "/secure/payroll",
          "policies": [
            {"action": "read", "properties": []},
            {"action": "view", "properties": []},
            {"action": "view.payslip", "properties": []},
            {"action": "payslip.view.own", "properties": []},
            {"action": "print", "properties": []}
          ]
        }]'::jsonb,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 2
      `);

      // Verify the updates
      const roles = await this.dataSource.query(`
        SELECT id, name, permissions
        FROM app_role
        WHERE id IN (1, 2, 3)
        ORDER BY id
      `);

      return {
        message: 'Payroll permissions fixed successfully',
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          payrollPermissions: r.permissions.find((p: any) => p.resource === 'payroll')
        }))
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fix permissions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('update-permissions')
  @ApiOperation({ summary: 'Update role permissions to include payroll access' })
  async updatePayrollPermissions() {
    try {
      // Update Admin role (id: 1) - Full Payroll access with all permissions
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = jsonb_set(
            permissions::jsonb,
            '{11}',
            '{"resource":"payroll","path":["/secure/payroll","/secure/payroll/create","/secure/payroll/salary-structures"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.list","properties":[]},{"action":"view.details","properties":[]},{"action":"view.payslip","properties":[]},{"action":"create","properties":[]},{"action":"create.run","properties":[]},{"action":"edit","properties":[]},{"action":"delete","properties":[]},{"action":"calculate","properties":[]},{"action":"approve","properties":[]},{"action":"reject","properties":[]},{"action":"request.payment","properties":[]},{"action":"process.payment","properties":[]},{"action":"salary.read","properties":[]},{"action":"salary.view","properties":[]},{"action":"salary.view.all","properties":[]},{"action":"salary.create","properties":[]},{"action":"salary.edit","properties":[]},{"action":"salary.delete","properties":[]},{"action":"salary.manage","properties":[]},{"action":"export","properties":[]},{"action":"print","properties":[]}]}'::jsonb
        )::json,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      // Update Store Head role (id: 3) - Full Payroll access (except payment processing)
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = jsonb_set(
            permissions::jsonb,
            '{12}',
            '{"resource":"payroll","path":["/secure/payroll","/secure/payroll/create","/secure/payroll/salary-structures"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.list","properties":[]},{"action":"view.details","properties":[]},{"action":"view.payslip","properties":[]},{"action":"create","properties":[]},{"action":"create.run","properties":[]},{"action":"edit","properties":[]},{"action":"calculate","properties":[]},{"action":"approve","properties":[]},{"action":"reject","properties":[]},{"action":"salary.read","properties":[]},{"action":"salary.view","properties":[]},{"action":"salary.view.all","properties":[]},{"action":"salary.create","properties":[]},{"action":"salary.edit","properties":[]},{"action":"salary.manage","properties":[]},{"action":"export","properties":[]},{"action":"print","properties":[]}]}'::jsonb
        )::json,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 3
      `);

      // Update Sales Staff role (id: 2) - View-only access (own payslips only)
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = jsonb_set(
            permissions::jsonb,
            '{6}',
            '{"resource":"payroll","path":["/secure/payroll"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.payslip","properties":[]},{"action":"payslip.view.own","properties":[]},{"action":"print","properties":[]}]}'::jsonb
        )::json,
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 2
      `);

      // Verify the updates
      const roles = await this.dataSource.query(`
        SELECT id, name, permissions
        FROM app_role
        WHERE id IN (1, 2, 3)
        ORDER BY id
      `);

      return {
        message: 'Payroll permissions updated successfully',
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          payrollPermissions: r.permissions.find((p: any) => p.resource === 'payroll')
        }))
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update permissions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('run')
  @ApiOperation({ summary: 'Run payroll database migrations (DEV ONLY)' })
  async runMigrations() {
    try {
      const migrations = [
        '006_employment_type_role_masters.sql',
        '007_salary_component_master.sql',
        '008_flexible_salary_structure.sql',
        '009_payroll_tables.sql',
        '010_kpi_enhancements.sql',
      ];

      const results: Array<{ migration: string; status: string; error?: string }> = [];

      for (const migration of migrations) {
        try {
          const filePath = path.join(__dirname, '../../../../../sql/migrations', migration);
          const sql = fs.readFileSync(filePath, 'utf8');

          await this.dataSource.query(sql);
          results.push({ migration, status: 'success' });
        } catch (error) {
          results.push({
            migration,
            status: 'failed',
            error: error.message,
          });
        }
      }

      // Check created tables
      const tables = await this.dataSource.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE '%payroll%'
          OR table_name LIKE '%kpi%'
          OR table_name LIKE '%salary%'
          OR table_name LIKE '%employment%')
        ORDER BY table_name
      `);

      // Check data (only if tables exist)
      let dataCounts = null;
      try {
        const counts = await this.dataSource.query(`
          SELECT
            (SELECT COUNT(*) FROM employment_type_master) as employment_types,
            (SELECT COUNT(*) FROM role_master) as roles,
            (SELECT COUNT(*) FROM salary_component_master) as salary_components,
            (SELECT COUNT(*) FROM kpi_category_master) as kpi_categories
        `);
        dataCounts = counts[0];
      } catch (error) {
        // Tables don't exist yet
      }

      return {
        message: 'Migrations completed',
        results,
        tables: tables.map((t) => t.table_name),
        dataCounts,
      };
    } catch (error) {
      throw new HttpException(
        `Migration failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('fix-all-path-formats')
  @ApiOperation({ summary: 'Convert all string paths to arrays for frontend compatibility' })
  async fixAllPathFormats() {
    try {
      // Update admin role - convert all string paths to arrays
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(elem->'path') = 'string'
              THEN jsonb_set(elem, '{path}', jsonb_build_array(elem->>'path'))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(permissions::jsonb) elem
        ),
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      const role = await this.dataSource.query(`
        SELECT id, name, permissions
        FROM app_role
        WHERE id = 1
      `);

      return {
        message: 'All paths converted to arrays successfully',
        admin: {
          id: role[0].id,
          name: role[0].name,
          permissions: role[0].permissions
        }
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fix path formats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('fix-permission-paths')
  @ApiOperation({ summary: 'Fix permission paths to match actual Angular routes' })
  async fixPermissionPaths() {
    try {
      // Update admin role - fix paths to match Angular routes
      await this.dataSource.query(`
        UPDATE app_role
        SET permissions = (
          SELECT jsonb_agg(
            CASE
              -- Fix /secure/roles to /secure/settings/roles
              WHEN elem->>'resource' = 'roles'
              THEN jsonb_set(elem, '{path}', '["/secure/settings/roles"]'::jsonb)
              -- Fix /secure/users to /secure/settings/users
              WHEN elem->>'resource' = 'users'
              THEN jsonb_set(elem, '{path}', '["/secure/settings/users"]'::jsonb)
              ELSE elem
            END
          )
          FROM jsonb_array_elements(permissions::jsonb) elem
        ),
        updated_on = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      const role = await this.dataSource.query(`
        SELECT id, name, permissions
        FROM app_role
        WHERE id = 1
      `);

      return {
        message: 'Permission paths fixed to match Angular routes',
        admin: {
          id: role[0].id,
          name: role[0].name,
          permissions: role[0].permissions
        }
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fix permission paths: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
