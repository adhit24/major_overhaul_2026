'use client';

import { useEffect, useRef } from 'react';
import { logout } from '@/app/(app)/actions';

const IDLE_MS = 30 * 60 * 1000; // 30 menit

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export function IdleLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await logout();
      }, IDLE_MS);
    };

    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  return null;
}
