import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { DocumentParserService } from '../document-processing/document-parser.service';
import { EmbeddingService } from '../document-processing/embedding.service';
import { PineconeService } from '../pinecone/pinecone.service';

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
    const s3Key = `uploads/${Date.now()}-${fileName}.${fileType}`;
    return this.s3Service.getPresignedUrl(s3Key, fileType);
  }

  /**
   * Process a document from S3 and store its embeddings in Pinecone
   * @param s3ObjectUrl The S3 URL of the document to process
   * @returns Object containing the document ID (S3 key)
   */
  async processDocumentFromS3(
    s3ObjectUrl: string,
  ): Promise<{ documentId: string }> {
    this.logger.log(`Starting to process document from S3 URL: ${s3ObjectUrl}`);

    try {
      // Step 1: Download the content from S3
      const { content, s3Key, originalFileName } =
        await this.s3Service.downloadFileContentFromUrl(s3ObjectUrl);

      // Step 2: Parse the document content
      const parsedDocument = await this.parseDocumentContent(
        content,
        originalFileName,
      );

      // Step 3: Generate embeddings and store in vector DB
      const documentId = await this.generateAndStoreEmbeddings(
        parsedDocument.content,
        parsedDocument.metadata,
        s3Key,
        s3ObjectUrl,
        originalFileName,
      );

      return { documentId };
    } catch (error) {
      this.logger.error(
        `Error processing document from S3 ${s3ObjectUrl}:`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Parse document content using the DocumentParserService
   * @param content The raw document content as a string
   * @param fileName The original file name
   * @returns Parsed content and metadata
   */
  private async parseDocumentContent(
    content: string,
    fileName: string,
  ): Promise<{ content: string; metadata: Record<string, any> }> {
    this.logger.log(`Parsing document content for file: ${fileName}`);

    try {
      // Use the new parseContentFromString method
      const result = await this.docParserService.parseContentFromString(
        content,
        fileName,
      );

      this.logger.log(
        `Document parsed successfully. Content length: ${result.content.length}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error parsing document content for ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate embeddings for the document content and store them in Pinecone
   * @param content The parsed document content
   * @param metadata The document metadata from parsing
   * @param documentId The document ID (S3 key)
   * @param s3ObjectUrl The original S3 URL
   * @param originalFileName The original file name
   * @returns The document ID
   */
  private async generateAndStoreEmbeddings(
    content: string,
    metadata: Record<string, any>,
    documentId: string,
    s3ObjectUrl: string,
    originalFileName: string,
  ): Promise<string> {
    this.logger.log(`Generating embeddings for document: ${documentId}`);

    try {
      // Prepare the document for embedding
      const documentForEmbedding = {
        id: documentId,
        content: content,
        metadata: {
          ...metadata,
          s3_url: s3ObjectUrl,
          original_filename: originalFileName,
        },
      };

      console.log('documentForEmbedding', documentForEmbedding);

      // Generate embeddings
      const vectorsToUpsert =
        await this.embeddingService.getEmbeddingsForDocuments([
          documentForEmbedding,
        ]);

      console.log('vectorsToUpsert', vectorsToUpsert);

      if (!vectorsToUpsert || vectorsToUpsert.length === 0) {
        throw new Error(
          `Failed to generate embeddings for document: ${documentId}`,
        );
      }

      this.logger.log(
        `Embeddings generated. Number of vectors: ${vectorsToUpsert.length}`,
      );

      // Store embeddings in Pinecone
      await this.pineconeService.upsertVectors(vectorsToUpsert);

      this.logger.log(
        `Document ${documentId} embeddings successfully stored in vector database`,
      );

      return documentId;
    } catch (error) {
      this.logger.error(
        `Error generating or storing embeddings for ${documentId}:`,
        error,
      );
      throw error;
    }
  }
}
