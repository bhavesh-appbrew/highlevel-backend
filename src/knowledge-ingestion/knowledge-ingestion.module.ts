import { Module } from '@nestjs/common';
import { KnowledgeIngestionController } from './knowledge-ingestion.controller';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';
import { S3Module } from '../s3/s3.module';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';
import { PineconeModule } from '../pinecone/pinecone.module';

@Module({
  imports: [
    S3Module, // For S3Service
    DocumentProcessingModule, // For DocumentParserService & EmbeddingService
    PineconeModule, // For PineconeService
  ],
  controllers: [KnowledgeIngestionController],
  providers: [KnowledgeIngestionService],
})
export class KnowledgeIngestionModule {} 