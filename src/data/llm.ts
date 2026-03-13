import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('llm');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

function getIntentModel(): string {
  return process.env.OPENROUTER_INTENT_MODEL || 'google/gemini-2.5-flash';
}

function getResponseModel(): string {
  return process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.5';
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

async function callOpenRouter(
  model: string,
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number; tools?: ToolFunction[] },
): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const body: Record<string, any> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  };

  if (options?.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
  }

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

  return await response.json();
}

export async function chatCompletion(
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const data = await callOpenRouter(getResponseModel(), messages, options) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    log.warn({ data }, 'Empty LLM response');
    return '';
  }
  return content;
}

export async function functionCall(
  messages: LLMMessage[],
  tools: ToolFunction[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ toolCalls: ToolCall[]; content: string | null }> {
  const data = await callOpenRouter(getIntentModel(), messages, {
    temperature: options?.temperature ?? 0.1,
    maxTokens: options?.maxTokens ?? 512,
    tools,
  }) as any;

  const message = data.choices?.[0]?.message;
  return {
    toolCalls: message?.tool_calls ?? [],
    content: message?.content ?? null,
  };
}

export function isLLMAvailable(): boolean {
  return !!getApiKey();
}
