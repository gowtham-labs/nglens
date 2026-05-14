// src/types/overlay.ts

import type { Severity } from './analyzer';

export interface OverlayConfig {
  elementSelector: string;
  severity: Severity;
  componentName: string;
  issueType: string;
  autoFadeTimeout: number; // 5000ms
  zIndex: number; // 2147483647
}
