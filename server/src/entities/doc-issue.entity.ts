import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('doc_issue')
export class DocIssueEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'category_id', type: 'bigint' })
  categoryId: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'longtext', nullable: true })
  problem: string;

  @Column({ type: 'longtext', nullable: true })
  solution: string;

  @Column({ length: 500, nullable: true })
  tags: string;

  @Column({ type: 'tinyint', default: 1 })
  source: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'create_user_id', type: 'bigint' })
  createUserId: number;

  @Column({ name: 'update_user_id', type: 'bigint', nullable: true })
  updateUserId: number;

  @Column({ name: 'audit_user_id', type: 'bigint', nullable: true })
  auditUserId: number;

  @Column({ name: 'audit_time', type: 'datetime', nullable: true })
  auditTime: Date;

  @Column({ name: 'audit_remark', type: 'varchar', length: 500, nullable: true })
  auditRemark: string | null;

  @Column({ type: 'tinyint', default: 0 })
  deleted: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
