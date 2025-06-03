export const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID',
  secretAccessKey:
    process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY',
  region: process.env.AWS_REGION || 'YOUR_AWS_REGION',
  s3BucketName: process.env.S3_BUCKET_NAME || 'your-s3-bucket-name',
};

// Ensure you have AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
// and S3_BUCKET_NAME set in your .env file
