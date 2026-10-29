import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, ForbiddenException, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { GstRegistrationService } from './gst-registration.service';

/** Whether the business is on GST and from when. For the people who run the business. */
@ApiTags('GST registration')
@Controller('gst/registration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GstRegistrationController {
  constructor(private readonly registration: GstRegistrationService, private readonly permissions: PermissionService) {}

  private async assertAllowed(user: any) {
    if (!(await this.permissions.canUseGstFiling(user.roleid))) throw new ForbiddenException('GST is for the Business Head.');
  }

  @Get() async get(@User() u: any) { await this.assertAllowed(u); return this.registration.get(u); }
  @Put() async save(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.registration.save(u, b); }
}
