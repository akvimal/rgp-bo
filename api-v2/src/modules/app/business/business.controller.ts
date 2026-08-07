import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { PermissionService } from "../roles/permission.service";
import { BusinessService } from "./business.service";

@ApiTags("Businesses")
@Controller("businesses")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class BusinessController {
  constructor(private readonly service: BusinessService, private readonly permissions: PermissionService) {}

  private async assertAccess(currentUser: any) {
    await this.permissions.assertCanManageBusinesses(currentUser?.roleid);
  }

  @Get()
  async findAll(@User() currentUser: any) {
    await this.assertAccess(currentUser);
    return this.service.findAll();
  }

  @Post()
  async create(@Body() body: any, @User() currentUser: any) {
    await this.assertAccess(currentUser);
    return this.service.create(body, currentUser?.id);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
    await this.assertAccess(currentUser);
    return this.service.update(Number(id), body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @User() currentUser: any) {
    await this.assertAccess(currentUser);
    return this.service.remove(Number(id));
  }
}
