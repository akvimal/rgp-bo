import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { SettingsService } from "./settings.service";
import { CreateSettingDto } from "./dto/create-setting.dto";
import { UpdateSettingDto } from "./dto/update-setting.dto";

@ApiTags('Settings')
@Controller('settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SettingsController {
    constructor(private readonly service: SettingsService) {}

    @Post()
    create(@Body() dto: CreateSettingDto, @User() currentUser: any) {
        return this.service.create(dto, currentUser.id);
    }

    @Get()
    findAll(@Query() query: any) {
        return this.service.findAll(query);
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.service.findById(+id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateSettingDto, @User() currentUser: any) {
        return this.service.update(+id, dto, currentUser.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
        return this.service.remove(+id, currentUser.id);
    }
}
