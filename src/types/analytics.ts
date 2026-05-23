// src/types/analytics.ts — Analytics tracking types for GA4 Measurement Protocol

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number>;
}

export interface MeasurementProtocolPayload {
  client_id: string;
  events: AnalyticsEvent[];
}

export type ConsentStatus = 'granted' | 'denied' | undefined;

export interface ConsentState {
  analytics_consent: ConsentStatus;
}

export interface AnalyticsConsentPayload {
  consent: 'granted' | 'denied';
}

export interface AnalyticsTrackEventPayload {
  eventName: string;
  params?: Record<string, string | number>;
}
