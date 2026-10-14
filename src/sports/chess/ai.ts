/* The computer player. It scores each legal move by searching ahead, then picks among the best few:
   a skilled player plays the top move, a weaker one sometimes settles for a slightly worse (but still
   sensible) move. Each stat steers one part of that:
   - Calculation: how far it looks (its own move only, or the opponent's reply too)
   - Tactics: whether it follows capture sequences to the end (so it sees trades and hanging pieces)
   - Opening / Endgame: how far below the best move it may settle, in the first 8 moves / the final 40%
   - Composure: how often it blunders outright in the last 60% of the game */

import { chance } from "../../util/math";
import { BISHOP, Board, type Color, KING, KNIGHT, type Move, PAWN, pieceColor, pieceType, QUEEN, rankOf, fileOf, ROOK, WHITE } from "./board";
import type { ChessStats } from "./stats";

/** Piece values in centipawns (100 = one pawn). */
export const PIECE_VALUES: Record<number, number> = { [PAWN]: 100, [KNIGHT]: 300, [BISHOP]: 320, [ROOK]: 500, [QUEEN]: 900, [KING]: 0 };
const MATE = 100000;
/** Captures followed this far at most, so a long exchange can't stall the game. */
const MAX_CAPTURE_DEPTH = 4;
const OPENING_PLIES = 16;

/** Pawn bonus per rank advanced before the endgame: center pawns forward, edge pawns stay home. */
const PAWN_ADVANCE_BY_FILE = [-4, -2, 5, 10, 10, 5, -3, -5];

/**
 * Bonuses for good squares, following basic chess principles: control the center with the d- and e-pawns,
 * develop knights and bishops off the back rank, keep the king tucked away until the endgame.
 */
function placement(type: number, square: number, color: Color, endgame: boolean): number {
  const file = fileOf(square), rank = color === WHITE ? rankOf(square) : 7 - rankOf(square);
  const centrality = 3.5 - Math.max(Math.abs(file - 3.5), Math.abs(rankOf(square) - 3.5));
  const undeveloped = !endgame && rank === 0 ? -18 : 0;
  switch (type) {
    case PAWN: return endgame ? rank * 12 : Math.min(rank, 3) * PAWN_ADVANCE_BY_FILE[file];
    case KNIGHT: return centrality * 10 + undeveloped;
    case BISHOP: return centrality * 5 + undeveloped;
    case KING: return endgame ? centrality * 10 : (rank === 0 && (file <= 2 || file >= 6) ? 20 : -10 * rank);
    default: return 0;
  }
}

/** Few pieces left: the queens are off, or each side has little besides pawns. */
export function isEndgame(board: Board): boolean {
  let queens = 0, minorsAndRooks = 0;
  for (const piece of board.squares) {
    const type = pieceType(piece);
    if (type === QUEEN) queens++;
    else if (type === KNIGHT || type === BISHOP || type === ROOK) minorsAndRooks++;
  }
  return queens === 0 || minorsAndRooks <= 2;
}

/** Material plus placement, from the side to move's point of view. */
export function evaluate(board: Board): number {
  const endgame = isEndgame(board);
  let score = 0;
  for (let square = 0; square < 64; square++) {
    const piece = board.squares[square];
    if (!piece) continue;
    const color = pieceColor(piece), type = pieceType(piece);
    const value = PIECE_VALUES[type] + placement(type, square, color, endgame);
    score += color === board.turn ? value : -value;
  }
  return score;
}

/** Biggest captures first, cheapest attacker first: a standard way to make the search faster. */
function ordered(moves: Move[]): Move[] {
  const value = (m: Move) => (m.captured ? PIECE_VALUES[pieceType(m.captured)] * 10 - PIECE_VALUES[pieceType(m.piece)] : 0) + (m.promotion ? 800 : 0);
  return [...moves].sort((a, b) => value(b) - value(a));
}

/** Follows captures until the position is quiet, so a pending recapture isn't missed. */
function captureSearch(board: Board, alpha: number, beta: number, depth: number): number {
  const standPat = evaluate(board);
  if (depth === 0 || standPat >= beta) return standPat;
  alpha = Math.max(alpha, standPat);
  for (const move of ordered(board.legalCaptures())) {
    board.make(move);
    const score = -captureSearch(board, -beta, -alpha, depth - 1);
    board.unmake();
    if (score >= beta) return score;
    alpha = Math.max(alpha, score);
  }
  return alpha;
}

/** Looks `depth` moves ahead (alpha-beta search). */
function search(board: Board, depth: number, alpha: number, beta: number, followCaptures: boolean, ply: number): number {
  // At the end of the search, score the position without listing every move (the expensive part).
  if (depth === 0) return followCaptures ? captureSearch(board, alpha, beta, MAX_CAPTURE_DEPTH) : evaluate(board);
  const moves = board.legalMoves();
  if (!moves.length) return board.inCheck() ? -MATE + ply : 0;
  let best = -Infinity;
  for (const move of ordered(moves)) {
    board.make(move);
    const score = -search(board, depth - 1, -beta, -alpha, followCaptures, ply + 1);
    board.unmake();
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

/** The final 40% of the move cap counts as the endgame in speed chess, as does any position with few pieces. */
const ENDGAME_PROGRESS = .6;
/** Composure starts to matter 40% of the way through. */
const PRESSURE_PROGRESS = .4;
/** Noise in the middle of the game, where Tactics and Calculation do the work through the search. */
const MIDDLEGAME_SKILL = 6;

export interface MoveContext {
  /** Half-moves played so far in the game. */
  ply: number;
  /** 0 at the start, 1 at the move cap. */
  progress: number;
}

export interface MoveChoice {
  move: Move;
  /** True when Composure failed and the move was played without thinking. */
  blunder: boolean;
}

/**
 * How far below the best move a player may settle, in centipawns, and among how many moves.
 * At skill 10 it always plays the top move; at skill 1 it may play one of the top 5 if it's within ~2.5 pawns.
 */
const settleMargin = (skill: number): number => (10 - skill) * 28;
const settlePool = (skill: number): number => 1 + Math.round((10 - skill) / 2);

/** Picks a move for the side to move. */
export function chooseMove(board: Board, stats: ChessStats, context: MoveContext): MoveChoice {
  const moves = board.legalMoves();
  // Composure: as the move cap nears, a nervous player sometimes just moves something.
  const pressure = Math.max(0, (context.progress - PRESSURE_PROGRESS) / (1 - PRESSURE_PROGRESS));
  if (pressure > 0 && chance(pressure * (10 - stats.comp) * .055)) {
    return { move: moves[Math.floor(Math.random() * moves.length)], blunder: true };
  }
  // Even a 1 in Calculation sometimes sees the reply, and even a 1 in Tactics follows captures half the time,
  // so a weak stat is a weakness rather than a guaranteed loss.
  const depth = chance(.3 + stats.calc * .07) ? 2 : 1;
  const followCaptures = chance(.45 + stats.tac * .055);
  const endgame = context.progress >= ENDGAME_PROGRESS || isEndgame(board);
  const stageSkill = context.ply < OPENING_PLIES ? stats.open : endgame ? stats.end : MIDDLEGAME_SKILL;
  const scored = ordered(moves).map((move) => {
    board.make(move);
    const score = -search(board, depth - 1, -Infinity, Infinity, followCaptures, 1);
    board.unmake();
    return { move, score };
  }).sort((a, b) => b.score - a.score);
  // Settle for one of the best few moves: always sensible, but not always the best.
  const margin = settleMargin(stageSkill);
  const pool = scored.slice(0, settlePool(stageSkill)).filter((m) => m.score >= scored[0].score - margin);
  return { move: pool[Math.floor(Math.random() * pool.length)].move, blunder: false };
}

/** Total material for one side, in pawns (pawn 1, knight 3, bishop 3, rook 5, queen 9). */
export function materialPoints(board: Board, color: Color): number {
  const points: Record<number, number> = { [PAWN]: 1, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 5, [QUEEN]: 9, [KING]: 0 };
  let total = 0;
  for (const piece of board.squares) if (piece && pieceColor(piece) === color) total += points[pieceType(piece)];
  return total;
}
