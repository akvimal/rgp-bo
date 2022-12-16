import { AppUser } from "./AppUser.entity";
import { BaseEntity } from "./base.entity";
export declare class AppRole extends BaseEntity {
    id: number;
    name: string;
    permissions: object | null;
    isLocked: boolean;
    appUsers: AppUser[];
}
