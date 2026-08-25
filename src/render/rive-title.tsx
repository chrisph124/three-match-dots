import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Rive from 'rive-react-native';
import { useReduceMotion } from '../effects/use-reduce-motion';

/**
 * Resolves the bundled Rive title animation, or `null` until real art lands.
 *
 * To ship the animated title: drop the authored file at `assets/rive/title.riv`
 * and return `require('../../assets/rive/title.riv')` here (Metro bundles it as a
 * numeric asset id — `.riv` is registered in `metro.config.js`). Until then this
 * returns `null` so <RiveTitle> renders its static `fallback`: no `require()` of
 * a missing asset (Metro would fail the bundle) and no invalid `.riv` handed to
 * the native runtime (which would otherwise hard-crash the title screen).
 */
function riveTitleSource(): number | null {
  return null;
}

type RiveTitleProps = {
  /** Static paper-craft lockup shown whenever the animation is unavailable. */
  fallback: ReactNode;
};

/**
 * Plays the animated title when a real `.riv` is bundled and motion is allowed;
 * otherwise shows the static Phase 5 lockup. Reduce Motion always gets the
 * static lockup, and any native Rive error (missing artboard, decode failure)
 * falls back to the same lockup via `onError` instead of the default RN error
 * screen. This is the "Rive for meta-UI micro-motion" layer from the creative
 * bible — the in-scene board stays Reanimated + Skia.
 */
export function RiveTitle({ fallback }: RiveTitleProps) {
  const reduceMotion = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const source = riveTitleSource();

  if (reduceMotion || source == null || failed) {
    return <>{fallback}</>;
  }

  return <Rive source={source} autoplay onError={() => setFailed(true)} style={styles.rive} />;
}

const styles = StyleSheet.create({
  // Placeholder footprint until real art lands. The art slice tunes height/aspect
  // to the authored file AND should match the static lockup's height so toggling
  // Reduce Motion (Rive <-> fallback) does not shift the layout.
  rive: { width: '100%', height: 150 },
});
