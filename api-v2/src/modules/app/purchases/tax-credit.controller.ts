import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { TaxCreditService } from "./tax-credit.service";
import { CreateTaxCreditDto, UpdateTaxCreditDto, ReportMismatchDto } from "./dto/create-tax-credit.dto";
import { TaxFilingStatus } from "./enums";

@ApiTags('Tax Credit')
@Controller('purchases/tax-credits')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class TaxCreditController {

    constructor(private taxCreditService: TaxCreditService) { }

    @Post()
    @ApiOperation({ summary: 'Create tax credit record for invoice' })
    @ApiResponse({ status: 201, description: 'Tax credit created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid data or tax credit already exists' })
    async create(@Body() dto: CreateTaxCreditDto, @User() currentUser: any) {
        return this.taxCreditService.create(dto, currentUser.id);
    }

    @Put('/:id/filing-status')
    @ApiOperation({ summary: 'Update tax filing status' })
    @ApiResponse({ status: 200, description: 'Filing status updated successfully' })
    @ApiResponse({ status: 400, description: 'Tax credit not found' })
    async updateFilingStatus(
        @Param('id') id: string,
        @Body() dto: UpdateTaxCreditDto,
        @User() currentUser: any
    ) {
        await this.taxCreditService.updateFilingStatus(parseInt(id), dto, currentUser.id);
        return { message: 'Filing status updated successfully' };
    }

    @Put('/:id/mismatch')
    @ApiOperation({ summary: 'Report tax mismatch' })
    @ApiResponse({ status: 200, description: 'Mismatch reported successfully' })
    @ApiResponse({ status: 400, description: 'Tax credit not found' })
    async reportMismatch(
        @Param('id') id: string,
        @Body() dto: ReportMismatchDto,
        @User() currentUser: any
    ) {
        await this.taxCreditService.reportMismatch(parseInt(id), dto, currentUser.id);
        return { message: 'Mismatch reported successfully' };
    }

    @Get('/invoice/:invoiceId')
    @ApiOperation({ summary: 'Get tax credit by invoice ID' })
    @ApiResponse({ status: 200, description: 'Returns tax credit record' })
    async findByInvoice(@Param('invoiceId') invoiceId: string) {
        return this.taxCreditService.findByInvoice(parseInt(invoiceId));
    }

    @Get('/filing-month/:month')
    @ApiOperation({ summary: 'Get tax credits by filing month (YYYY-MM-01)' })
    @ApiResponse({ status: 200, description: 'Returns list of tax credits for the month' })
    async findByFilingMonth(@Param('month') month: string) {
        return this.taxCreditService.findByFilingMonth(month);
    }

    @Get('/status/:status')
    @ApiOperation({ summary: 'Get tax credits by filing status' })
    @ApiResponse({ status: 200, description: 'Returns list of tax credits with the specified status' })
    async findByStatus(@Param('status') status: TaxFilingStatus) {
        return this.taxCreditService.findByStatus(status);
    }

    @Get('/mismatches')
    @ApiOperation({ summary: 'Get all unresolved tax mismatches' })
    @ApiResponse({ status: 200, description: 'Returns list of tax credits with unresolved mismatches' })
    async findWithMismatches() {
        return this.taxCreditService.findWithMismatches();
    }

    @Get('/reconciliation-summary/:month')
    @ApiOperation({ summary: 'Get tax reconciliation summary for filing month' })
    @ApiResponse({ status: 200, description: 'Returns comprehensive summary of tax reconciliation' })
    async getReconciliationSummary(@Param('month') month: string) {
        return this.taxCreditService.getReconciliationSummary(month);
    }

    @Delete('/:id')
    @ApiOperation({ summary: 'Delete tax credit record' })
    @ApiResponse({ status: 200, description: 'Tax credit deleted successfully' })
    async delete(@Param('id') id: string) {
        await this.taxCreditService.delete(parseInt(id));
        return { message: 'Tax credit deleted successfully' };
    }
}
