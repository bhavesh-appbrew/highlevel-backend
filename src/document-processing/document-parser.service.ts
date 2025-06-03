import { Injectable, Logger } from '@nestjs/common';
// You'll need to install and import libraries for specific file types
// Example for PDF: import * as pdfParse from 'pdf-parse';
// Example for CSV: import * as Papa from 'papaparse';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  constructor() {
    this.parseDocument(
      path.join(__dirname, '../../src/document-processing/test.txt'),
    );
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
          // const data = await pdfParse(fileBuffer);
          // textContent = data.text;
          textContent =
            'PDF parsing not implemented yet. Requires pdf-parse library.';
          this.logger.warn(
            'PDF parsing is a placeholder. Implement with a library like pdf-parse.',
          );
          break;
        case '.csv':
          // const csvData = Papa.parse(fileBuffer.toString(), { header: true });
          // textContent = JSON.stringify(csvData.data); // Or process rows into text
          // metadata.rows = csvData.data.length;
          textContent =
            'CSV parsing not implemented yet. Requires papaparse library.';
          this.logger.warn(
            'CSV parsing is a placeholder. Implement with a library like papaparse.',
          );
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
      console.log({ textContent, metadata });
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
