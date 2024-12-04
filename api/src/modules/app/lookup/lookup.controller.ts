import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LookupService } from "./lookup.service";

@ApiTags('Lookup')
@Controller('lookup')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class LookupController {

    constructor(private service:LookupService){}
    
    @Get('/:entity/:property/:criteria')
    async find(@Param('entity') entity: string,@Param('property') property: string,@Param('criteria') criteria: string) {
      return this.service.find(entity,property,criteria).then(result => {
        return result.map(r => r[property])
      });
    }

}