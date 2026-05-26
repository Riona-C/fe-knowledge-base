import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sys_audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ length: 50 })
  action: string;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'bigint', default: 0 })
  resourceId: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  detail: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
