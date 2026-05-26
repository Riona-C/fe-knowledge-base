import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('doc_version')
export class DocVersionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'doc_id', type: 'bigint' })
  docId: number;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'longtext', nullable: true })
  problem: string;

  @Column({ type: 'longtext', nullable: true })
  solution: string;

  @Column({ length: 500, nullable: true })
  tags: string;

  @Column({ name: 'category_id', type: 'bigint' })
  categoryId: number;

  @Column({ name: 'editor_user_id', type: 'bigint' })
  editorUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
