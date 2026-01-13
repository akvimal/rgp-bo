import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";

export enum ScorePeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum ScoreGrade {
  A_PLUS = 'A+',
  A = 'A',
  B_PLUS = 'B+',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F'
}

@Index("user_score_un", ["userid", "scoredate", "scoreperiod"], { unique: true })
@Index("user_score_pk", ["id"], { unique: true })
@Entity("user_score")
export class UserScore {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id" })
  userid: number;

  @Column("date", { name: "score_date" })
  scoredate: Date;

  @Column({
    type: "enum",
    enum: ScorePeriod,
    name: "score_period"
  })
  scoreperiod: ScorePeriod;

  @Column("numeric", { name: "attendance_score", precision: 5, scale: 2, default: 0 })
  attendancescore: number;

  @Column("numeric", { name: "punctuality_score", precision: 5, scale: 2, default: 0 })
  punctualityscore: number;

  @Column("numeric", { name: "reliability_score", precision: 5, scale: 2, default: 0 })
  reliabilityscore: number;

  @Column("numeric", { name: "total_score", precision: 5, scale: 2, default: 0 })
  totalscore: number;

  @Column({
    type: "enum",
    enum: ScoreGrade,
    nullable: true
  })
  grade: ScoreGrade | null;

  @ManyToOne(() => AppUser, (user) => user.userscores)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;
}
