import { Injectable } from '@angular/core';

/**
 * Clipboard service that wraps the browser Clipboard API with fallback support.
 * Handles both modern navigator.clipboard API and legacy document.execCommand('copy').
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  /**
   * Copy text to the system clipboard.
   * Attempts the modern Clipboard API first, then falls back to execCommand('copy')
   * with a temporary textarea element for older browsers or non-HTTPS contexts.
   *
   * @param text - The text to copy to the clipboard
   * @returns true if the copy succeeded, false otherwise
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return this.fallbackCopy(text);
    }
  }

  /**
   * Fallback copy method using document.execCommand('copy') with a temporary textarea.
   * Used when the modern Clipboard API is unavailable or fails.
   *
   * @param text - The text to copy to the clipboard
   * @returns true if the copy succeeded, false otherwise
   */
  private fallbackCopy(text: string): boolean {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}
