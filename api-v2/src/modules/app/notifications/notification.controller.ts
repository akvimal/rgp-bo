import { Body, Controller, ForbiddenException, Get, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { NotificationService } from "./notification.service";
import { SaveNotificationConfigDto, TestMessageDto } from "./dto/notification-config.dto";

// Business-level setting: only the business owner. Site Admin is a platform role with no business data.
const ALLOWED_ROLES = ["Business Head"];

@ApiTags("Notifications")
@Controller("notifications")
@ApiBearerAuth()
@UseGuards(AuthGuard)
// No global ValidationPipe in this app, so scope one here for the config DTOs.
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    @InjectEntityManager() private readonly manager: EntityManager,
  ) {}

  @Get("config")
  async config(@User() user: any) {
    await this.assertAdmin(user);
    return this.service.getConfig();
  }

  @Put("config")
  async saveConfig(@Body() dto: SaveNotificationConfigDto, @User() user: any) {
    await this.assertAdmin(user);
    return this.service.saveConfig(dto, user.id);
  }

  @Post("test")
  async test(@Body() dto: TestMessageDto, @User() user: any) {
    await this.assertAdmin(user);
    return this.service.sendTest(dto.chatid);
  }

  /** Renders the digest(s) without sending - lets an admin check the numbers and layout. */
  @Get("daily/preview")
  async preview(@Query("date") date: string, @Query("storeid") storeid: string, @User() user: any) {
    await this.assertAdmin(user);
    return this.service.runDaily({ date, storeid: storeid ? +storeid : undefined, preview: true });
  }

  /** Sends now. Scopes already sent for that date are skipped unless force=true. */
  @Post("daily/send")
  async send(@Query("date") date: string, @Query("storeid") storeid: string, @Query("force") force: string, @User() user: any) {
    await this.assertAdmin(user);
    return this.service.runDaily({ date, storeid: storeid ? +storeid : undefined, force: force === "true" });
  }

  @Get("log")
  async log(@Query("limit") limit: string, @User() user: any) {
    await this.assertAdmin(user);
    return this.service.recentLog(limit ? +limit : 50);
  }

  private async assertAdmin(user: any) {
    const row = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!ALLOWED_ROLES.includes(row?.[0]?.name)) {
      throw new ForbiddenException("Not authorized to manage notifications.");
    }
  }
}
