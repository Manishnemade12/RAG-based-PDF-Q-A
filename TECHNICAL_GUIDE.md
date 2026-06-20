# AI Study Assistant - Technical Guide

## 1. Project Summary

AI Study Assistant is a JavaScript-based PDF question answering system built with a Retrieval-Augmented Generation (RAG) pipeline.

Users can:

- upload a PDF
- extract and clean text
- chunk the text into searchable sections
- generate embeddings for semantic retrieval
- ask natural language questions
- receive grounded answers from xAI Grok when the account has API access

If Grok is unavailable, the app falls back to a local context-based answer so the UI still works for demo purposes.

## 2. Tech Stack

### Frontend

- React 18
- Vite
- plain CSS
- Fetch API for backend calls

### Backend

- Node.js
- Express
- Multer for file upload handling
- pdf-parse for PDF text extraction
- dotenv for environment variables
- morgan for HTTP logging
- cors for cross-origin requests

### AI / Retrieval

- xAI Grok chat completions API
- local hashed vector embeddings
- cosine similarity for retrieval

## 3. Repository Layout

```text
.
├─ index.html
├─ package.json
├─ README.md
├─ TECHNICAL_GUIDE.md
├─ .env
├─ .env.example
├─ server/
│  ├─ index.js
│  ├─ pipeline.js
│  ├─ grokClient.js
│  └─ vector.js
└─ src/
   ├─ main.jsx
   ├─ App.jsx
   └─ styles.css
```

## 4. How the App Works

### 4.1 Upload Flow

1. The user selects a PDF in the React UI.
2. The browser sends the file as `multipart/form-data` to `POST /api/documents`.
3. The backend stores the file in memory using Multer.
4. `pdf-parse` extracts raw text.
5. The server cleans and chunks the text.
6. Each chunk gets a lightweight embedding vector.
7. The document is stored in an in-memory array.
8. The frontend refreshes the document list and selects the new document.

### 4.2 Question Answering Flow

1. The user enters a question in the React UI.
2. The browser sends it to `POST /api/chat`.
3. The backend builds an embedding for the question.
4. It compares the question vector to all stored chunk vectors.
5. The top matching chunks become the retrieval context.
6. The server sends the context plus the question to xAI Grok.
7. If Grok is unavailable, the server returns a local fallback response.

## 5. Backend Modules

### 5.1 `server/index.js`

This file is the Express entrypoint.

Responsibilities:

- loads environment variables
- configures CORS, JSON parsing, logging, and file upload handling
- exposes health, document, and chat routes
- serves the built frontend in production

Important routes:

- `GET /api/health`
- `GET /api/documents`
- `POST /api/documents`
- `POST /api/chat`

### 5.2 `server/pipeline.js`

This is the core RAG orchestration layer.

Responsibilities:

- extracts text from PDFs
- creates chunks with overlap
- builds embeddings for each chunk
- stores uploaded documents in memory
- retrieves top chunks for a question
- sends context to the Grok client

Document state includes:

- `documentId`
- `filename`
- `uploadedAt`
- `pageCount`
- `chunks`
- `status`
- `error`

Current document statuses:

- `processing`
- `ready`
- `needs_text`

### 5.3 `server/vector.js`

This file contains the retrieval math and text helpers.

Functions:

- `normalizeText()` cleans whitespace and null bytes
- `buildChunks()` creates overlapping chunks from page text
- `buildEmbedding()` creates a hashed semantic vector
- `cosineSimilarity()` compares vectors
- `topMatches()` sorts and slices the best retrieval results

### 5.4 `server/grokClient.js`

This file handles the xAI request.

Responsibilities:

- reads `XAI_API_KEY`
- reads `GROK_API_BASE_URL`
- reads `GROK_CHAT_MODEL`
- calls the `/chat/completions` endpoint
- returns structured fallback output when the API fails

Current default model:

- `grok-4.3`

Observed xAI failure modes handled by the app:

- missing API key
- invalid model name
- permission denied / no credits
- empty model response
- network failure

## 6. Frontend Modules

### 6.1 `src/App.jsx`

This is the single-page UI.

Responsibilities:

- loads the uploaded document list on mount
- lets the user upload a PDF
- lets the user select a document
- sends question requests to the backend
- shows answer, citations, and retrieved context
- displays upload and answer status

State held in React:

- `documents`
- `selectedDocumentId`
- `uploadFile`
- `question`
- `answer`
- `citations`
- `sources`
- `confidence`
- `stats`
- `loadingUpload`
- `loadingAnswer`
- `statusMessage`

### 6.2 `src/main.jsx`

Bootstraps React into `#root`.

### 6.3 `src/styles.css`

Contains the full visual design for the app.

## 7. PDF Extraction Approach

The project does not use OCR right now.

It uses `pdf-parse`, which is an external library for text extraction from text-based PDFs.

What this means:

- works well for PDFs that already contain selectable text
- fails or performs poorly on scanned/image-only PDFs
- may fail on malformed PDFs or broken xref tables

### Important distinction

This is not our own OCR logic.

We currently have:

- PDF text extraction via `pdf-parse`
- no OCR pipeline

If OCR is needed later, the likely options are:

- Tesseract.js for local OCR
- a cloud OCR API
- a hybrid fallback that uses OCR only when `pdf-parse` cannot extract text

## 8. Embedding and Retrieval Design

The app uses a lightweight local embedding approach, not a hosted vector database.

### Why this was chosen

- simple to implement
- no external DB required
- enough for a demo and interview project

### How it works

- the chunk text is tokenized
- each token is hashed into a fixed-size vector
- the vector is normalized
- the question is embedded the same way
- cosine similarity ranks the chunks

### Tradeoff

This is not a production-grade embedding model.

It is good for demonstrating the RAG pipeline, but a real product would usually use:

- OpenAI embeddings
- xAI embeddings if available
- a vector database such as Pinecone, Weaviate, Chroma, or pgvector

## 9. Prompting Strategy

The Grok prompt uses a strict grounded-answer format.

Rules:

- answer only from provided context
- do not hallucinate
- if the answer is missing, return a fallback message

This is important for reducing unsupported answers in a document Q&A system.

## 10. Environment Variables

Current `.env` keys:

```env
XAI_API_KEY=
GROK_API_BASE_URL=https://api.x.ai/v1
GROK_CHAT_MODEL=grok-4.3
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
MAX_CHUNK_WORDS=800
CHUNK_OVERLAP_WORDS=150
```

### What each one does

- `XAI_API_KEY`: xAI auth token
- `GROK_API_BASE_URL`: xAI API root URL
- `GROK_CHAT_MODEL`: model name sent to Grok
- `PORT`: backend port
- `CLIENT_ORIGIN`: allowed browser origin for CORS
- `MAX_CHUNK_WORDS`: chunk size during ingestion
- `CHUNK_OVERLAP_WORDS`: overlap between chunks

## 11. Development Commands

Run both frontend and backend:

```bash
npm run dev
```

Run only backend:

```bash
npm run dev:server
```

Run only frontend:

```bash
npm run dev:client
```

Build frontend for production:

```bash
npm run build
```

## 12. Current Limitations

### 12.1 In-memory storage

Uploaded documents are stored only in memory.

Impact:

- restarting the server clears all documents
- no persistence across sessions

### 12.2 No OCR

Scanned PDFs are not fully supported.

### 12.3 Local embeddings are approximate

The retrieval layer is functional but not production-grade.

### 12.4 xAI account access is required

The app can call xAI only if the account has credits and the model is accessible.

## 13. Interview Talking Points

If asked to explain the project, say:

1. It is a RAG-based PDF Q&A assistant built in JavaScript.
2. The backend extracts text, chunks it, embeds it, retrieves relevant context, and sends that context to Grok.
3. The frontend is a React app that uploads PDFs and asks questions.
4. The system uses `pdf-parse` for extraction and cosine similarity for retrieval.
5. There is no OCR yet, so scanned PDFs need a future OCR layer.
6. The app supports local fallback answers if xAI is unavailable.

## 14. Best Short Explanation for Interviews

AI Study Assistant is a JavaScript RAG application that turns PDFs into searchable chunks, retrieves the most relevant context for a question, and uses Grok to generate grounded answers.

## 15. Practical Weak Spots to Mention Honestly

- the vector logic is simple and local
- documents are not persisted
- OCR is not implemented
- xAI access depends on account credits and model availability

Being honest about these constraints is better than overstating the system.