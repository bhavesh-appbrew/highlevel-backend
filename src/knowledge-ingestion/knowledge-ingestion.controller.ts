import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';
import {
  GetPresignedUrlDto,
  ProcessS3DocumentDto,
} from './dto/knowledge-ingestion.dto';

@Controller('knowledge-ingestion')
export class KnowledgeIngestionController {
  private readonly logger = new Logger(KnowledgeIngestionController.name);

  constructor(private readonly ingestionService: KnowledgeIngestionService) {}

  @Post('presigned-upload-url')
  @HttpCode(HttpStatus.OK)
  async getPresignedUploadUrl(
    @Body() getPresignedUrlDto: GetPresignedUrlDto,
  ): Promise<{ url: string }> {
    this.logger.log(
      `Received request for presigned URL: ${JSON.stringify(getPresignedUrlDto)}`,
    );
    const url = await this.ingestionService.generatePresignedUrl(
      getPresignedUrlDto.fileName,
      getPresignedUrlDto.fileType,
    );
    return { url };
  }

  @Post('process-document')
  @HttpCode(HttpStatus.ACCEPTED) // Using 202 Accepted as processing might take time
  async processS3Document(
    @Body() processS3DocumentDto: ProcessS3DocumentDto,
  ): Promise<{ message: string; documentId?: string }> {
    this.logger.log(
      `Received request to process S3 document: ${processS3DocumentDto.s3ObjectUrl}`,
    );
    // This will be an asynchronous operation. We acknowledge the request
    // and start processing. The actual status of processing might be handled
    // via webhooks, polling, or another notification mechanism in a robust system.
    try {
      const result = await this.ingestionService.processDocumentFromS3(
        processS3DocumentDto.s3ObjectUrl,
      );
      return {
        message: 'Document processing started.',
        documentId: result.documentId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to start processing S3 document ${processS3DocumentDto.s3ObjectUrl}:`,
        error.stack,
      );
      // Consider returning a more specific error response based on the error type
      return { message: 'Failed to start document processing.' };
    }
  }
}
