import { Module } from '@nestjs/common';
import { DocumentParserService } from './document-parser.service';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [DocumentParserService, EmbeddingService],
  exports: [DocumentParserService, EmbeddingService],
})
export class DocumentProcessingModule {}
