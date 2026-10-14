/* The rules of chess, with no drawing or decision-making: the board, legal moves (including castling,
   en passant, and promotion), check, and move notation. Squares are numbered rank * 8 + file,
   so a1 = 0, h1 = 7, a8 = 56; White starts on ranks 1-2 and moves first. */

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export type Color = 0 | 1;
export const WHITE: Color = 0, BLACK: Color = 1;

export const pieceType = (piece: number): number => piece & 7;
export const pieceColor = (piece: number): Color => ((piece & 8) ? BLACK : WHITE);
export const makePiece = (type: number, color: Color): number => type | (color === BLACK ? 8 : 0);
export const fileOf = (square: number): number => square & 7;
export const rankOf = (square: number): number => square >> 3;
const toSquare = (file: number, rank: number): number => rank * 8 + file;
const onBoard = (file: number, rank: number): boolean => file >= 0 && file < 8 && rank >= 0 && rank < 8;
export const squareName = (square: number): string => "abcdefgh"[fileOf(square)] + (rankOf(square) + 1);
const other = (color: Color): Color => (color === WHITE ? BLACK : WHITE);

export type MoveFlag = "normal" | "double" | "enPassant" | "castleKing" | "castleQueen";

export interface Move {
  from: number;
  to: number;
  piece: number;
  /** The captured piece, or 0. */
  captured: number;
  /** The piece type a pawn promotes to, or 0. */
  promotion: number;
  flag: MoveFlag;
}

interface Undo {
  move: Move;
  castling: number;
  enPassant: number;
  halfmove: number;
}

/** Castling rights, as bits. */
const WHITE_KINGSIDE = 1, WHITE_QUEENSIDE = 2, BLACK_KINGSIDE = 4, BLACK_QUEENSIDE = 8;
/** Which rights a move from or to each corner (or king square) takes away. */
const RIGHTS_LOST: Record<number, number> = {
  0: WHITE_QUEENSIDE, 7: WHITE_KINGSIDE, 4: WHITE_KINGSIDE | WHITE_QUEENSIDE,
  56: BLACK_QUEENSIDE, 63: BLACK_KINGSIDE, 60: BLACK_KINGSIDE | BLACK_QUEENSIDE,
};

const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_LINES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_LINES = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT];
const PIECE_LETTERS = ["", "", "N", "B", "R", "Q", "K"];
const FEN_PIECES = "pnbrqk";

export class Board {
  squares = new Int8Array(64);
  turn: Color = WHITE;
  castling = 0;
  /** The square a pawn can capture onto en passant, or -1. */
  enPassant = -1;
  /** Moves since the last capture or pawn move. */
  halfmove = 0;
  kings: [number, number] = [4, 60];
  private history: Undo[] = [];

  static start(): Board {
    return Board.fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  /** Reads a position in standard FEN notation (used for the starting position and in tests). */
  static fromFen(fen: string): Board {
    const board = new Board();
    const [placement, turn, castling, enPassant, halfmove] = fen.trim().split(/\s+/);
    placement.split("/").forEach((row, i) => {
      const rank = 7 - i;
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) {
          file += Number(ch);
          continue;
        }
        const color: Color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const type = FEN_PIECES.indexOf(ch.toLowerCase()) + 1;
        board.squares[toSquare(file, rank)] = makePiece(type, color);
        if (type === KING) board.kings[color] = toSquare(file, rank);
        file++;
      }
    });
    board.turn = turn === "b" ? BLACK : WHITE;
    board.castling = (castling.includes("K") ? WHITE_KINGSIDE : 0) | (castling.includes("Q") ? WHITE_QUEENSIDE : 0)
      | (castling.includes("k") ? BLACK_KINGSIDE : 0) | (castling.includes("q") ? BLACK_QUEENSIDE : 0);
    board.enPassant = enPassant && enPassant !== "-" ? toSquare("abcdefgh".indexOf(enPassant[0]), Number(enPassant[1]) - 1) : -1;
    board.halfmove = Number(halfmove ?? 0);
    return board;
  }

  /** Whether `by` attacks `target`. */
  isAttacked(target: number, by: Color): boolean {
    const tf = fileOf(target), tr = rankOf(target);
    const pawnRank = tr - (by === WHITE ? 1 : -1);
    for (const df of [-1, 1]) {
      if (onBoard(tf + df, pawnRank) && this.squares[toSquare(tf + df, pawnRank)] === makePiece(PAWN, by)) return true;
    }
    for (const [df, dr] of KNIGHT_STEPS) {
      if (onBoard(tf + df, tr + dr) && this.squares[toSquare(tf + df, tr + dr)] === makePiece(KNIGHT, by)) return true;
    }
    for (const [df, dr] of KING_STEPS) {
      if (onBoard(tf + df, tr + dr) && this.squares[toSquare(tf + df, tr + dr)] === makePiece(KING, by)) return true;
    }
    const slides = (lines: number[][], types: number[]) => lines.some(([df, dr]) => {
      for (let f = tf + df, r = tr + dr; onBoard(f, r); f += df, r += dr) {
        const piece = this.squares[toSquare(f, r)];
        if (!piece) continue;
        return pieceColor(piece) === by && types.includes(pieceType(piece));
      }
      return false;
    });
    return slides(ROOK_LINES, [ROOK, QUEEN]) || slides(BISHOP_LINES, [BISHOP, QUEEN]);
  }

  inCheck(color: Color = this.turn): boolean {
    return this.isAttacked(this.kings[color], other(color));
  }

  /** Every move that follows how the pieces move, before checking whether it leaves the king in check. */
  private pseudoMoves(): Move[] {
    const moves: Move[] = [];
    const us = this.turn, them = other(us);
    const add = (from: number, to: number, flag: MoveFlag = "normal", promotion = 0) => {
      const captured = flag === "enPassant" ? makePiece(PAWN, them) : this.squares[to];
      moves.push({ from, to, piece: this.squares[from], captured, promotion, flag });
    };
    for (let from = 0; from < 64; from++) {
      const piece = this.squares[from];
      if (!piece || pieceColor(piece) !== us) continue;
      const f = fileOf(from), r = rankOf(from), type = pieceType(piece);
      if (type === PAWN) {
        const dir = us === WHITE ? 1 : -1, startRank = us === WHITE ? 1 : 6, lastRank = us === WHITE ? 7 : 0;
        const pushOrPromote = (to: number) => {
          if (rankOf(to) === lastRank) PROMOTIONS.forEach((p) => add(from, to, "normal", p));
          else add(from, to);
        };
        const one = toSquare(f, r + dir);
        if (onBoard(f, r + dir) && !this.squares[one]) {
          pushOrPromote(one);
          const two = toSquare(f, r + 2 * dir);
          if (r === startRank && !this.squares[two]) add(from, two, "double");
        }
        for (const df of [-1, 1]) {
          if (!onBoard(f + df, r + dir)) continue;
          const to = toSquare(f + df, r + dir), target = this.squares[to];
          if (target && pieceColor(target) === them) pushOrPromote(to);
          else if (to === this.enPassant) add(from, to, "enPassant");
        }
      } else if (type === KNIGHT || type === KING) {
        for (const [df, dr] of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
          if (!onBoard(f + df, r + dr)) continue;
          const to = toSquare(f + df, r + dr), target = this.squares[to];
          if (!target || pieceColor(target) === them) add(from, to);
        }
        if (type === KING) this.addCastles(from, add);
      } else {
        const lines = type === ROOK ? ROOK_LINES : type === BISHOP ? BISHOP_LINES : [...ROOK_LINES, ...BISHOP_LINES];
        for (const [df, dr] of lines) {
          for (let nf = f + df, nr = r + dr; onBoard(nf, nr); nf += df, nr += dr) {
            const to = toSquare(nf, nr), target = this.squares[to];
            if (target && pieceColor(target) === us) break;
            add(from, to);
            if (target) break;
          }
        }
      }
    }
    return moves;
  }

  /** Castling: the king and rook haven't moved, the squares between are empty, and the king doesn't pass through check. */
  private addCastles(from: number, add: (from: number, to: number, flag: MoveFlag) => void): void {
    const us = this.turn, them = other(us);
    const [kingside, queenside] = us === WHITE ? [WHITE_KINGSIDE, WHITE_QUEENSIDE] : [BLACK_KINGSIDE, BLACK_QUEENSIDE];
    if (from !== (us === WHITE ? 4 : 60) || this.isAttacked(from, them)) return;
    const empty = (...squares: number[]) => squares.every((s) => !this.squares[s]);
    const safe = (...squares: number[]) => squares.every((s) => !this.isAttacked(s, them));
    if ((this.castling & kingside) && empty(from + 1, from + 2) && safe(from + 1, from + 2)) add(from, from + 2, "castleKing");
    if ((this.castling & queenside) && empty(from - 1, from - 2, from - 3) && safe(from - 1, from - 2)) add(from, from - 2, "castleQueen");
  }

  /** Every move the side to move can legally make. */
  legalMoves(): Move[] {
    return this.keepLegal(this.pseudoMoves());
  }

  /** Only legal captures and promotions: cheaper, for following capture sequences in the search. */
  legalCaptures(): Move[] {
    return this.keepLegal(this.pseudoMoves().filter((m) => m.captured || m.promotion));
  }

  /** Drops moves that would leave the mover's own king in check. */
  private keepLegal(moves: Move[]): Move[] {
    const us = this.turn;
    return moves.filter((move) => {
      this.make(move);
      const safe = !this.inCheck(us);
      this.unmake();
      return safe;
    });
  }

  make(move: Move): void {
    this.history.push({ move, castling: this.castling, enPassant: this.enPassant, halfmove: this.halfmove });
    const us = this.turn;
    this.squares[move.to] = move.promotion ? makePiece(move.promotion, us) : move.piece;
    this.squares[move.from] = 0;
    if (move.flag === "enPassant") this.squares[move.to + (us === WHITE ? -8 : 8)] = 0;
    if (move.flag === "castleKing") {
      this.squares[move.to - 1] = this.squares[move.to + 1];
      this.squares[move.to + 1] = 0;
    } else if (move.flag === "castleQueen") {
      this.squares[move.to + 1] = this.squares[move.to - 2];
      this.squares[move.to - 2] = 0;
    }
    if (pieceType(move.piece) === KING) this.kings[us] = move.to;
    this.castling &= ~((RIGHTS_LOST[move.from] ?? 0) | (RIGHTS_LOST[move.to] ?? 0));
    this.enPassant = move.flag === "double" ? (move.from + move.to) / 2 : -1;
    this.halfmove = pieceType(move.piece) === PAWN || move.captured ? 0 : this.halfmove + 1;
    this.turn = other(us);
  }

  unmake(): void {
    const undo = this.history.pop();
    if (!undo) return;
    const { move } = undo;
    const us = other(this.turn);
    this.turn = us;
    this.castling = undo.castling;
    this.enPassant = undo.enPassant;
    this.halfmove = undo.halfmove;
    this.squares[move.from] = move.piece;
    this.squares[move.to] = move.flag === "enPassant" ? 0 : move.captured;
    if (move.flag === "enPassant") this.squares[move.to + (us === WHITE ? -8 : 8)] = move.captured;
    if (move.flag === "castleKing") {
      this.squares[move.to + 1] = this.squares[move.to - 1];
      this.squares[move.to - 1] = 0;
    } else if (move.flag === "castleQueen") {
      this.squares[move.to - 2] = this.squares[move.to + 1];
      this.squares[move.to + 1] = 0;
    }
    if (pieceType(move.piece) === KING) this.kings[us] = move.from;
  }

  /** Standard algebraic notation (e.g. "Nf3", "exd5", "O-O", "e8=Q#"), for a legal move not yet made. */
  san(move: Move, legal: Move[] = this.legalMoves()): string {
    let text: string;
    if (move.flag === "castleKing") text = "O-O";
    else if (move.flag === "castleQueen") text = "O-O-O";
    else {
      const type = pieceType(move.piece), capture = move.captured !== 0;
      if (type === PAWN) {
        text = (capture ? "abcdefgh"[fileOf(move.from)] + "x" : "") + squareName(move.to);
        if (move.promotion) text += "=" + PIECE_LETTERS[move.promotion];
      } else {
        // Another piece of the same kind that can also reach this square (compared by squares, since
        // `legal` may be a freshly generated list holding a copy of this same move).
        const rivals = legal.filter((m) => m.from !== move.from && m.to === move.to && m.piece === move.piece);
        let disambiguation = "";
        if (rivals.length) {
          if (rivals.every((m) => fileOf(m.from) !== fileOf(move.from))) disambiguation = "abcdefgh"[fileOf(move.from)];
          else if (rivals.every((m) => rankOf(m.from) !== rankOf(move.from))) disambiguation = String(rankOf(move.from) + 1);
          else disambiguation = squareName(move.from);
        }
        text = PIECE_LETTERS[type] + disambiguation + (capture ? "x" : "") + squareName(move.to);
      }
    }
    this.make(move);
    if (this.inCheck()) text += this.legalMoves().length ? "+" : "#";
    this.unmake();
    return text;
  }

  /** The squares the piece on `from` attacks (for spotting forks in commentary). */
  attacksFrom(from: number): number[] {
    const piece = this.squares[from];
    if (!piece) return [];
    const f = fileOf(from), r = rankOf(from), type = pieceType(piece);
    const squares: number[] = [];
    if (type === PAWN) {
      const dir = pieceColor(piece) === WHITE ? 1 : -1;
      for (const df of [-1, 1]) if (onBoard(f + df, r + dir)) squares.push(toSquare(f + df, r + dir));
    } else if (type === KNIGHT || type === KING) {
      for (const [df, dr] of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) if (onBoard(f + df, r + dr)) squares.push(toSquare(f + df, r + dr));
    } else {
      const lines = type === ROOK ? ROOK_LINES : type === BISHOP ? BISHOP_LINES : [...ROOK_LINES, ...BISHOP_LINES];
      for (const [df, dr] of lines) {
        for (let nf = f + df, nr = r + dr; onBoard(nf, nr); nf += df, nr += dr) {
          squares.push(toSquare(nf, nr));
          if (this.squares[toSquare(nf, nr)]) break;
        }
      }
    }
    return squares;
  }

  /** Neither side has enough pieces left to ever checkmate. */
  insufficientMaterial(): boolean {
    const left = [...this.squares].filter((p) => p && pieceType(p) !== KING);
    return left.length === 0 || (left.length === 1 && [KNIGHT, BISHOP].includes(pieceType(left[0])));
  }
}

/** Counts every sequence of legal moves `depth` moves deep. The standard check that move generation is correct. */
export function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  const moves = board.legalMoves();
  if (depth === 1) return moves.length;
  let total = 0;
  for (const move of moves) {
    board.make(move);
    total += perft(board, depth - 1);
    board.unmake();
  }
  return total;
}
