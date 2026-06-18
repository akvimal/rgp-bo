import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class DbBackupService {

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        if (process.env.DB_BACKUP_CRON_ENABLED !== 'true') {
            return;
        }

        console.log('Backup database');
    }
}
