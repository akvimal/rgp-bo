import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaveRequest, LeaveRequestStatus } from '../../../entities/leave-request.entity';
import { LeaveBalance } from '../../../entities/leave-balance.entity';
import { LeaveType } from '../../../entities/leave-type.entity';
import { CreateLeaveRequestDto } from '../dto/leave/create-leave-request.dto';
import { ApproveLeaveDto } from '../dto/leave/approve-leave.dto';
import { LeaveBalanceQueryDto } from '../dto/leave/leave-balance-query.dto';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PerformanceMonitoringService } from '../../../core/monitoring/performance-monitoring.service';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
    private dataSource: DataSource,
    private cacheService: RedisCacheService,
    private perfMonitor: PerformanceMonitoringService,
  ) {}

  /**
   * Get all leave types
   */
  async getLeaveTypes(): Promise<LeaveType[]> {
    const cacheKey = this.cacheService.CACHE_KEYS.LEAVE_TYPES();

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.leaveTypeRepo.find({
          where: { active: true },
          order: { name: 'ASC' },
        });
      },
      this.cacheService.TTL.VERY_LONG, // Rarely changes
    );
  }

  /**
   * Create leave request
   */
  async createRequest(
    userId: number,
    createDto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const startTime = Date.now();

    try {
      // Verify leave type exists
      const leaveType = await this.leaveTypeRepo.findOne({
        where: { id: createDto.leavetypeid, active: true },
      });

      if (!leaveType) {
        throw new NotFoundException('Leave type not found');
      }

      // Check dates are valid
      if (new Date(createDto.enddate) < new Date(createDto.startdate)) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check if document is required
      if (leaveType.requiresdocument && !createDto.documenturl) {
        throw new BadRequestException(
          `Document is required for ${leaveType.name}`,
        );
      }

      // Check leave balance
      const year = new Date(createDto.startdate).getFullYear();
      const balance = await this.getOrCreateBalance(
        userId,
        createDto.leavetypeid,
        year,
      );

      if (balance.balance < createDto.totaldays) {
        throw new BadRequestException(
          `Insufficient leave balance. Available: ${balance.balance} days`,
        );
      }

      // Check for overlapping leave requests
      const overlap = await this.leaveRequestRepo
        .createQueryBuilder('lr')
        .where('lr.userid = :userId', { userId })
        .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED })
        .andWhere(
          `daterange(lr.startdate, lr.enddate, '[]') && daterange(:start, :end, '[]')`,
          {
            start: createDto.startdate,
            end: createDto.enddate,
          },
        )
        .getOne();

      if (overlap) {
        throw new ConflictException(
          'You already have approved leave during this period',
        );
      }

      const leaveRequest = this.leaveRequestRepo.create({
        userid: userId,
        ...createDto,
        status: LeaveRequestStatus.PENDING,
        createdby: userId,
        updatedby: userId,
      });

      const saved = await this.leaveRequestRepo.save(leaveRequest);

      // Invalidate cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.PENDING_LEAVES(userId),
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId,
        action: 'CREATE_LEAVE_REQUEST',
        resourceType: 'leave_request',
        resourceId: saved.id,
        newValues: saved,
      });

      return saved;
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'leave.createRequest',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Approve or reject leave request
   */
  async approveLeave(
    requestId: number,
    approveDto: ApproveLeaveDto,
    approverId: number,
  ): Promise<LeaveRequest> {
    const startTime = Date.now();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaveRequest = await queryRunner.manager.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaveRequest) {
        throw new NotFoundException(`Leave request ${requestId} not found`);
      }

      if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException(
          'Leave request has already been processed',
        );
      }

      const oldStatus = leaveRequest.status;

      leaveRequest.status = approveDto.status;
      leaveRequest.approvedby = approverId;
      leaveRequest.approvedon = new Date();
      leaveRequest.approvalcomments = approveDto.approvalcomments || null;
      leaveRequest.updatedby = approverId;

      await queryRunner.manager.save(LeaveRequest, leaveRequest);

      // Note: Leave balance is updated automatically by database trigger
      // on approval (update_leave_balance_on_approval)

      await queryRunner.commitTransaction();

      // Invalidate caches
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.PENDING_LEAVES(leaveRequest.userid),
      );
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.LEAVE_BALANCE(
          leaveRequest.userid,
          new Date(leaveRequest.startdate).getFullYear(),
        ),
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId: approverId,
        action: 'APPROVE_LEAVE',
        resourceType: 'leave_request',
        resourceId: requestId,
        oldValues: { status: oldStatus },
        newValues: { status: approveDto.status },
      });

      return leaveRequest;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      await this.perfMonitor.logQueryPerformance(
        'leave.approve',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Get pending leave requests for approval
   */
  async getPendingRequests(): Promise<LeaveRequest[]> {
    return this.leaveRequestRepo.find({
      where: { status: LeaveRequestStatus.PENDING },
      relations: ['user', 'leavetype'],
      order: { appliedon: 'ASC' },
    });
  }

  /**
   * Get user's leave requests
   */
  async getUserRequests(userId: number, status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
    const query = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leavetype', 'lt')
      .leftJoinAndSelect('lr.approver', 'approver')
      .where('lr.userid = :userId', { userId });

    if (status) {
      query.andWhere('lr.status = :status', { status });
    }

    return query.orderBy('lr.appliedon', 'DESC').getMany();
  }

  /**
   * Get user leave balance
   */
  async getUserBalance(
    userId: number,
    queryDto: LeaveBalanceQueryDto,
  ): Promise<LeaveBalance[]> {
    const year = queryDto.year || new Date().getFullYear();
    const cacheKey = this.cacheService.CACHE_KEYS.LEAVE_BALANCE(userId, year);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const query = this.leaveBalanceRepo
          .createQueryBuilder('lb')
          .leftJoinAndSelect('lb.leavetype', 'lt')
          .where('lb.userid = :userId', { userId })
          .andWhere('lb.year = :year', { year });

        if (queryDto.leavetypeid) {
          query.andWhere('lb.leavetypeid = :leavetypeid', {
            leavetypeid: queryDto.leavetypeid,
          });
        }

        return query.orderBy('lt.name', 'ASC').getMany();
      },
      this.cacheService.TTL.SHORT,
    );
  }

  /**
   * Get or create leave balance for user
   */
  private async getOrCreateBalance(
    userId: number,
    leaveTypeId: number,
    year: number,
  ): Promise<LeaveBalance> {
    let balance = await this.leaveBalanceRepo.findOne({
      where: {
        userid: userId,
        leavetypeid: leaveTypeId,
        year: year,
      },
    });

    if (!balance) {
      const leaveType = await this.leaveTypeRepo.findOne({
        where: { id: leaveTypeId },
      });

      balance = this.leaveBalanceRepo.create({
        userid: userId,
        leavetypeid: leaveTypeId,
        year: year,
        openingbalance: leaveType?.maxdaysperyear || 0,
        earned: leaveType?.maxdaysperyear || 0,
        used: 0,
        balance: leaveType?.maxdaysperyear || 0,
      });

      balance = await this.leaveBalanceRepo.save(balance);
    }

    return balance;
  }

  /**
   * Initialize leave balances for new year
   */
  async initializeYearlyBalances(userId: number, year: number): Promise<LeaveBalance[]> {
    const leaveTypes = await this.getLeaveTypes();
    const balances: LeaveBalance[] = [];

    for (const leaveType of leaveTypes) {
      const balance = await this.getOrCreateBalance(userId, leaveType.id, year);
      balances.push(balance);
    }

    return balances;
  }
}
