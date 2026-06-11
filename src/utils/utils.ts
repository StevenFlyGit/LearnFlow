import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeBaseUrl(url: string | undefined | null, provider: 'openai' | 'deepseek' | 'anthropic'): string {
  if (!url) {
    return provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1';
  }
  
  let cleanUrl = url.trim().replace(/\/+$/, '');
  
  // Clean full endpoints if the user copy-pasted them
  cleanUrl = cleanUrl.replace(/\/chat\/completions$/, '');
  cleanUrl = cleanUrl.replace(/\/messages$/, '');
  cleanUrl = cleanUrl.replace(/\/chat$/, '');
  
  // Ensure standard endpoints have /v1 if missing
  if (cleanUrl.includes('api.anthropic.com') && !cleanUrl.endsWith('/v1')) {
    cleanUrl += '/v1';
  }
  if (cleanUrl.includes('api.openai.com') && !cleanUrl.endsWith('/v1')) {
    cleanUrl += '/v1';
  }
  
  return cleanUrl;
}

