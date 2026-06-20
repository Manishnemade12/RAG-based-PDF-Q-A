import path from 'path';
import pdf from 'pdf-parse';
import {
  buildChunks,
  buildEmbedding,
  cosineSimilarity,
  normalizeText,
  topMatches
} from './vector.js';
import { generateGrokAnswer } from './grokClient.js';

const documents = [];
const maxChunkWords = Number(process.env.MAX_CHUNK_WORDS || 800);
const chunkOverlapWords = Number(process.env.CHUNK_OVERLAP_WORDS || 150);

export function getDocuments() {
  return documents.map(({ chunks, ...document }) => ({
    ...document,
    chunkCount: chunks.length
  }));
}

export async function ingestPdfDocument({ buffer, filename }) {
  const documentId = `${Date.now()}-${sanitizeName(filename)}`;
  const baseDocument = {
    documentId,
    filename,
    uploadedAt: new Date().toISOString(),
    pageCount: 0,
    chunks: [],
    status: 'processing',
    error: null
  };

  let parsed;

  try {
    parsed = await pdf(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF parse error';
    const document = {
      ...baseDocument,
      status: 'needs_text',
      error: `Failed to parse PDF: ${message}`
    };

    documents.unshift(document);

    return {
      documentId: document.documentId,
      filename: document.filename,
      pageCount: document.pageCount,
      chunkCount: 0,
      uploadedAt: document.uploadedAt,
      status: document.status,
      error: document.error
    };
  }

  const pages = String(parsed.text || '')
    .split(/\f/g)
    .map((pageText) => normalizeText(pageText))
    .filter((pageText) => pageText.length > 0);

  if (!pages.length) {
    const document = {
      ...baseDocument,
      status: 'needs_text',
      error: 'No extractable text was found in the PDF.'
    };

    documents.unshift(document);

    return {
      documentId: document.documentId,
      filename: document.filename,
      pageCount: document.pageCount,
      chunkCount: 0,
      uploadedAt: document.uploadedAt,
      status: document.status,
      error: document.error
    };
  }

  const chunks = buildChunks(pages, {
    maxWords: maxChunkWords,
    overlapWords: chunkOverlapWords
  }).map((chunk, index) => ({
    ...chunk,
    chunkId: `${Date.now()}-${index + 1}`,
    embedding: buildEmbedding(chunk.text)
  }));

  const document = {
    ...baseDocument,
    pageCount: pages.length,
    chunks,
    status: 'ready',
    error: null
  };

  documents.unshift(document);

  return {
    documentId: document.documentId,
    filename: document.filename,
    pageCount: document.pageCount,
    chunkCount: document.chunks.length,
    uploadedAt: document.uploadedAt
    ,status: document.status,
    error: document.error
  };
}

export async function answerQuestion({ question, documentId }) {
  const queryText = normalizeText(question);
  const documentsToSearch = documentId
    ? documents.filter((document) => document.documentId === documentId)
    : documents;

  if (!documentsToSearch.length) {
    return {
      answer: 'Upload a PDF document before asking questions.',
      citations: [],
      confidence: 0,
      sources: []
    };
  }

  const queryEmbedding = buildEmbedding(queryText);
  const candidates = documentsToSearch.flatMap((document) =>
    document.chunks.map((chunk) => ({
      ...chunk,
      documentId: document.documentId,
      filename: document.filename,
      pageRange: `${chunk.pageStart}-${chunk.pageEnd}`,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
  );

  const matches = topMatches(candidates, 5);

  if (!matches.length) {
    return {
      answer: 'Information not found in the uploaded document.',
      citations: [],
      confidence: 0,
      sources: []
    };
  }

  const context = matches
    .map((match, index) => `[Source ${index + 1} | ${match.filename} | pages ${match.pageRange}] ${match.text}`)
    .join('\n\n');

  const answer = await generateGrokAnswer({ question: queryText, context });

  return {
    answer,
    confidence: Number(matches[0].similarity.toFixed(3)),
    citations: matches.map((match, index) => ({
      label: `Source ${index + 1}`,
      filename: match.filename,
      pageRange: match.pageRange,
      similarity: Number(match.similarity.toFixed(3))
    })),
    sources: matches.map((match) => ({
      chunkId: match.chunkId,
      filename: match.filename,
      pageRange: match.pageRange,
      preview: match.text.slice(0, 220)
    }))
  };
}

function sanitizeName(filename = 'document') {
  return path
    .basename(filename)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';
}