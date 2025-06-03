export class GetPresignedUrlDto {
  fileName: string;
  fileType: string;
}

export class ProcessS3DocumentDto {
  s3ObjectUrl: string; // e.g., s3://your-bucket-name/path/to/your/file.pdf or https://your-bucket.s3.region.amazonaws.com/path/to/file
} 