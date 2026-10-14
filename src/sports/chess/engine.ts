/* A speed-chess game with no drawing: who plays White, the move cap, and how it ends.
   Checkmate wins. Otherwise, at the move cap (or on a draw), more material wins; if material is level,
   the Armageddon rule gives the draw to Black, as in real speed-chess tiebreaks. */

import type { SideIndex } from "../types";
import { chooseMove, materialPoints, PIECE_VALUES } from "./ai";
import { BLACK, Board, type Color, KING, KNIGHT, type Move, pieceColor, pieceType, WHITE } from "./board";
import type { ChessStats } from "./stats";

export type ChessEnd = "checkmate" | "material" | "armageddon";

export interface PlayedMove {
  side: SideIndex;
  move: Move;
  san: string;
  /** Pieces of value the moved piece now attacks at once, when there are two or more (a fork). */
  forked: number[];
  check: boolean;
  mate: boolean;
  blunder: boolean;
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

export class ChessMatch {
  readonly board = Board.start();
  readonly players: [ChessStats, ChessStats];
  readonly movesEach: number;
  /** Which side plays the white pieces (and moves first). Decided by coin toss. */
  readonly whiteSide: SideIndex = Math.random() < .5 ? 0 : 1;
  played: PlayedMove[] = [];
  done = false;
  winner: SideIndex = 0;
  end: ChessEnd = "material";
  /** Why the game stopped before checkmate, for commentary. */
  stopReason: "cap" | "stalemate" | "insufficient" | null = null;

  constructor(players: [ChessStats, ChessStats], movesEach: number) {
    this.players = players;
    this.movesEach = movesEach;
  }

  sideOf(color: Color): SideIndex {
    return color === WHITE ? this.whiteSide : other(this.whiteSide);
  }

  colorOf(side: SideIndex): Color {
    return side === this.whiteSide ? WHITE : BLACK;
  }

  get toMove(): SideIndex {
    return this.sideOf(this.board.turn);
  }

  /** Full moves played (a move by each side counts once), for the scoreboard. */
  get moveNumber(): number {
    return Math.floor(this.played.length / 2) + 1;
  }

  /** Decides the next move without playing it. */
  next(): PlayedMove {
    const side = this.toMove;
    const legal = this.board.legalMoves();
    const choice = chooseMove(this.board, this.players[side], {
      ply: this.played.length,
      progress: this.played.length / (this.movesEach * 2),
    });
    const san = this.board.san(choice.move, legal);
    this.board.make(choice.move);
    const check = this.board.inCheck();
    const mate = check && this.board.legalMoves().length === 0;
    const forked = this.board.attacksFrom(choice.move.to).filter((square) => {
      const target = this.board.squares[square];
      return target && pieceColor(target) !== pieceColor(choice.move.piece)
        && (pieceType(target) === KING || PIECE_VALUES[pieceType(target)] > PIECE_VALUES[KNIGHT] - 1);
    });
    this.board.unmake();
    return { side, move: choice.move, san, forked: forked.length >= 2 ? forked : [], check, mate, blunder: choice.blunder };
  }

  apply(played: PlayedMove): void {
    this.board.make(played.move);
    this.played.push(played);
    if (played.mate) return this.finish(played.side, "checkmate");
    const noMoves = this.board.legalMoves().length === 0;
    if (noMoves) this.stopReason = "stalemate";
    else if (this.board.insufficientMaterial()) this.stopReason = "insufficient";
    else if (this.played.length >= this.movesEach * 2) this.stopReason = "cap";
    if (!this.stopReason) return;
    const [mine, theirs] = [materialPoints(this.board, this.colorOf(0)), materialPoints(this.board, this.colorOf(1))];
    if (mine !== theirs) this.finish(mine > theirs ? 0 : 1, "material");
    else this.finish(this.sideOf(BLACK), "armageddon");
  }

  private finish(winner: SideIndex, end: ChessEnd): void {
    this.done = true;
    this.winner = winner;
    this.end = end;
  }

  material(side: SideIndex): number {
    return materialPoints(this.board, this.colorOf(side));
  }

  playOut(): void {
    while (!this.done) this.apply(this.next());
  }
}
