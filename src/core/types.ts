/** A dot colour, expressed as an index into the palette: 0..colors-1. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- Semantic type to distinguish palette indices from cell positions, preventing misuse at call sites.
export type Color = number;

/** A board position flattened to a single number: row * cols + col. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- Semantic type to distinguish board coordinates from color indices, preventing accidental parameter swaps.
export type CellIndex = number;

/** Flat, row-major board of colours. EMPTY marks a hole. */
export type Board = readonly Color[];

/** An ordered run of linked cells. A sealed chain repeats its 5th-from-last entry. */
export type Chain = readonly CellIndex[];

export const EMPTY: Color = -1;

export type ChainKind = 'plain' | 'square-loop' | 'line';

export type AppendVerdict = 'append' | 'undo' | 'reject' | 'close-square';

export type ClearReason = 'chain' | 'color-sweep';

export type ClearedCell = {
  readonly index: CellIndex;
  readonly color: Color;
  readonly reason: ClearReason;
};

/**
 * A dot moving from one cell to another. A gravity fall and a shuffle slide
 * are the same thing to the render layer, so they share one type.
 */
export type CellMove = {
  readonly from: CellIndex;
  readonly to: CellIndex;
};

// eslint-disable-next-line sonarjs/redundant-type-aliases -- Distinct semantic context (gravity/shuffle animations) from generic CellMove; clarifies intent for render and effect layers.
export type FallMove = CellMove;

export type Spawn = {
  readonly to: CellIndex;
  readonly color: Color;
  /** Cell-heights above the board the dot starts at, so it can fall in. */
  readonly heightAbove: number;
};

export type GameConfig = {
  readonly rows: number;
  readonly cols: number;
  readonly colors: number;
  /** Shortest chain that clears on release. */
  readonly minChain: number;
  /** Shortest straight run that sweeps the colour board-wide. */
  readonly lineLength: number;
  readonly baseScore: number;
  readonly sweepMultiplier: number;
  /**
   * Combo-heat dials. All optional and OFF by default so `DEFAULT_CONFIG` and
   * every Journey config stay byte-identical; only `ENDLESS_CONFIG` turns them on.
   */
  /** Max heat tier. 0 (or undefined) disables heat — the multiplier is always 1. */
  readonly heatCap?: number;
  /** Multiplier gained per heat tier: factor = 1 + heat * heatStep. 0/undefined ⇒ no boost. */
  readonly heatStep?: number;
  /**
   * How strongly a colour-sweep's OWN refill wave avoids the swept colour:
   * 0 (or undefined) = off, byte-identical refill; 1 = full ban (zero swept-colour
   * dots that wave); 0<w<1 = down-weight the swept colour's spawn probability.
   * A weighted dial (not a boolean) so the sim can tune it below a full ban.
   */
  readonly sweepExclusionWeight?: number;
};

export type Resolution = {
  readonly kind: ChainKind;
  readonly color: Color;
  readonly cleared: readonly ClearedCell[];
  readonly falls: readonly FallMove[];
  readonly spawns: readonly Spawn[];
  readonly scoreDelta: number;
  readonly board: Board;
  readonly rngState: number;
  /**
   * Resulting heat tier after this commit (optional ⇒ read as 0). Present when
   * a heat-enabled config resolved the chain; absent/0 leaves the meta layer inert.
   */
  readonly heat?: number;
  /** True when this commit AND the previous one were both sweeps (optional ⇒ false). */
  readonly doubleSweep?: boolean;
  /**
   * Collected cells that were shielded from removal by `resolveChain`'s
   * protected-cells param — same `ClearedCell` shape and row-major/drag order as
   * `cleared`, so the render layer can stagger a chip animation identically to a
   * pop. Absent (like `heat`) whenever no protected cell was actually hit, keeping
   * the byte-identical shape for every default 2-arg caller. Mechanic-agnostic:
   * the core never learns why a cell is protected (see resolve-chain.ts).
   */
  readonly protectedHits?: readonly ClearedCell[];
  /**
   * Extra cells that a caller's `expandCleared` seam emptied on top of `cleared`
   * — removed in the SAME resolution but never part of the chain/sweep and never
   * scored. Plain indices (the render layer pairs its own effect to them). Absent
   * when empty ⇒ byte-identical shape for every default caller (mirrors
   * `protectedHits`). Mechanic-agnostic: the core never learns what these were.
   */
  readonly expandedCleared?: readonly CellIndex[];
};

export type GameState = {
  readonly config: GameConfig;
  readonly board: Board;
  readonly score: number;
  readonly rngState: number;
  /**
   * Carried combo-heat. Both optional so existing state literals (tests,
   * `journey-state.ts`) stay valid; read via `?? 0` / `?? null`.
   */
  /** Current heat tier, 0..heatCap (undefined ⇒ treated as 0). */
  readonly heat?: number;
  /** Kind of the previous committed chain (undefined/null at newGame). */
  readonly lastKind?: ChainKind | null;
};
