import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class DbBackupService {

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        console.log('Backup database');
    }
}
