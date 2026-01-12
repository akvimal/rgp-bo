import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from '../../../entities/shift.entity';
import { UserShift } from '../../../entities/user-shift.entity';
import { CreateShiftDto } from '../dto/shift/create-shift.dto';
import { UpdateShiftDto } from '../dto/shift/update-shift.dto';
import { AssignUserShiftDto } from '../dto/shift/assign-user-shift.dto';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PerformanceMonitoringService } from '../../../core/monitoring/performance-monitoring.service';

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @InjectRepository(UserShift)
    private userShiftRepo: Repository<UserShift>,
    private cacheService: RedisCacheService,
    private perfMonitor: PerformanceMonitoringService,
  ) {}

  async create(createShiftDto: CreateShiftDto, userId: number): Promise<Shift> {
    const startTime = Date.now();

    try {
      // Check for duplicate
      const existing = await this.shiftRepo.findOne({
        where: {
          name: createShiftDto.name,
          storeid: createShiftDto.storeid,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Shift with name '${createShiftDto.name}' already exists for this store`,
        );
      }

      const shift = this.shiftRepo.create({
        ...createShiftDto,
        createdby: userId,
        updatedby: userId,
      });

      const saved = await this.shiftRepo.save(shift);

      // Invalidate store shifts cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.STORE_SHIFTS(createShiftDto.storeid),
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId,
        action: 'CREATE_SHIFT',
        resourceType: 'shift',
        resourceId: saved.id,
        newValues: saved,
      });

      return saved;
    } catch (error) {
      throw error;
    } finally {
      try {
        await this.perfMonitor.logQueryPerformance(
          'shift.create',
          Date.now() - startTime,
        );
      } catch (perfError) {
        console.error('Performance logging failed:', perfError.message);
      }
    }
  }

  async findAll(storeId?: number): Promise<Shift[]> {
    const cacheKey = storeId
      ? this.cacheService.CACHE_KEYS.STORE_SHIFTS(storeId)
      : 'hr:shift:all';

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const query = this.shiftRepo
          .createQueryBuilder('shift')
          .where('shift.active = :active', { active: true })
          .andWhere('shift.archive = :archive', { archive: false });

        if (storeId) {
          query.andWhere('shift.storeid = :storeId', { storeId });
        }

        return query.orderBy('shift.name', 'ASC').getMany();
      },
      this.cacheService.TTL.MEDIUM,
    );
  }

  async findOne(id: number): Promise<Shift> {
    const cacheKey = this.cacheService.CACHE_KEYS.SHIFT_BY_ID(id);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const shift = await this.shiftRepo.findOne({
          where: { id },
        });

        if (!shift) {
          throw new NotFoundException(`Shift with ID ${id} not found`);
        }

        return shift;
      },
      this.cacheService.TTL.MEDIUM,
    );
  }

  async update(
    id: number,
    updateShiftDto: UpdateShiftDto,
    userId: number,
  ): Promise<Shift> {
    const startTime = Date.now();

    try {
      const shift = await this.findOne(id);

      Object.assign(shift, updateShiftDto, { updatedby: userId });

      const saved = await this.shiftRepo.save(shift);

      // Invalidate caches
      await this.cacheService.del(this.cacheService.CACHE_KEYS.SHIFT_BY_ID(id));
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.STORE_SHIFTS(shift.storeid),
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId,
        action: 'UPDATE_SHIFT',
        resourceType: 'shift',
        resourceId: id,
        oldValues: shift,
        newValues: saved,
      });

      return saved;
    } catch (error) {
      throw error;
    } finally {
      try {
        await this.perfMonitor.logQueryPerformance(
          'shift.update',
          Date.now() - startTime,
        );
      } catch (perfError) {
        console.error('Performance logging failed:', perfError.message);
      }
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    const shift = await this.findOne(id);

    // Soft delete
    shift.isArchived = true;
    shift.isActive = false;
    shift.updatedby = userId;

    await this.shiftRepo.save(shift);

    // Invalidate caches
    await this.cacheService.del(this.cacheService.CACHE_KEYS.SHIFT_BY_ID(id));
    await this.cacheService.del(
      this.cacheService.CACHE_KEYS.STORE_SHIFTS(shift.storeid),
    );

    // Log audit
    await this.perfMonitor.logAudit({
      userId,
      action: 'DELETE_SHIFT',
      resourceType: 'shift',
      resourceId: id,
    });
  }

  async assignUserToShift(
    assignDto: AssignUserShiftDto,
    createdBy: number,
  ): Promise<UserShift> {
    const startTime = Date.now();

    try {
      // Verify shift exists
      await this.findOne(assignDto.shiftid);

      // Check for overlapping assignments using standard date comparison
      const toDate = assignDto.effectiveto || '2099-12-31';
      const overlap = await this.userShiftRepo
        .createQueryBuilder('us')
        .where('us.userid = :userid', { userid: assignDto.userid })
        .andWhere('us.active = :active', { active: true })
        .andWhere(
          `(us.effectivefrom <= :to AND COALESCE(us.effectiveto, '2099-12-31') >= :from)`,
          {
            from: assignDto.effectivefrom,
            to: toDate,
          },
        )
        .getOne();

      if (overlap) {
        throw new ConflictException(
          'User already has an overlapping shift assignment',
        );
      }

      const userShift = this.userShiftRepo.create({
        ...assignDto,
        createdby: createdBy,
        updatedby: createdBy,
      });

      const saved = await this.userShiftRepo.save(userShift);

      // Invalidate user's current shift cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.USER_CURRENT_SHIFT(assignDto.userid),
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId: createdBy,
        action: 'ASSIGN_USER_SHIFT',
        resourceType: 'user_shift',
        resourceId: saved.id,
        newValues: saved,
      });

      return saved;
    } catch (error) {
      throw error;
    } finally {
      try {
        await this.perfMonitor.logQueryPerformance(
          'shift.assignUser',
          Date.now() - startTime,
        );
      } catch (perfError) {
        // Ignore performance logging errors
        console.error('Performance logging failed:', perfError.message);
      }
    }
  }

  async getUserCurrentShift(userId: number): Promise<UserShift | null> {
    const cacheKey = this.cacheService.CACHE_KEYS.USER_CURRENT_SHIFT(userId);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const today = new Date();
        const dayOfWeek = today.getDay();

        return this.userShiftRepo
          .createQueryBuilder('us')
          .leftJoinAndSelect('us.shift', 'shift')
          .where('us.userid = :userId', { userId })
          .andWhere('us.active = :active', { active: true })
          .andWhere('us.effectivefrom <= :today', { today })
          .andWhere(
            '(us.effectiveto IS NULL OR us.effectiveto >= :today)',
            { today },
          )
          .andWhere('us.daysofweek @> :dayArray::jsonb', { dayArray: `[${dayOfWeek}]` })
          .getOne();
      },
      this.cacheService.TTL.SHORT, // 5 minutes
    );
  }

  async getAllAssignments(): Promise<UserShift[]> {
    return this.userShiftRepo
      .createQueryBuilder('us')
      .leftJoinAndSelect('us.shift', 'shift')
      .leftJoinAndSelect('us.user', 'user')
      .where('us.active = :active', { active: true })
      .andWhere('us.archive = :archive', { archive: false })
      .orderBy('shift.name', 'ASC')
      .addOrderBy('user.full_name', 'ASC')
      .getMany();
  }
}
