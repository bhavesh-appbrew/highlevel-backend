import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { awsConfig } from '../config/aws.config';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: AWS.S3;

  constructor() {
    if (
      !awsConfig.accessKeyId ||
      awsConfig.accessKeyId === 'YOUR_AWS_ACCESS_KEY_ID' ||
      !awsConfig.secretAccessKey ||
      awsConfig.secretAccessKey === 'YOUR_AWS_SECRET_ACCESS_KEY' ||
      !awsConfig.region ||
      awsConfig.region === 'YOUR_AWS_REGION' ||
      !awsConfig.s3BucketName ||
      awsConfig.s3BucketName === 'your-s3-bucket-name'
    ) {
      this.logger.error(
        'AWS S3 credentials or bucket name are not fully configured. Please check your .env file and aws.config.ts',
      );
      // Depending on strictness, you might throw an error here
      // throw new Error('AWS S3 not configured');
      // For now, we allow initialization but operations will likely fail.
      // Initialize s3 with potentially incomplete config to avoid runtime error on new AWS.S3 if keys are undefined.
      this.s3 = new AWS.S3({
        accessKeyId:
          awsConfig.accessKeyId === 'YOUR_AWS_ACCESS_KEY_ID'
            ? undefined
            : awsConfig.accessKeyId,
        secretAccessKey:
          awsConfig.secretAccessKey === 'YOUR_AWS_SECRET_ACCESS_KEY'
            ? undefined
            : awsConfig.secretAccessKey,
        region:
          awsConfig.region === 'YOUR_AWS_REGION' ? undefined : awsConfig.region,
        signatureVersion: 'v4', // Important for pre-signed URLs
      });
      return;
    }

    this.s3 = new AWS.S3({
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
      region: awsConfig.region,
      signatureVersion: 'v4', // Important for pre-signed URLs
    });
    this.logger.log('S3 client initialized');
  }

  async getPresignedUrl(fileName: string, fileType: string): Promise<string> {
    if (
      !this.s3 ||
      !awsConfig.s3BucketName ||
      awsConfig.s3BucketName === 'your-s3-bucket-name'
    ) {
      this.logger.error(
        'S3 service or bucket name is not properly configured to generate a pre-signed URL.',
      );
      throw new Error(
        'S3 service not configured for pre-signed URL generation.',
      );
    }

    const params = {
      Bucket: awsConfig.s3BucketName,
      Key: fileName, // or customize the key, e.g., `uploads/${Date.now()}-${fileName}`
      Expires: 60 * 5, // URL expires in 5 minutes
      ContentType: fileType,
      // ACL: 'public-read', // Optional: if you want the object to be public after upload via signed URL
    };

    try {
      const url = await this.s3.getSignedUrlPromise('putObject', params);
      this.logger.log(`Generated pre-signed URL for ${fileName}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Error generating pre-signed URL for ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  // Method to download a file from S3, might be used by KnowledgeIngestionService
  async getObject(key: string): Promise<AWS.S3.GetObjectOutput> {
    if (
      !this.s3 ||
      !awsConfig.s3BucketName ||
      awsConfig.s3BucketName === 'your-s3-bucket-name'
    ) {
      this.logger.error(
        'S3 service or bucket name is not properly configured to get an object.',
      );
      throw new Error('S3 service not configured for getObject operation.');
    }

    const params = {
      Bucket: awsConfig.s3BucketName,
      Key: key,
    };

    try {
      this.logger.log(`Fetching object from S3: ${key}`);
      return await this.s3.getObject(params).promise();
    } catch (error) {
      this.logger.error(`Error fetching object ${key} from S3:`, error);
      throw error;
    }
  }
}
