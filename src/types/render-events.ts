// src/types/render-events.ts

export interface RenderEvent {
  componentName: string;
  timestamp: number;
  duration: number;
  causes: RenderCause[];
}

export interface RenderCause {
  type: 'signal' | 'input' | 'zone' | 'parent' | 'manual-cd';
  source?: string;
}

export interface EventBatch {
  events: RenderEvent[];
  batchTimestamp: number;
  sequenceNumber: number;
}
