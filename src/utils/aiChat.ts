export interface AIConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  provider: 'openai' | 'anthropic';
}

export async function callAI(config: AIConfig, messages: { role: string; content: string }[], options?: {
  maxTokens?: number; temperature?: number;
}): Promise<string> {
  const { apiKey, apiUrl, model, provider } = config;
  const maxTokens = options?.maxTokens ?? 1000;
  const temperature = options?.temperature ?? 0.7;

  if (provider === 'anthropic') {
    // Anthropic Messages API format
    // Strip system messages and prepend as system prompt
    const systemMsg = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const body: Record<string, any> = {
      model,
      messages: chatMessages,
      max_tokens: maxTokens,
    };
    if (systemMsg) body.system = systemMsg;

    const endpoint = apiUrl || 'https://api.anthropic.com/v1/messages';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text ?? '无返回结果';
  }

  // OpenAI-compatible format (default)
  const endpoint = apiUrl || 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? '无返回结果';
}
