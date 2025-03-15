import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { Vendor } from "src/entities/vendor.entity";

@Injectable()
export class VendorService {

    constructor(@InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>) { }

    async create(createVendorDto: CreateVendorDto) {
        return this.vendorRepository.save(createVendorDto);
      }
    
    async findAll(){
        return this.vendorRepository.createQueryBuilder(`p`)
            .where('p.active = :flag', { flag: true }).getMany();
    }

    // async update(id:any, values:any){
    //     await this.vendorRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
    //         const obj = await this.vendorRepository.findOne({id});
    //         await transaction.update(Vendor, id, {...obj, ...values});
    //     });
    //   }

      findById(id:number) {
        return this.vendorRepository.findOne({where:{id}});
    }

    async update(id:any, values:any, userid){
        return this.vendorRepository.update(id, {...values, updatedby:userid});
      }
}