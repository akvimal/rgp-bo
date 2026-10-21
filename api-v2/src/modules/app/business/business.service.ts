import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Business } from "src/entities/business.entity";
import { AuditService } from "src/core/audit/audit.service";

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
  ) {}

  /** The business the signed-in Business Head belongs to. Nobody else reaches this, and nobody reaches another business. */
  private async ownBusiness(user: any): Promise<Business> {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (role?.name !== "Business Head") throw new ForbiddenException("Only the Business Head can manage the business details.");
    const [u] = await this.manager.query(`select business_id from app_user where id = $1`, [user?.id || 0]);
    const b = u?.business_id ? await this.businessRepository.findOne({ where: { id: u.business_id } }) : null;
    if (!b) throw new NotFoundException("Your user is not linked to a business.");
    return b;
  }

  async mine(user: any) {
    return this.ownBusiness(user);
  }

  /**
   * The Business Head edits their own business's details. The GSTIN is checked (format, state, checksum) and the state
   * code follows from it; a business cannot be created, renamed to a clash, disabled or removed from here.
   */
  async updateMine(user: any, body: any) {
    const cur = await this.ownBusiness(user);
    const clean = (v: any, max: number, label: string) => {
      const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
      if (t.length > max) throw new BadRequestException(`${label} can be at most ${max} characters.`);
      return t || null;
    };
    const fields: any = {};
    if (body.name !== undefined) {
      const n = clean(body.name, 40, "The name");
      if (!n || n.length < 2) throw new BadRequestException("The business name is required.");
      fields.name = n;
    }
    if (body.legalname !== undefined) fields.legalname = clean(body.legalname, 120, "The legal name");
    if (body.address !== undefined) fields.address = clean(body.address, 200, "The address");
    if (body.pincode !== undefined) {
      const p = clean(body.pincode, 10, "The pincode");
      if (p && !/^[0-9]{6}$/.test(p)) throw new BadRequestException("The pincode must be 6 digits.");
      fields.pincode = p;
    }
    if (body.gstin !== undefined) {
      const g = ((body.gstin || "") as string).trim().toUpperCase();
      if (g) {
        const [ok] = await this.manager.query(`select public.is_valid_gstin($1) as ok`, [g]);
        if (!ok?.ok) throw new BadRequestException("That is not a valid GSTIN. Check the 15 characters, the state code and the check digit.");
        fields.gstin = g;
        fields.statecode = g.substring(0, 2);
      } else {
        fields.gstin = null;
      }
    }
    if (body.statecode !== undefined && !fields.statecode) {
      const s = clean(body.statecode, 2, "The state code");
      if (s && !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(s)) throw new BadRequestException("The state code must be a two-digit GST state code (01-38).");
      fields.statecode = s;
    }
    if (!Object.keys(fields).length) return cur;
    try {
      await this.businessRepository.update(cur.id, fields);
    } catch (e: any) {
      if (String(e?.code) === "23505") throw new ConflictException("Another business already has that name.");
      throw e;
    }
    const after = await this.businessRepository.findOne({ where: { id: cur.id } });
    const diff: any = {};
    for (const k of Object.keys(fields)) if ((cur as any)[k] !== (after as any)[k]) diff[k] = { from: (cur as any)[k] ?? null, to: (after as any)[k] ?? null };
    if (Object.keys(diff).length) {
      await this.audit.record({ userId: user.id, action: "business.details_updated", entityType: "businesses", entityId: cur.id, summary: `business details changed: ${Object.keys(diff).join(", ")}`, details: diff });
    }
    return after;
  }

  findAll() {
    return this.businessRepository.createQueryBuilder("business")
      .where("business.active = true")
      .andWhere("business.archive = false")
      .orderBy("business.name", "ASC")
      .getMany();
  }

  async create(body: any, userid: any) {
    const payload = {
      name: body.name,
      isActive: body.isActive !== false,
      isArchived: false,
      ...this.gstFields(body),
    };
    return this.businessRepository.save(payload);
  }

  async update(id: number, body: any) {
    const current = await this.businessRepository.findOne({ where: { id } });
    if (!current) {
      throw new Error("Business not found");
    }
    await this.businessRepository.update(id, {
      name: body.name,
      isActive: body.isActive === undefined ? current.isActive : !!body.isActive,
      isArchived: body.isArchived === undefined ? current.isArchived : !!body.isArchived,
      ...this.gstFields(body),
    });
    return this.businessRepository.findOne({ where: { id } });
  }

  /** GST registration fields (WS-4): only touched when the caller actually sends them, so a plain name/status edit is a no-op here. */
  private gstFields(body: any) {
    const fields: any = {};
    if (body.gstin !== undefined) fields.gstin = body.gstin || null;
    if (body.legalname !== undefined) fields.legalname = body.legalname || null;
    if (body.statecode !== undefined) fields.statecode = body.statecode || null;
    if (body.address !== undefined) fields.address = body.address || null;
    if (body.pincode !== undefined) fields.pincode = body.pincode || null;
    return fields;
  }

  async remove(id: number) {
    await this.businessRepository.update(id, {
      isActive: false,
      isArchived: true,
    });
    return { success: true };
  }
}
