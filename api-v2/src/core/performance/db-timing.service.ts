import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestTimingContext } from './request-timing.context';

type PatchableDataSource = DataSource & {
  __requestTimingPatched?: boolean;
};

type PatchableQueryRunner = ReturnType<DataSource['createQueryRunner']> & {
  __requestTimingPatched?: boolean;
};

@Injectable()
export class DbTimingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbTimingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly timingContext: RequestTimingContext,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.timingContext.isEnabled()) {
      return;
    }

    const dataSource = this.dataSource as PatchableDataSource;
    if (dataSource.__requestTimingPatched) {
      return;
    }

    const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);
    dataSource.createQueryRunner = (...args) => {
      const queryRunner = createQueryRunner(...args) as PatchableQueryRunner;
      return this.patchQueryRunner(queryRunner);
    };
    dataSource.__requestTimingPatched = true;

    this.logger.log('Database query timing enabled');
  }

  private patchQueryRunner(queryRunner: PatchableQueryRunner): PatchableQueryRunner {
    if (queryRunner.__requestTimingPatched) {
      return queryRunner;
    }

    const query = queryRunner.query.bind(queryRunner);
    queryRunner.query = async (...args: Parameters<typeof query>) => {
      const startedAtNs = process.hrtime.bigint();

      try {
        return await query(...args);
      } finally {
        const durationMs =
          Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
        this.timingContext.recordDbQuery(durationMs, String(args[0] ?? ''));
      }
    };
    queryRunner.__requestTimingPatched = true;

    return queryRunner;
  }
}
