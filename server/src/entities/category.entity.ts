import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('doc_category')
export class CategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'parent_id', type: 'bigint', default: 0 })
  parentId: number;

  @Column({ name: 'category_name', length: 100 })
  categoryName: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'tinyint', default: 0 })
  deleted: number;

  @Column({ name: 'create_user_id', type: 'bigint', nullable: true })
  createUserId: number;

  @Column({ name: 'update_user_id', type: 'bigint', nullable: true })
  updateUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  /** 树形结构子节点（非数据库字段） */
  children?: CategoryEntity[];
}
