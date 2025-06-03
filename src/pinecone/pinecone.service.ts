import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pinecone, Index, PineconeRecord } from '@pinecone-database/pinecone';
import { pineconeConfig } from '../config/pinecone.config';

// Define a more specific type for metadata if you have common structures
// For now, Record<string, any> is broadly compatible.
type DocumentMetadata = Record<string, any>;

@Injectable()
export class PineconeService implements OnModuleInit {
  private readonly logger = new Logger(PineconeService.name);
  private pinecone: Pinecone;
  private index: Index<DocumentMetadata>; // Declare the index property with a specific type

  async onModuleInit() {
    console.log(pineconeConfig);
    if (!pineconeConfig.apiKey) {
      this.logger.error(
        'Pinecone API key is not configured. Please set PINECONE_API_KEY.',
      );
      return;
    }
    // The environment is typically part of the Pinecone object initialization in newer client versions
    // or handled by the client if connecting to a specific project.
    // If your client version requires it explicitly and it's not for serverless, adjust accordingly.

    this.pinecone = new Pinecone({
      apiKey: pineconeConfig.apiKey,
      // environment: pineconeConfig.environment, // Environment is often not needed here for v2+ client for serverless
    });
    this.logger.log('Pinecone client initialized');

    try {
      await this.pinecone.describeIndex(pineconeConfig.indexName);
      this.logger.log(
        `Connected to existing Pinecone index: ${pineconeConfig.indexName}`,
      );
    } catch (error) {
      // Type guard to check if it's an error indicating the index doesn't exist
      // This is a common way, but the exact error message or type might vary.
      // For now, we assume any error here means it might not exist or other issue like auth.
      this.logger.warn(
        `Pinecone index '${pineconeConfig.indexName}' may not exist or other error: ${error.message}. Attempting to create...`,
      );
      try {
        await this.pinecone.createIndex({
          name: pineconeConfig.indexName,
          dimension: 1536, // Set your embedding dimension
          metric: 'cosine', // Set your preferred metric
          spec: {
            serverless: {
              cloud: 'aws', // Choose your cloud provider: 'aws', 'gcp', or 'azure'
              region: 'us-east-1', // Choose the region for your index
            },
            // For pod-based indexes, the spec would be different, e.g.:
            // pod: {
            //   environment: pineconeConfig.environment, // Your project's environment
            //   pods: 1, // Number of pods
            //   podType: 'p1.x1' // Pod type
            // }
          },
        });
        this.logger.log(
          `Pinecone index ${pineconeConfig.indexName} creation requested. It may take a moment to be ready.`,
        );
        // It might be good to add a small delay or a loop to check for index readiness before assigning
        // For simplicity, we assign immediately. Operations might fail if index is not ready.
      } catch (createError) {
        this.logger.error(
          `Failed to create Pinecone index '${pineconeConfig.indexName}': ${createError.message}`,
        );
        // If creation fails, re-throw or handle so the service doesn't operate on a non-existent/failed index
        throw createError;
      }
    }
    this.index = this.pinecone.index<DocumentMetadata>(
      pineconeConfig.indexName,
    );
  }

  async upsertVectors(
    vectors: Array<PineconeRecord<DocumentMetadata>>, // Use PineconeRecord with specific metadata type
  ) {
    if (!this.index) {
      // Check this.index directly
      this.logger.error(
        'Pinecone index is not initialized. Cannot upsert vectors.',
      );
      return;
    }
    try {
      await this.index.upsert(vectors);
      this.logger.log(
        `Upserted ${vectors.length} vectors to index: ${pineconeConfig.indexName}`,
      );
    } catch (error) {
      this.logger.error('Error upserting vectors to Pinecone:', error);
      throw error;
    }
  }

  async queryVectors(
    vector: number[],
    topK: number,
    filter?: DocumentMetadata,
  ) {
    if (!this.index) {
      // Check this.index directly
      this.logger.error(
        'Pinecone index is not initialized. Cannot query vectors.',
      );
      return;
    }
    try {
      const queryResponse = await this.index.query({
        vector,
        topK,
        filter,
        includeMetadata: true,
        includeValues: false,
      });
      this.logger.log(
        `Query response from index ${pineconeConfig.indexName}:`,
        // queryResponse, // Logging the whole response can be verbose
      );
      return queryResponse;
    } catch (error) {
      this.logger.error('Error querying vectors from Pinecone:', error);
      throw error;
    }
  }

  // Add other methods as needed, e.g., delete, describeIndexStats, etc.
}
