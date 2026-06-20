import { useEffect, useMemo, useState } from 'react';

const initialStats = {
  documents: 0,
  pages: 0,
  chunks: 0
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [question, setQuestion] = useState('Explain the most important idea in simple terms.');
  const [answer, setAnswer] = useState('Upload a PDF and ask a question to begin.');
  const [citations, setCitations] = useState([]);
  const [sources, setSources] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [stats, setStats] = useState(initialStats);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');

  useEffect(() => {
    void loadDocuments();
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.documentId === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  async function loadDocuments() {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      const nextDocuments = data.documents || [];

      setDocuments(nextDocuments);
      if (!selectedDocumentId && nextDocuments.length > 0) {
        setSelectedDocumentId(nextDocuments[0].documentId);
      }

      setStats({
        documents: nextDocuments.length,
        pages: nextDocuments.reduce((sum, document) => sum + (document.pageCount || 0), 0),
        chunks: nextDocuments.reduce((sum, document) => sum + (document.chunkCount || 0), 0)
      });
    } catch (_error) {
      setStatusMessage('Unable to load documents.');
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!uploadFile) {
      setStatusMessage('Choose a PDF first.');
      return;
    }

    setLoadingUpload(true);
    setStatusMessage('Processing PDF...');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setUploadFile(null);
      await loadDocuments();
      setSelectedDocumentId(data.document.documentId);
      setStatusMessage(
        data.warning
          ? `Uploaded ${data.document.filename}, but text extraction was limited: ${data.warning}`
          : `Uploaded ${data.document.filename} and indexed ${data.document.chunkCount} chunks.`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setLoadingUpload(false);
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();

    if (!question.trim()) {
      setStatusMessage('Ask a question first.');
      return;
    }

    setLoadingAnswer(true);
    setStatusMessage('Searching the document...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          documentId: selectedDocumentId || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Question failed.');
      }

      setAnswer(data.answer);
      setCitations(data.citations || []);
      setSources(data.sources || []);
      setConfidence(data.confidence || 0);
      setStatusMessage('Answer ready.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Question failed.');
    } finally {
      setLoadingAnswer(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI Study Assistant</p>
          <h1>Ask grounded questions about any PDF.</h1>
          <p className="lead">
            Upload a document, index its pages into vector chunks, and query it with a Grok-backed answer layer.
          </p>

          <div className="stats">
            <Stat label="Documents" value={stats.documents} />
            <Stat label="Pages" value={stats.pages} />
            <Stat label="Chunks" value={stats.chunks} />
          </div>
        </div>

        <div className="status-card">
          <span className="status-pill">{statusMessage}</span>
          <div className="status-grid">
            <div>
              <p className="status-label">Selected document</p>
              <strong>{selectedDocument?.filename || 'None yet'}</strong>
            </div>
            <div>
              <p className="status-label">Confidence</p>
              <strong>{Math.round(confidence * 100)}%</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>1. Upload PDF</h2>
            <p>Accepted input is a text-extractable PDF up to 20 MB.</p>
          </div>

          <form className="form" onSubmit={handleUpload}>
            <label className="file-input">
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <span>{uploadFile ? uploadFile.name : 'Choose a PDF file'}</span>
            </label>

            <button type="submit" disabled={loadingUpload}>
              {loadingUpload ? 'Indexing...' : 'Upload and index'}
            </button>
          </form>

          <div className="document-list">
            {documents.length === 0 ? (
              <p className="muted">No documents indexed yet.</p>
            ) : (
              documents.map((document) => (
                <button
                  key={document.documentId}
                  className={`document-card ${document.documentId === selectedDocumentId ? 'active' : ''}`}
                  onClick={() => setSelectedDocumentId(document.documentId)}
                  type="button"
                >
                  <strong>{document.filename}</strong>
                  <span>
                    {document.pageCount} pages · {document.chunkCount} chunks
                    {document.status && document.status !== 'ready' ? ` · ${document.status}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>2. Ask a question</h2>
            <p>Retrieval uses cosine similarity over chunk embeddings and passes the top matches to Grok.</p>
          </div>

          <form className="form" onSubmit={handleAskQuestion}>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} />
            <button type="submit" disabled={loadingAnswer}>
              {loadingAnswer ? 'Thinking...' : 'Get answer'}
            </button>
          </form>

          <div className="answer-card">
            <div className="answer-head">
              <h3>Answer</h3>
              <span>{Math.round(confidence * 100)}% relevance</span>
            </div>
            <p>{answer}</p>
          </div>

          <div className="source-list">
            {citations.length > 0 && (
              <div>
                <h3>Citations</h3>
                <div className="chips">
                  {citations.map((citation) => (
                    <span className="chip" key={`${citation.label}-${citation.pageRange}`}>
                      {citation.filename} · pages {citation.pageRange}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {sources.length > 0 && (
              <div>
                <h3>Retrieved context</h3>
                <div className="source-cards">
                  {sources.map((source) => (
                    <article className="source-card" key={source.chunkId}>
                      <p className="source-meta">
                        {source.filename} · pages {source.pageRange}
                      </p>
                      <p>{source.preview}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}