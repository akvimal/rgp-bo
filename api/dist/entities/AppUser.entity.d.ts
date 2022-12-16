import { AppRole } from "./approle.entity";
import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";
export declare class AppUser extends BaseEntity {
    id: number;
    roleid: number;
    email: string;
    password: string;
    phone: string | null;
    location: string | null;
    fullname: string;
    lastlogin: Date | null;
    role: AppRole;
    sales: Sale[];
}
