import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('rag_vector_mapping')
export class VectorMappingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'doc_id', type: 'bigint' })
  docId: number;

  @Column({ name: 'vector_id', length: 100 })
  vectorId: string;

  @Column({ name: 'chunk_index', type: 'int', default: 0 })
  chunkIndex: number;

  @Column({ name: 'chunk_content', type: 'text', nullable: true })
  chunkContent: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
