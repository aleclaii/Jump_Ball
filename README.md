# Jump Ball

Can't decide between two things? Type them in, and they play a quick game of basketball, MMA, soccer, or football (or, on the Strategy tab, speed chess, a Mini 4X empire game, or two traders competing in a simulated stock market). The winner is your answer.

A CS 124 independent project, built with TypeScript and Vite.

## Run it

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install      # once, after cloning
npm run dev      # start a local server, then open the link it prints
```

## Test and build

```bash
npm test         # run the simulation tests
npm run build    # type-check and build the site into dist/
npm run preview  # serve the built site locally
```

## How the code is organized

```
index.html              Page markup for the three screens
src/
  main.ts               Connects the setup, game, and winner screens
  styles.css            All styles, with light and dark themes
  data/                 What the app remembers
    state.ts            Saved options, players, settings, rivalry records
    statSheet.ts        What a stat sheet is: stats, groups, builds, budget
    sheets.ts           The four sports' sheets, and each player's set of sheets
    storage.ts          Browser storage that never crashes
  sports/               One folder per sport, plus what they share
    types.ts            The contract every sport implements
    index.ts            The list of sports, and random picks
    odds.ts             Projected win chance from simulated games
    oddsWorker.ts       Runs those games on a background thread so the page never freezes
    drawing.ts          Canvas helpers (player tokens, labels)
    sides.ts            How a side looks when it plays as one figure
    basketball/         stats, engine, court, animation, commentary, game
    mma/                stats, engine, octagon, commentary, game
    soccer/             stats, engine (penalty shootout), pitch, commentary, game
    football/           stats, engine (4-down drives), field, commentary, game
    chess/              stats, board (the rules), ai (the computer player), engine (speed-chess
                        game and move cap), boardView, commentary, game
    conquest/           Mini 4X: stats, map (symmetric hex map), engine (turns), mapView,
                        commentary, game
    trading/            Trading: stats, market (true values, mood, Fed), trader (beliefs,
                        consultants, sizing), engine (match + Sharpe ratio), view, commentary, game
  ui/                   The screens and editors
    setupScreen.ts      Quick / Creative / Competition / Strategy tabs and options
    gameScreen.ts       Runs a game or best-of-3 with scoreboard and play-by-play
    winnerScreen.ts     The answer, how it was won, and a recap
    optionEditor.ts     Saved options (names, colors, logos)
    choicePicker.ts     The name box that lists saved options to pick or add
    playerEditor.ts     Competition players and their stat sheet for each sport
  util/                 Small math and HTML helpers
prototype/              The original single-file prototype, kept for reference
```

Every sport folder follows the same pattern: `stats.ts` defines the sport's player stats and builds,
`engine.ts` holds the rules with no drawing (and is what the tests check), the field file paints the background, `commentary.ts` has the play-by-play lines, `game.ts`
animates a game for the screen, and `index.ts` plugs the sport into the app.

Tests live next to the code they check, as `*.test.ts`.
# JumpBall
# Jump_Ball
