import { Injectable, Logger } from '@nestjs/common';
// Import the libraries we just installed
import * as pdfParse from 'pdf-parse';
import * as Papa from 'papaparse';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * Parse document content directly from a string
   * @param content The string content to parse
   * @param fileName Original file name (used to determine file type and for metadata)
   * @returns Parsed content and metadata
   */
  async parseContentFromString(
    content: string,
    fileName: string,
  ): Promise<{ content: string; metadata: Record<string, any> }> {
    const fileExtension = path.extname(fileName).toLowerCase();
    let textContent = '';
    const metadata: Record<string, any> = { source: fileName };

    this.logger.log(
      `Parsing content from string. File type: ${fileExtension}, File name: ${fileName}`,
    );

    try {
      switch (fileExtension) {
        case '.pdf':
          try {
            // For PDFs, content from S3 will likely be a base64 encoded string
            // We need to convert it to a Buffer for pdf-parse
            // First, check if the content is base64 encoded
            let pdfBuffer: Buffer;

            // Try to detect if content is already base64 encoded
            // This is a simple heuristic - in production, you might need more robust detection
            if (content.match(/^[\w+/=]+$/)) {
              // Looks like base64, try to decode it
              pdfBuffer = Buffer.from(content, 'base64');
            } else {
              // Not base64, might be binary data already as a string
              // Convert to buffer directly
              pdfBuffer = Buffer.from(content);
            }

            // Parse the PDF
            const pdfData = await pdfParse(pdfBuffer);
            textContent = pdfData.text;

            // Add additional metadata from the PDF
            metadata.pageCount = pdfData.numpages;
            metadata.info = pdfData.info;

            this.logger.log(
              `Successfully parsed PDF content. Extracted ${textContent.length} characters from ${pdfData.numpages} pages.`,
            );
          } catch (pdfError) {
            this.logger.error(
              `Error parsing PDF content: ${pdfError.message}`,
              pdfError.stack,
            );
            textContent =
              'Failed to parse PDF content. Error: ' + pdfError.message;
          }
          break;

        case '.csv':
          try {
            // Parse CSV content using PapaParse
            const csvData = Papa.parse(content, {
              header: true,
              skipEmptyLines: true,
            });

            // Extract data rows as structured content
            textContent = csvData.data
              .map((row) => JSON.stringify(row))
              .join('\n');

            // Add metadata about the CSV structure
            metadata.rowCount = csvData.data.length;
            metadata.fields = csvData.meta.fields;
            metadata.delimiter = csvData.meta.delimiter;

            if (csvData.errors && csvData.errors.length > 0) {
              metadata.parseErrors = csvData.errors;
              this.logger.warn(
                `CSV parsed with ${csvData.errors.length} errors`,
                csvData.errors,
              );
            }

            this.logger.log(
              `Successfully parsed CSV with ${csvData.data.length} rows and ${metadata.fields?.length || 0} columns.`,
            );
          } catch (csvError) {
            this.logger.error(
              `Error parsing CSV content: ${csvError.message}`,
              csvError.stack,
            );
            textContent =
              'Failed to parse CSV content. Error: ' + csvError.message;
          }
          break;

        case '.txt':
          textContent = content; // For text files, the content is already text
          break;

        case '.json':
          try {
            const jsonData = JSON.parse(content);
            textContent = JSON.stringify(jsonData); // Or extract specific fields
            // You might want to flatten the JSON or extract key text fields
          } catch (jsonError) {
            this.logger.error(
              `Error parsing JSON content: ${jsonError.message}`,
            );
            textContent = content; // Fallback to raw content
          }
          break;

        default:
          this.logger.warn(
            `Unsupported file type: ${fileExtension} for file ${fileName}`,
          );
          // For unknown types, just use the raw content
          textContent = content;
      }

      this.logger.log(
        `Successfully parsed content from string for ${fileName}`,
      );
      return { content: textContent, metadata };
    } catch (error) {
      this.logger.error(
        `Error parsing content from string for ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  async parseDocument(
    filePath: string,
  ): Promise<{ content: string; metadata: Record<string, any> }> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    let textContent = '';
    const metadata: Record<string, any> = { source: fileName };

    try {
      const fileBuffer = await fs.readFile(filePath);
      this.logger.log(`Parsing document: ${filePath}`);

      switch (fileExtension) {
        case '.pdf':
          try {
            const data = await pdfParse(fileBuffer);
            textContent = data.text;
            metadata.pageCount = data.numpages;
            metadata.info = data.info;
          } catch (pdfError) {
            this.logger.error(
              `Error parsing PDF file: ${pdfError.message}`,
              pdfError.stack,
            );
            textContent =
              'Failed to parse PDF file. Error: ' + pdfError.message;
          }
          break;

        case '.csv':
          try {
            const csvString = fileBuffer.toString();
            const csvData = Papa.parse(csvString, {
              header: true,
              skipEmptyLines: true,
            });

            textContent = csvData.data
              .map((row) => JSON.stringify(row))
              .join('\n');

            metadata.rowCount = csvData.data.length;
            metadata.fields = csvData.meta.fields;
            metadata.delimiter = csvData.meta.delimiter;

            if (csvData.errors && csvData.errors.length > 0) {
              metadata.parseErrors = csvData.errors;
              this.logger.warn(
                `CSV parsed with ${csvData.errors.length} errors`,
                csvData.errors,
              );
            }
          } catch (csvError) {
            this.logger.error(
              `Error parsing CSV file: ${csvError.message}`,
              csvError.stack,
            );
            textContent =
              'Failed to parse CSV file. Error: ' + csvError.message;
          }
          break;

        case '.txt':
          textContent = fileBuffer.toString();
          break;

        case '.json':
          const jsonData = JSON.parse(fileBuffer.toString());
          textContent = JSON.stringify(jsonData); // Or extract specific fields
          // You might want to flatten the JSON or extract key text fields
          break;

        default:
          this.logger.warn(
            `Unsupported file type: ${fileExtension} for file ${fileName}`,
          );
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      this.logger.log(`Successfully parsed ${fileName}`);
      return { content: textContent, metadata };
    } catch (error) {
      this.logger.error(`Error parsing document ${fileName}:`, error);
      throw error;
    }
  }

  // You might want a method to process a directory of documents
  async processDirectory(
    directoryPath: string,
  ): Promise<
    Array<{ id: string; content: string; metadata: Record<string, any> }>
  > {
    const files = await fs.readdir(directoryPath);
    const processedDocs = [];
    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const { content, metadata } = await this.parseDocument(filePath);
          // Generate a unique ID for each document, filePath can be a good candidate
          processedDocs.push({ id: filePath, content, metadata });
        }
      } catch (error) {
        this.logger.error(`Skipping file ${file} due to error:`, error.message);
      }
    }
    return processedDocs;
  }
}
