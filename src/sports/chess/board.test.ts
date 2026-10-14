import { describe, expect, it } from "vitest";
import { Board, perft } from "./board";

/* Perft: count every sequence of legal moves a few moves deep and compare with totals published by
   the chess-programming community. If any rule (castling, en passant, promotion, pins, check) is wrong,
   these numbers come out different. */
describe("chess rules", () => {
  it("matches the known move counts from the starting position", () => {
    const board = Board.start();
    expect(perft(board, 1)).toBe(20);
    expect(perft(board, 2)).toBe(400);
    expect(perft(board, 3)).toBe(8902);
  });

  it("handles castling, en passant, promotion, and pins ('Kiwipete' test position)", () => {
    const board = Board.fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect(perft(board, 1)).toBe(48);
    expect(perft(board, 2)).toBe(2039);
    expect(perft(board, 3)).toBe(97862);
  });

  it("handles tricky en passant and promotion cases (test positions 3 and 4)", () => {
    expect(perft(Board.fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4)).toBe(43238);
    expect(perft(Board.fromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3)).toBe(9467);
  });

  it("puts the board back exactly after making and taking back moves", () => {
    const board = Board.fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    const before = [...board.squares].join(",");
    for (const move of board.legalMoves()) {
      board.make(move);
      board.unmake();
    }
    expect([...board.squares].join(",")).toBe(before);
  });

  it("writes moves in standard notation, including checkmate", () => {
    const board = Board.start();
    const play = (san: string) => {
      const legal = board.legalMoves();
      const move = legal.find((m) => board.san(m, legal) === san);
      expect(move, san).toBeDefined();
      board.make(move!);
    };
    ["f3", "e5", "g4"].forEach(play);
    const mate = board.legalMoves().find((m) => board.san(m) === "Qh4#");
    expect(mate).toBeDefined();
  });
});

describe("move notation", () => {
  // Regression: a fresh list of legal moves contains a copy of the move, which was counted as a rival piece.
  it("doesn't add a square to a move only one piece can make", () => {
    const board = Board.fromFen("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2");
    const names = board.legalMoves().map((m) => board.san(m));
    expect(names).toContain("Qh4#");
    expect(names).toContain("Nf6");
  });

  it("adds the file when two of the same piece can reach a square", () => {
    // Both rooks can reach d1, f1, and every square between them.
    const board = Board.fromFen("4k3/8/8/8/8/8/4K3/R6R w - - 0 1");
    const names = board.legalMoves().map((m) => board.san(m));
    expect(names).toContain("Rad1");
    expect(names).toContain("Rhd1");
    expect(names).toContain("Ra7");
  });
});
