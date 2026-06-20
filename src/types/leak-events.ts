// src/types/leak-events.ts

import type { SeverityLevel } from './panel';

export interface LeakEvent {
  id: string;
  componentName: string;
  componentId: string;
  leakType: 'subscription' | 'timer' | 'event-listener';
  severity: SeverityLevel;
  source: string;
  createdAt: number;
  detectedAt: number;
  lifecycleState: 'destroyed';
}

export interface ComponentLifecycle {
  componentId: string;
  componentName: string;
  createdAt: number;
  destroyedAt: number | null;
  subscriptions: SubscriptionRecord[];
  timers: TimerRecord[];
  /** Reference to the host element, used for component instance retrieval on destroy */
  hostElement?: HTMLElement;
}

export interface SubscriptionRecord {
  id: string;
  source: string;
  createdAt: number;
  cleaned: boolean;
  cleanedAt: number | null;
}

export interface TimerRecord {
  id: string;
  type: 'interval' | 'timeout';
  createdAt: number;
  cleared: boolean;
}
