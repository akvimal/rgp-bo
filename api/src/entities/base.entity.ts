import { Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

export abstract class BaseEntity {

    @Column({ name: 'active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'archive', type: 'boolean', default: false })
    isArchived: boolean;

    @CreateDateColumn({ name: 'created_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    createdon: Date;

    @Column({ name: 'created_by', type: 'integer' })
    createdby: number;

    @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    updatedon: Date;

    @Column({ name: 'updated_by', type: 'integer' })
    updatedby: number;

}