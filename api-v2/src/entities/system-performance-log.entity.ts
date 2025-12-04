import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Index("system_performance_log_pk", ["id"], { unique: true })
@Entity("system_performance_log")
export class SystemPerformanceLog {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "metric_name", length: 100 })
  metricname: string;

  @Column("numeric", { name: "metric_value", precision: 10, scale: 2 })
  metricvalue: number;

  @Column("character varying", { name: "endpoint", nullable: true, length: 200 })
  endpoint: string | null;

  @Column("jsonb", { name: "additional_data", nullable: true })
  additionaldata: any;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedat: Date;
}
