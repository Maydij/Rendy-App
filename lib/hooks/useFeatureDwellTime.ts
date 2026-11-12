'use client';

import { useEffect, useRef } from 'react';
import {
  trackProductEvent,
  type TrackingEventPayload,
} from '@/lib/analytics/tracking-plan';

type FeatureKey = TrackingEventPayload<'feature_dwell_heartbeat'>['feature_key'];
type UserRole = TrackingEventPayload<'feature_dwell_heartbeat'>['user_role'];

const HEARTBEAT_INTERVAL_MS = 15_000; // 15 seconds active pulse
const IDLE_THRESHOLD_MS = 45_000; // Pause clock after 45s without mouse/keyboard/scroll

/**
 * @name useFeatureDwellTime
 * @description [Business Logic]: Measures authentic active user engagement per product module
 * using the Page Visibility API and user interaction listeners. Automatically pauses tracking
 * when the browser tab is hidden or idle so product adoption metrics reflect true usage.
 */
export function useFeatureDwellTime(featureKey: FeatureKey, userRole: UserRole): void {
  const lastActivityRef = useRef<number>(Date.now());
  const accumulatedSecondsRef = useRef<number>(0);

  useEffect(() => {
    const markUserActive = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', markUserActive, { passive: true });
    window.addEventListener('keydown', markUserActive, { passive: true });
    window.addEventListener('scroll', markUserActive, { passive: true });
    window.addEventListener('click', markUserActive, { passive: true });

    const tickInterval = setInterval(() => {
      const isTabVisible = document.visibilityState === 'visible';
      const isRecentlyActive = Date.now() - lastActivityRef.current < IDLE_THRESHOLD_MS;

      if (isTabVisible && isRecentlyActive) {
        accumulatedSecondsRef.current += 1;
      }

      if (accumulatedSecondsRef.current >= 15) {
        const delta = accumulatedSecondsRef.current;
        accumulatedSecondsRef.current = 0;

        void trackProductEvent('feature_dwell_heartbeat', {
          feature_key: featureKey,
          active_seconds_delta: delta,
          user_role: userRole,
        });
      }
    }, 1000);

    return () => {
      clearInterval(tickInterval);
      window.removeEventListener('mousemove', markUserActive);
      window.removeEventListener('keydown', markUserActive);
      window.removeEventListener('scroll', markUserActive);
      window.removeEventListener('click', markUserActive);

      if (accumulatedSecondsRef.current >= 3) {
        void trackProductEvent('feature_dwell_heartbeat', {
          feature_key: featureKey,
          active_seconds_delta: Math.min(60, accumulatedSecondsRef.current),
          user_role: userRole,
        });
      }
    };
  }, [featureKey, userRole]);
}