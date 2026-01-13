import { Injectable, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppUser } from 'src/entities/appuser.entity';
import { PermissionService } from 'src/core/services/permission.service';

@Injectable()
export class AuthHelper {

  @InjectRepository(AppUser)
  private readonly repository: Repository<AppUser>;

  private readonly jwt: JwtService;

  constructor(
    jwt: JwtService,
    private readonly permissionService: PermissionService
  ) {
    this.jwt = jwt;
  }

  // Decoding the JWT Token
  public async decode(token: string): Promise<unknown> {
    return this.jwt.decode(token, {json: true});
  }

  // Get User by User ID we get from decode()
  public async validateUser(decoded: any): Promise<AppUser> {
    const user = await this.repository.findOne({where:{id:decoded['id']}});
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  // Generate JWT Token with multi-role permissions
  public async generateToken(user: AppUser): Promise<string> {
    // Resolve all permissions from all user's roles
    const permissions = await this.permissionService.resolveUserPermissions(user.id);

    // Get all role IDs for user
    const roleIds = await this.permissionService.getUserRoleIds(user.id);

    return this.jwt.sign({
      id: user.id,
      email: user.email,
      role_id: user.roleid,        // Primary role (backward compatibility)
      role_ids: roleIds,            // All role IDs
      permissions: permissions      // Merged permissions from all roles
    });
  }

  // Validate User's password
  public isPasswordValid(password: string, userPassword: string): boolean {
    return bcrypt.compareSync(password, userPassword);
  }

  // Encode User's password
  public encodePassword(password: string): string {
    const salt: string = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  }

  // Validate JWT Token, throw forbidden error if JWT Token is invalid
  private async validate(token: string): Promise<boolean | never> {
    const decoded: unknown = this.jwt.verify(token);

    if (!decoded) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const user = await this.validateUser(decoded);

    if (!user) {
      throw new UnauthorizedException();
    }

    return true;
  }
}