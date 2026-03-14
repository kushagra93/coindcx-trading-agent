import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('prompt-guard');

export interface GuardResult {
  safe: boolean;
  sanitized: string;
  flags: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; flag: string; severity: 'low' | 'medium' | 'high' }> = [
  // Direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)/i, flag: 'instruction_override', severity: 'high' },
  { pattern: /forget\s+(all\s+)?(your|previous|above)\s+(previous\s+)?(instructions?|rules?|context)/i, flag: 'instruction_override', severity: 'high' },
  { pattern: /forget\s+(everything|all)\s+(you\s+)?(know|were\s+told)/i, flag: 'instruction_override', severity: 'high' },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?)/i, flag: 'instruction_override', severity: 'high' },
  { pattern: /override\s+(system|safety|your)\s+(prompt|instructions?|rules?)/i, flag: 'instruction_override', severity: 'high' },

  // Role hijacking
  { pattern: /you\s+are\s+now\s+(a|an|the)\s/i, flag: 'role_hijack', severity: 'high' },
  { pattern: /act\s+as\s+(if\s+you\s+are\s+)?(a|an|the)\s(?!trader|agent)/i, flag: 'role_hijack', severity: 'medium' },
  { pattern: /pretend\s+(to\s+be|you\s+are)\s/i, flag: 'role_hijack', severity: 'high' },
  { pattern: /switch\s+to\s+(a\s+)?(new|different)\s+(mode|persona|role)/i, flag: 'role_hijack', severity: 'high' },
  { pattern: /enter\s+(developer|admin|god|debug|DAN)\s+mode/i, flag: 'role_hijack', severity: 'high' },

  // System prompt extraction
  { pattern: /(?:show|reveal|print|output|display|repeat|give)\s+(?:me\s+)?(?:your|the|system)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i, flag: 'prompt_extraction', severity: 'medium' },
  { pattern: /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:instructions?|prompt|rules?|directives?)/i, flag: 'prompt_extraction', severity: 'medium' },

  // Delimiter injection (trying to break out of user context)
  { pattern: /```\s*system\s*\n/i, flag: 'delimiter_injection', severity: 'high' },
  { pattern: /\[SYSTEM\]/i, flag: 'delimiter_injection', severity: 'high' },
  { pattern: /<\/?system>/i, flag: 'delimiter_injection', severity: 'high' },
  { pattern: /\bEND_USER_INPUT\b/i, flag: 'delimiter_injection', severity: 'high' },
  { pattern: /\bBEGIN_SYSTEM\b/i, flag: 'delimiter_injection', severity: 'high' },

  // Encoded/obfuscated injection attempts
  { pattern: /base64[:\s]|eval\s*\(|exec\s*\(/i, flag: 'code_injection', severity: 'high' },

  // Social engineering for unrestricted behavior
  { pattern: /(?:no|without)\s+(?:restrictions?|limits?|filters?|guardrails?|safety)/i, flag: 'safety_bypass', severity: 'medium' },
  { pattern: /(?:jailbreak|uncensored|unfiltered|unrestricted)\s+mode/i, flag: 'safety_bypass', severity: 'high' },
];

const MAX_MESSAGE_LENGTH = 2000;

export function guardInput(rawMessage: string): GuardResult {
  const flags: string[] = [];
  let maxSeverity: GuardResult['severity'] = 'none';

  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    flags.push('message_too_long');
    maxSeverity = 'medium';
  }

  const severityOrder = { none: 0, low: 1, medium: 2, high: 3 };

  for (const { pattern, flag, severity } of INJECTION_PATTERNS) {
    if (pattern.test(rawMessage)) {
      flags.push(flag);
      if (severityOrder[severity] > severityOrder[maxSeverity]) {
        maxSeverity = severity;
      }
    }
  }

  const safe = maxSeverity !== 'high';
  const sanitized = rawMessage.slice(0, MAX_MESSAGE_LENGTH);

  if (flags.length > 0) {
    log.warn({ flags, severity: maxSeverity, messagePreview: rawMessage.slice(0, 100) }, 'Prompt injection attempt detected');
  }

  return { safe, sanitized, flags, severity: maxSeverity };
}

export function getInjectionWarning(flags: string[]): string {
  if (flags.includes('instruction_override') || flags.includes('role_hijack') || flags.includes('delimiter_injection')) {
    return "I can't process that request — it looks like an attempt to override my instructions. I'm here to help with trading, screening tokens, and portfolio management. How can I help?";
  }
  if (flags.includes('prompt_extraction')) {
    return "I can't share my system configuration, but I'm happy to tell you what I can do! Try **help** for the full command guide.";
  }
  if (flags.includes('safety_bypass')) {
    return "I always operate with safety guardrails — that's what keeps your portfolio protected. What would you like to trade or screen?";
  }
  return "I couldn't process that. Try something like **trending**, **screen SOL**, or **buy SOL $200**.";
}
