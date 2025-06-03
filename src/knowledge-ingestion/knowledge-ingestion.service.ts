import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { DocumentParserService } from '../document-processing/document-parser.service';
import { EmbeddingService } from '../document-processing/embedding.service';
import { PineconeService } from '../pinecone/pinecone.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { URL } from 'url'; // For parsing S3 URL
import * as os from 'os'; // For temporary file storage

@Injectable()
export class KnowledgeIngestionService {
  private readonly logger = new Logger(KnowledgeIngestionService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly docParserService: DocumentParserService,
    private readonly embeddingService: EmbeddingService,
    private readonly pineconeService: PineconeService,
  ) {}

  async generatePresignedUrl(
    fileName: string,
    fileType: string,
  ): Promise<string> {
    this.logger.log(
      `Generating presigned URL for: ${fileName}, type: ${fileType}`,
    );
    // You might want to sanitize fileName or create a unique key for S3
    const s3Key = `uploads/${Date.now()}-${path.basename(fileName)}`;
    return this.s3Service.getPresignedUrl(s3Key, fileType);
  }

  async processDocumentFromS3(
    s3ObjectUrl: string,
  ): Promise<{ documentId: string }> {
    this.logger.log(`Processing document from S3 URL: ${s3ObjectUrl}`);
    let tempFilePath = null;

    try {
      // 1. Parse S3 URL to get bucket and key
      // Basic parsing, assuming a virtual-hosted–style S3 URL like https://bucket-name.s3.region-code.amazonaws.com/key
      // or a path-style URL if not using a custom domain or if bucket name has dots.
      // A more robust S3 URL parser might be needed for all cases.
      const parsedUrl = new URL(s3ObjectUrl);
      let s3Key: string;
      let bucketName: string;

      if (
        parsedUrl.hostname.endsWith('.s3.amazonaws.com') ||
        parsedUrl.hostname.includes('.s3-website')
      ) {
        // Standard S3 virtual-hosted style or website endpoint
        // Example: my-bucket.s3.us-east-1.amazonaws.com or my-bucket.s3-website.us-east-1.amazonaws.com
        const hostnameParts = parsedUrl.hostname.split('.');
        bucketName = hostnameParts[0];
        s3Key = parsedUrl.pathname.startsWith('/')
          ? parsedUrl.pathname.substring(1)
          : parsedUrl.pathname;
      } else if (parsedUrl.protocol === 's3:') {
        // S3 URI: s3://bucket-name/key
        bucketName = parsedUrl.hostname; // Bucket name is in hostname part
        s3Key = parsedUrl.pathname.startsWith('/')
          ? parsedUrl.pathname.substring(1)
          : parsedUrl.pathname;
      } else {
        // Potentially a custom domain or other S3 URL format not directly parsed here.
        // This basic parser might not cover all S3 URL formats (e.g., path-style with region, access points).
        // For this example, we'll assume the key is the full pathname.
        // You might need to adjust bucket detection if using custom domains that don't match awsConfig.s3BucketName
        s3Key = parsedUrl.pathname.startsWith('/')
          ? parsedUrl.pathname.substring(1)
          : parsedUrl.pathname;
        // bucketName = awsConfig.s3BucketName; // Fallback or require specific format
        this.logger.warn(
          `Could not reliably parse bucket name from URL ${s3ObjectUrl}, assuming key is path. Ensure bucket config is correct.`,
        );
        // For a robust solution, ensure the URL format is predictable or use a library for S3 URL parsing.
      }

      if (!s3Key) {
        throw new Error('Could not determine S3 key from URL.');
      }

      this.logger.log(`Extracted S3 Key: ${s3Key}`);

      // 2. Download file from S3 to a temporary location
      const s3Object = await this.s3Service.getObject(s3Key);
      if (!s3Object.Body) {
        throw new Error(`S3 object Body is empty for key: ${s3Key}`);
      }
      const originalFileName = path.basename(s3Key);
      tempFilePath = path.join(
        os.tmpdir(),
        `doc-${Date.now()}-${originalFileName}`,
      );
      await fs.writeFile(tempFilePath, s3Object.Body.toString()); // Assuming Body is Buffer or string like
      this.logger.log(
        `Document downloaded from S3 to temporary path: ${tempFilePath}`,
      );

      // 3. Parse the downloaded document
      // The DocumentParserService expects a local file path
      const { content, metadata } =
        await this.docParserService.parseDocument(tempFilePath);
      if (!content || content.trim().length === 0) {
        this.logger.warn(`Parsed content is empty for document: ${s3Key}`);
        // Decide how to handle empty content: skip, error, etc.
        // For now, we'll try to proceed if metadata exists, or throw error.
        if (Object.keys(metadata).length === 0)
          throw new Error('Parsed content and metadata are empty.');
      }
      this.logger.log(
        `Document parsed. Content length: ${content.length}, Metadata: ${JSON.stringify(metadata)}`,
      );

      // 4. Generate embeddings (potentially in chunks)
      // The EmbeddingService's getEmbeddingsForDocuments expects an array.
      // We'll create an array with one document. Chunking should ideally happen within EmbeddingService or here.
      const documentForEmbedding = {
        id: s3Key, // Use S3 key as a unique ID for the document/vector
        content: content,
        metadata: {
          ...metadata,
          s3_url: s3ObjectUrl,
          original_filename: originalFileName,
        },
      };
      const vectorsToUpsert =
        await this.embeddingService.getEmbeddingsForDocuments([
          documentForEmbedding,
        ]);

      if (!vectorsToUpsert || vectorsToUpsert.length === 0) {
        throw new Error(`Failed to generate embeddings for document: ${s3Key}`);
      }
      this.logger.log(
        `Embeddings generated. Number of vectors: ${vectorsToUpsert.length}`,
      );

      // 5. Upsert vectors to Pinecone
      await this.pineconeService.upsertVectors(vectorsToUpsert);
      this.logger.log(
        `Document ${s3Key} and its embeddings successfully processed and upserted to Pinecone.`,
      );

      return { documentId: s3Key };
    } catch (error) {
      this.logger.error(
        `Error processing document from S3 ${s3ObjectUrl}:`,
        error.stack,
      );
      throw error; // Re-throw to be caught by controller or error handler
    } finally {
      // 6. Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
          this.logger.log(`Temporary file ${tempFilePath} deleted.`);
        } catch (cleanupError) {
          this.logger.error(
            `Error deleting temporary file ${tempFilePath}:`,
            cleanupError,
          );
        }
      }
    }
  }
}
