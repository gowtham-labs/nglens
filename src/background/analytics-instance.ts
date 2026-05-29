/**
 * Shared AnalyticsService instance for the background service worker.
 * Extracted to its own module to avoid circular dependencies between
 * background.ts and message-router.ts.
 */

import { AnalyticsService } from '../services/analytics-service';

export const analyticsService = new AnalyticsService();
