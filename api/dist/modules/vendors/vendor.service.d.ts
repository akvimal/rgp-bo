import { Vendor } from "src/entities/vendor.entity";
import { Repository } from "typeorm";
import { CreateVendorDto } from "./dto/create-vendor.dto";
export declare class VendorService {
    private readonly vendorRepository;
    constructor(vendorRepository: Repository<Vendor>);
    create(createVendorDto: CreateVendorDto): Promise<CreateVendorDto & Vendor>;
    findAll(): Promise<Vendor[]>;
    findById(id: string): Promise<Vendor>;
    update(id: any, values: any, userid: any): Promise<import("typeorm").UpdateResult>;
}
