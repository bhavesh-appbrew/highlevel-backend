import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PineconeModule } from './pinecone/pinecone.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';
import { ConfigModule } from '@nestjs/config';
import { S3Module } from './s3/s3.module';
import { KnowledgeIngestionModule } from './knowledge-ingestion/knowledge-ingestion.module';
import { KnowledgeQueryModule } from './knowledge-query/knowledge-query.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PineconeModule,
    DocumentProcessingModule,
    S3Module,
    KnowledgeIngestionModule,
    KnowledgeQueryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
