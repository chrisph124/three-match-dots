import {
  Canvas,
  ColorMatrix,
  Group,
  LinearGradient,
  Paint,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { SceneParams, SilhouetteBand } from './biomes';

type BackdropProps = {
  readonly scene: SceneParams;
  readonly width: number;
  readonly height: number;
};

/** Deterministic ridge height at control point `i` — two summed sines seeded by
 *  the band phase, so a biome's skyline is stable per seed and never random. */
function ridgeY(i: number, band: SilhouetteBand, seed: number, height: number): number {
  const phase = seed * 0.017 + band.seedOffset * 0.31 + i * 1.7;
  const n = Math.sin(phase) * 0.62 + Math.sin(phase * 2.3 + 1.1) * 0.38;
  return (band.baseline + n * band.amplitude) * height;
}

/** Build a filled silhouette Path for one band: ridge across the top, closed to
 *  the bottom edge. Built once per size/scene (useMemo) — no per-frame alloc. */
function bandPath(band: SilhouetteBand, seed: number, width: number, height: number) {
  const path = Skia.Path.Make();
  const step = width / band.ridgePoints;
  path.moveTo(0, ridgeY(0, band, seed, height));
  for (let i = 1; i <= band.ridgePoints; i += 1) {
    path.lineTo(i * step, ridgeY(i, band, seed, height));
  }
  path.lineTo(width, height);
  path.lineTo(0, height);
  path.close();
  return path;
}

/** Saturation color matrix — `s` = 1 identity, 0 greyscale (boss scene-shift). */
function saturationMatrix(s: number): number[] {
  const r = 0.2126 * (1 - s);
  const g = 0.7152 * (1 - s);
  const b = 0.0722 * (1 - s);
  // prettier-ignore
  return [
    r + s, g,     b,     0, 0,
    r,     g + s, b,     0, 0,
    r,     g,     b + s, 0, 0,
    0,     0,     0,     1, 0,
  ];
}

/**
 * The full-screen diorama backdrop — a separate Canvas that sits BEHIND the
 * board Canvas (which is untouched, so gestures are unaffected). Draws the sky
 * gradient, layered biome silhouettes, and a vignette; a boss scene desaturates
 * the whole group. Static (no per-frame animation) so the two-Canvas split can't
 * regress frame rate.
 */
export function BackdropCanvas({ scene, width, height }: BackdropProps) {
  const paths = useMemo(
    () => scene.bands.map((band) => bandPath(band, scene.parallaxSeed, width, height)),
    [scene.bands, scene.parallaxSeed, width, height],
  );
  const matrix = useMemo(() => saturationMatrix(1 - scene.desaturate), [scene.desaturate]);
  const skyColors = useMemo(() => scene.sky.map((s) => s.color), [scene.sky]);
  const skyPositions = useMemo(() => scene.sky.map((s) => s.offset), [scene.sky]);

  const world = (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={skyColors}
          positions={skyPositions}
        />
      </Rect>
      {paths.map((path, i) => (
        <Path key={i} path={path} color={scene.bands[i].color} />
      ))}
    </Group>
  );

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
      {scene.desaturate > 0 ? (
        <Group
          layer={
            <Paint>
              <ColorMatrix matrix={matrix} />
            </Paint>
          }
        >
          {world}
        </Group>
      ) : (
        world
      )}
      {/* Vignette: a radial from a transparent centre to a dark edge, heavier on
          a boss so the scene closes in without any bespoke art. */}
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.max(width, height) * 0.72}
          colors={['#00000000', `rgba(6, 8, 14, ${scene.vignette})`]}
        />
      </Rect>
    </Canvas>
  );
}
