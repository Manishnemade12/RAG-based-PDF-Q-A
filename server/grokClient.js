const defaultBaseUrl = 'https://api.x.ai/v1';

export async function generateGrokAnswer({ question, context }) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const baseUrl = process.env.GROK_API_BASE_URL || defaultBaseUrl;
  const model = process.env.GROK_CHAT_MODEL || 'grok-4.3';

  if (!apiKey) {
    return localFallbackAnswer(question, context, 'missing_api_key');
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
      const errorText = await response.text();
      return localFallbackAnswer(question, context, `xai_${response.status}`, errorText);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    return message
      ? { answer: message, source: 'xai', error: null }
      : localFallbackAnswer(question, context, 'empty_response');
  } catch (_error) {
    return localFallbackAnswer(question, context, 'network_error');
  }
}

function localFallbackAnswer(question, context, reason, details = '') {
  const sentences = context
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (!sentences.length) {
    return {
      answer: 'Information not found in the uploaded document.',
      source: 'fallback',
      error: reason
    };
  }

  const prefixByReason = {
    missing_api_key: 'xAI key is missing, so this is a local context-based response.',
    empty_response: 'xAI returned an empty response, so this is a local context-based response.',
    network_error: 'xAI could not be reached, so this is a local context-based response.'
  };

  const apiMessage = reason && reason.startsWith('xai_')
    ? `xAI returned ${reason.replace('xai_', '')}${details ? `: ${details}` : ''}.`
    : prefixByReason[reason] || 'This is a local context-based response.';

  return {
    answer: `${apiMessage} Question: ${question}. Relevant context: ${sentences.join(' ')}`,
    source: 'fallback',
    error: reason
  };
}