// src/types/scoring.ts

import type { RuntimeMode } from './analyzer';

export interface PerformanceSubScore {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1, all weights sum to 1
  details: string;
}

export interface PerformanceScore {
  overall: number; // 0-100 weighted sum
  subScores: {
    changeDetection: PerformanceSubScore; // weight: 0.4
    componentTreeDepth: PerformanceSubScore; // weight: 0.2
    templateComplexity: PerformanceSubScore; // weight: 0.2
    detectedBottlenecks: PerformanceSubScore; // weight: 0.2
  };
  timestamp: number;
  mode: RuntimeMode;
}
