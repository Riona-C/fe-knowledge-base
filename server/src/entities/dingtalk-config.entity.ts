import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_dingtalk')
export class DingtalkConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'app_key', length: 200 })
  appKey: string;

  @Column({ name: 'app_secret', length: 200 })
  appSecret: string;

  @Column({ name: 'robot_code', length: 100, nullable: true })
  robotCode: string;

  @Column({ name: 'group_ids', length: 1000, nullable: true })
  groupIds: string;

  @Column({ type: 'tinyint', default: 1 })
  enable: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
