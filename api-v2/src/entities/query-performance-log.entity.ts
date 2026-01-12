import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Index("query_performance_log_pk", ["id"], { unique: true })
@Entity("query_performance_log")
export class QueryPerformanceLog {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "query_name", length: 100 })
  queryname: string;

  @Column("text", { name: "query_sql", nullable: true })
  querysql: string | null;

  @Column("integer", { name: "execution_time_ms" })
  executiontimems: number;

  @Column("integer", { name: "rows_affected", nullable: true })
  rowsaffected: number | null;

  @Column("jsonb", { name: "query_params", nullable: true })
  queryparams: any;

  @Column({ name: 'timestamp', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
