# AI Study Assistant

AI Study Assistant is a JavaScript-based RAG demo for PDF question answering. It accepts PDF uploads, extracts and chunks the text, builds local embeddings for semantic retrieval, and sends the best matches to Grok for grounded answer generation.

## What is included

- Express API for PDF upload, document listing, and question answering
- In-memory document store for uploaded PDFs
- PDF text extraction, cleaning, chunking, and cosine-similarity retrieval
- Grok chat completion integration with a local fallback when `XAI_API_KEY` is missing
- React + Vite frontend for uploading PDFs and asking questions

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Grok key to `.env`:

   ```env
   XAI_API_KEY=your_key_here
   ```

3. Start the app in development mode:

   ```bash
   npm run dev
   ```

4. Open the frontend at `http://localhost:5173`.

## API flow

1. Upload a PDF.
2. The server extracts text page by page.
3. Text is cleaned and chunked with overlap.
4. Each chunk is converted into a hashed embedding vector.
5. User questions are embedded and matched with cosine similarity.
6. The best chunks are passed to Grok for a grounded response.

## Environment variables

- `XAI_API_KEY` - your Grok/XAI API key
- `GROK_API_KEY` - legacy fallback name supported by the app
- `GROK_API_BASE_URL` - Grok-compatible API base URL
- `GROK_CHAT_MODEL` - chat model name
- `PORT` - backend port
- `CLIENT_ORIGIN` - allowed browser origin
- `MAX_CHUNK_WORDS` - chunk size for ingestion
- `CHUNK_OVERLAP_WORDS` - overlap between adjacent chunks

## Notes

- The backend currently keeps uploaded documents in memory. Restarting the server clears the index.
- If `XAI_API_KEY` is not set, the server returns a local context-based fallback answer so the app still works for demos.