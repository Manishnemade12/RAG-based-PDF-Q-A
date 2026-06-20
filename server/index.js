import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  answerQuestion,
  getDocuments,
  ingestPdfDocument
} from './pipeline.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const port = Number(process.env.PORT || 3001);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'ai-study-assistant' });
});

app.get('/api/documents', (_request, response) => {
  response.json({ documents: getDocuments() });
});

app.post('/api/documents', upload.single('file'), async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).json({ error: 'A PDF file is required.' });
    }

    if (request.file.mimetype !== 'application/pdf') {
      return response.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const result = await ingestPdfDocument({
      buffer: request.file.buffer,
      filename: request.file.originalname
    });

    return response.status(201).json({ document: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process document.';
    return response.status(500).json({ error: message });
  }
});

app.post('/api/chat', async (request, response) => {
  try {
    const { question, documentId } = request.body ?? {};

    if (!question || typeof question !== 'string') {
      return response.status(400).json({ error: 'A question is required.' });
    }

    const result = await answerQuestion({
      question,
      documentId: typeof documentId === 'string' ? documentId : undefined
    });

    return response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to answer the question.';
    return response.status(500).json({ error: message });
  }
});

if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`AI Study Assistant server running on http://localhost:${port}`);
});