import { VendorService } from "./vendor.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
export declare class VendorController {
    private vendorService;
    constructor(vendorService: VendorService);
    create(createVendorDto: CreateVendorDto): Promise<CreateVendorDto & import("../../entities/vendor.entity").Vendor>;
    update(id: string, updateDto: UpdateVendorDto, currentUser: any): Promise<import("typeorm").UpdateResult>;
    findAll(): Promise<import("../../entities/vendor.entity").Vendor[]>;
    findOne(id: string): Promise<import("../../entities/vendor.entity").Vendor>;
    remove(id: string, currentUser: any): Promise<import("typeorm").UpdateResult>;
}
