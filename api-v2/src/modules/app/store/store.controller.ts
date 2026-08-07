import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { StoreService } from "./store.service";

@ApiTags("Stores")
@Controller("stores")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly service: StoreService) {}

  @Get()
  findAll() {
    return this.service.findStores();
  }

  @Get("context")
  getContext(@User() currentUser: any) {
    return this.service.getStoreContext(currentUser?.id);
  }

  @Get("businesses")
  findBusinesses() {
    return this.service.findBusinesses();
  }

  @Post()
  createOne(@Body() body: any, @User() currentUser: any) {
    return this.service.createStoreScoped(body, currentUser?.id);
  }

  @Put(":id")
  updateOne(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
    return this.service.updateStoreScoped(Number(id), body, currentUser?.id);
  }

  @Delete(":id")
  removeOne(@Param("id") id: string, @User() currentUser: any) {
    return this.service.removeStoreScoped(Number(id), currentUser?.id);
  }
}
