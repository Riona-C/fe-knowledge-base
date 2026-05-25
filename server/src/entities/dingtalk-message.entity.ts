import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dingtalk_message')
export class DingtalkMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'conversation_id', length: 200, nullable: true })
  conversationId: string;

  @Column({ name: 'msg_content', type: 'longtext' })
  msgContent: string;

  @Column({ length: 100, nullable: true })
  sender: string;

  @Column({ name: 'sender_id', length: 100, nullable: true })
  senderId: string;

  @Column({ name: 'send_time', type: 'datetime', nullable: true })
  sendTime: Date;

  @Column({ name: 'handle_status', type: 'tinyint', default: 0 })
  handleStatus: number;

  @Column({ name: 'doc_id', type: 'bigint', nullable: true })
  docId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
