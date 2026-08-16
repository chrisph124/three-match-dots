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
};

export type GameState = {
  readonly config: GameConfig;
  readonly board: Board;
  readonly score: number;
  readonly rngState: number;
};
