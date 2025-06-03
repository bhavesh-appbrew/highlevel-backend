import { Module } from '@nestjs/common';
// import { KnowledgeQueryController } from './knowledge-query.controller';
// import { KnowledgeQueryService } from './knowledge-query.service';
// import { PineconeModule } from '../pinecone/pinecone.module';
// import { EmbeddingModule } from '../document-processing/embedding.module'; // If needed for query embeddings

@Module({
  imports: [
    // PineconeModule, 
    // EmbeddingModule 
  ],
  // controllers: [KnowledgeQueryController],
  // providers: [KnowledgeQueryService],
})
export class KnowledgeQueryModule {} 