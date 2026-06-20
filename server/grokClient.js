const defaultBaseUrl = 'https://api.x.ai/v1';

export async function generateGrokAnswer({ question, context }) {
  const apiKey = process.env.GROK_API_KEY;
  const baseUrl = process.env.GROK_API_BASE_URL || defaultBaseUrl;
  const model = process.env.GROK_CHAT_MODEL || 'grok-2-latest';

  if (!apiKey) {
    return localFallbackAnswer(question, context);
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [
              'You are a grounded study assistant.',
              'Answer only from the provided document context.',
              'If the answer is not present, reply exactly with: Information not found in the uploaded document.'
            ].join(' ')
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nDocument context:\n${context}`
          }
        ]
      })
    });

    if (!response.ok) {
      return localFallbackAnswer(question, context);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    return message || localFallbackAnswer(question, context);
  } catch (_error) {
    return localFallbackAnswer(question, context);
  }
}

function localFallbackAnswer(question, context) {
  const sentences = context
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (!sentences.length) {
    return 'Information not found in the uploaded document.';
  }

  return `Grok API key is not configured, so this is a local context-based response. Question: ${question}. Relevant context: ${sentences.join(' ')}`;
}