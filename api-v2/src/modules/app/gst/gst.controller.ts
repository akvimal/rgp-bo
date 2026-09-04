import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { PermissionService } from "../roles/permission.service";
import { GstService } from "./gst.service";

@ApiTags("GST Reconciliation")
@Controller("gst")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GstController {

    constructor(private readonly service: GstService, private readonly permissions: PermissionService) {}

    @Get("periods")
    async listPeriods(@Query("businessid") businessid: string, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "read");
        return this.service.listPeriods(businessid);
    }

    @Get("summary")
    async summary(@Query("businessid") businessid: string, @Query("period") period: string, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "read");
        return this.service.summary(businessid, period);
    }

    @Get("worklist")
    async worklist(
        @Query("businessid") businessid: string,
        @Query("period") period: string,
        @Query("status") status: string,
        @User() currentUser: any,
    ) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "read");
        return this.service.worklist(businessid, period, status);
    }

    @Post("import")
    async import(@Body() dto: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "import");
        return this.service.importReturn(dto, currentUser.id);
    }

    @Post("match")
    async match(@Body() dto: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.runMatch(dto, currentUser.id);
    }

    @Post("reconciliation/:id/accept")
    async accept(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.accept(+id, currentUser.id, body?.note);
    }

    @Post("reconciliation/:id/dispute")
    async dispute(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.dispute(+id, currentUser.id, body?.note);
    }

    @Post("reconciliation/:id/exclude")
    async exclude(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.exclude(+id, currentUser.id, body?.note);
    }

    @Post("reconciliation/:id/carry-forward")
    async carryForward(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.carryForward(+id, currentUser.id, body?.note);
    }

    @Post("reconciliation/:id/create-invoice")
    async createInvoice(@Param("id") id: string, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "reconcile");
        return this.service.createInvoiceFromPortalRow(+id, currentUser.id);
    }

    @Post("periods/:period/lock")
    async lock(@Param("period") period: string, @Body() body: any, @User() currentUser: any) {
        await this.permissions.assertCanUseGst(currentUser.roleid, "lock");
        return this.service.lockPeriod(body?.businessid, period, currentUser.id);
    }
}
