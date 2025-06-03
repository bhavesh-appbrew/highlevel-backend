export const pineconeConfig = {
  apiKey: process.env.PINECONE_API_KEY || 'YOUR_API_KEY',
  environment: process.env.PINECONE_ENVIRONMENT || 'YOUR_ENVIRONMENT',
  indexName: process.env.PINECONE_INDEX_NAME || 'your-index-name',
};

// Ensure you have PINECONE_API_KEY, PINECONE_ENVIRONMENT, and PINECONE_INDEX_NAME set in your .env file
