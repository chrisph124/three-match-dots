import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Motion" accessibility setting.
 *
 * Seeded from `AccessibilityInfo.isReduceMotionEnabled()` on mount, then kept
 * live via the `reduceMotionChanged` event so a mid-session toggle takes effect
 * without a reload. The whole visual-upgrade effort consumes this one hook
 * (bible §4); Phase 1 uses it to skip the chain-merge animation.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
