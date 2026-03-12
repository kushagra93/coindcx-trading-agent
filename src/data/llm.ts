import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('llm');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.5';
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const body = {
    model: getModel(),
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  };

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://coindcx.com',
      'X-Title': 'CoinDCX Trading Agent',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    log.error({ status: response.status, body: text }, 'OpenRouter API error');
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    log.warn({ data }, 'Empty LLM response');
    return '';
  }

  return content;
}

export function isLLMAvailable(): boolean {
  return !!getApiKey();
}
