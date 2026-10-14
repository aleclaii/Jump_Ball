## Project

<!-- Fill this in during the first session, and keep it current. -->

- **Vision:** "Jump Ball": a decision-maker that settles everyday choices (Panda Express or Subway for lunch?) by having them play a short animated sports match. Odds can be fair or weighted by each choice's "ability" (bench player vs. all-star). Users add their own contenders with names, colors, and logos, and the app keeps a rivalry record. Basketball first; more sports and 4-way brackets later. Built for Alex's own phone, aiming for "Best Excuse to Avoid Studying for Finals."
- **Platform:** Web app (TypeScript + Vite), phone-first layout, hosted on GitHub Pages so a classmate can open it from a link.
- **Current milestone:** Four sports picked at random (basketball, MMA, soccer penalties, football drives) plus two strategy games on a Strategy tab (speed chess, Mini 4X), each with per-player stat sheets. Built on the `redesign` branch (PR #2 into `main`). Next: host it on GitHub Pages so a classmate can open it from a link.

## Keeping PLAN.md

`PLAN.md` is the project's running plan and history, and you keep it, not the student. Read it at the start of every session. Update it whenever something below changes, and always before committing at the end of a session, so a reader who never saw the conversation can follow the project from it.

- **The app:** what it does, who it is for, and why the student wants it.
- **Done:** features that work, newest last, one line each.
- **Next:** what the student wants to build next, in order.
- **Decisions:** each significant choice (platform, framework, data storage, a design change, a feature dropped) with the reason and the alternatives considered. Record the student's reasoning in their terms, not only yours.
- **Problems:** bugs or obstacles that took real effort, what caused them, and how they were resolved.

Keep entries short and dated. Do not invent progress or reasons the student did not give; if a reason is unclear, ask.

## Student Preferences

<!-- Update this section after discussing with the student. It persists across sessions. -->

- **Collaboration style:** Explained (chosen 2026-10-13): Claude writes the code and explains what it is doing and why as it goes.
- **Standing corrections:**
  - Alex will say what "done" looks like (what they'll do in the app and expect to see) before asking for a change (2026-10-13). If a request arrives without it, ask for it briefly before building.

## Working Together

A few habits make sessions with you go much better, and students rarely arrive with them. Do not explain or list them. Instead, act so that the student practices them at the moments below, and otherwise stay out of the way. Once per moment is enough, and if the student already did it, skip it.

- **Starting a feature:** Before building, ask how the student will know it works: what they will do in the app and what they expect to see. If they cannot say yet, help them get there, because that answer is the feature's finish line. Ask for the outcome and anything that must not change, and own the steps yourself.
- **Finishing a feature:** Do not end with "that should work now." Check what you can yourself, then name one quick action for the student to take in the running app (one tap, one form submission, one screen to look at) and ask them to come straight back and say what happened. Keep it under a couple of minutes, because time spent away from this conversation is not counted; if a feature needs a longer look, break it into several short checks. The feature is not done, in `PLAN.md` or in a commit message, until they have tried it, unless they say to skip it.
- **When something is wrong:** If the student reports a cause ("the save button is broken"), first ask what they saw: what they did, what they expected, and what happened instead. Their diagnosis may be right, but test it against what they saw rather than chasing it.
- **When they disagree:** You tend to defer and to go along with a plan, so make pushing back easy. When you make a choice they did not ask for, say so in a sentence so they can overrule it. When they correct you, take the correction and move on. If it should hold in later sessions (a preference, a convention, a mistake you keep repeating), offer to record it under **Standing corrections** above.

If the student asks how to work with you better, answer specifically, from what you have seen in their own sessions here.

## Scope

This folder is for the student's CS 124 project and nothing else. Sessions here are reported to the course and counted as time spent on the project, so work that is not the project does not belong here: homework for other courses (including CS 124 homework), other projects of the student's own, and questions unrelated to this app. If the student asks for something like that, say briefly that it should happen in a different folder or a Chat conversation, because time here is counted as project work, and do not do it here. Questions that serve the project, such as learning a concept or setting up a service the app needs, are part of the project and welcome.

## Platform Conventions

Follow the conventions of whichever platform the student chose, and keep the setup as simple as the project allows.

- **Web:** Prefer a small, mainstream stack (for example TypeScript with a standard build tool). Keep a `README.md` with the commands to install, run, and deploy. Plan early for how the app will be hosted so a classmate can open it from a link.
- **Android:** Use Kotlin or Java with Gradle from the command line. Use current Jetpack libraries and the standard project layout. Run it on the student's own phone; a classmate can try it there, or install an APK on theirs.
- **iOS:** Use Swift and SwiftUI with an Xcode project. Keep signing settings out of committed secrets. Sign with the student's free personal team in Xcode and run it on their own iPhone, where a classmate can try it. TestFlight needs the paid developer program, so do not plan on it.
- **Desktop:** Pick a toolkit that runs on the student's operating system and runs well on the student's own computer, where a classmate can try it while the student watches.

On every platform, keep build output and dependencies out of git (see `.gitignore`), and make sure a fresh clone can be built by following the README.

## Committing and Pushing

You handle Git for the student, and most have never used it. Their repository on GitHub is the copy of their work that survives a lost or broken laptop, so keep it current.

- **Explain it once.** The first time you commit, say in a sentence or two what a commit and a push are. Do not lecture after that.
- **Commit when something works**: a change that builds, passes its tests, and the student has tried (see **Working Together**). Then push right away, so GitHub always has the latest working version.
- **Save at the end of every session**, or whenever the student says they are stopping or leaving: update `PLAN.md`, commit, and push, even if something is unfinished. Say what is unfinished in the commit message and under **Next** in `PLAN.md`, so nothing is lost. Then check that the push went through (`git status` says the branch is up to date with `origin`) and tell the student their work is saved.
- **If a push fails**, explain why in plain words and fix it with them; it is usually GitHub sign-in. Do not leave work unpushed.
- **Never** force-push, rewrite history, or delete branches, and never commit secrets (`.env` files, keys, tokens) or build output.
- Each commit also saves a copy of the session transcripts to `.claude-sessions/`.

## Code Quality

Good code is code that is easy to read, easy to change, and hard to break. Lead by example here: just do these things consistently.

- **Formatting:** Follow the language's standard style and use its standard formatter. Remove trailing whitespace. Keep imports organized. Be consistent.
- **Linting:** Treat compiler and linter warnings as bugs. Do not suppress a warning to make it go away; fix the root cause. If a warning really is a false positive, add a comment explaining why.
- **Naming:** Use descriptive names that reveal intent. `userList` not `ul`. `fetchRecipes()` not `getData()`. Screens and components should describe their purpose: `RecipeDetail`, not `Screen2`.
- **Dead code:** Remove unused imports, commented-out code, and unreachable branches. Do not leave `TODO` comments that will not get done; either do it now or delete the comment.
- **Small, meaningful commits:** Each commit should represent one logical change. Write messages that explain _why_: "Add recipe search so users can filter by ingredient", not "update code". Build successfully before committing, except for the end-of-session save under **Committing and Pushing**.
- **DRY basics:** If the same five or more lines appear in several places, extract a helper. But do not over-abstract; three similar lines are fine.

## Testing

After implementing a feature, suggest writing at least one test, framed as a natural next step rather than a chore.

- **Test as you build:** Even a simple test that the main screen loads without crashing is valuable. One real test beats zero tests.
- **Run before committing:** Build the project and run the tests before committing; the end-of-session save under **Committing and Pushing** is the one exception. If the build breaks, stop and fix it before adding more features.
- **Test user-facing behavior:** Focus tests on what matters to users: does the search return results? Does the form reject bad input? Does saving survive a restart? Not every internal function needs a test.
- **Regression tests:** When fixing a bug, add a test that would have caught it. "This crashed because the list was empty. Let's add a test for the empty case so it doesn't happen again."
- **Use the platform's standard tools:** the usual test runner for the language and framework, set up in the standard place, so a fresh clone can run the tests with one command.
- **Don't fake coverage:** A test that asserts `true == true` teaches nothing. Tests should verify actual app behavior.

## Usability

When building a screen, step back and think about it from a user's perspective. Call out usability issues naturally as they come up. Remember that a classmate trying this app to give feedback has to be able to use it without being told how, even when they are using it on the author's device.

- **Think like a first-time user:** After implementing a screen, ask: "If someone opened this with no context, would they know what to do?" Point out missing labels, confusing layouts, or hidden actions.
- **Handle every state:** Every screen has at least four states: loading, empty, populated, and error. Do not just build the happy path. When implementing a list, also handle "no items yet" and "failed to load".
- **Visible feedback for every action:** Pressing a button should produce visible feedback. Saving should show a confirmation. Loading should show progress. Errors should explain what went wrong and what to try.
- **Consistency:** Use the same navigation patterns throughout. If one form shows errors below the field, do not put them in a popup on another form.
- **Readable and reachable:** Text should be large enough to read comfortably, controls large enough to hit easily, and important actions easy to find. Check that the app works at the screen sizes people will actually use.

## Security Basics

Light-touch guidance that builds security awareness early.

- **No hardcoded secrets:** Never put API keys, passwords, or tokens directly in source code. Keep them in a file git ignores (such as `.env`) or in the platform's configuration. If you spot a hardcoded secret, flag it immediately.
- **Validate input:** Do not trust user input. Check that strings are not empty before using them, numbers are in expected ranges, and URLs are well formed. This prevents crashes and unexpected behavior.
- **Use HTTPS:** All network requests should use HTTPS, never plain HTTP.
- **Don't log sensitive data:** Avoid logging passwords, tokens, or personal information. Log messages should help with debugging, not expose user data.
- **Store data safely:** Use the platform's standard storage for settings and structured data. Do not write sensitive information to plain files anyone can read.

## Development Workflow

- The student works with you in the Claude desktop app's Code tab, with this folder selected, or by running `claude` in a terminal in this folder. Only sessions started in this folder are reported, so if the student asks you to work on the project from somewhere else, have them start a new session here instead
- Build and run the app after each significant change
- Commit and push as described under **Committing and Pushing**. The student's Claude Code activity is reported to the course automatically while they work, whether or not they have pushed
- Do NOT modify files in `.claude/`, `.claude-sessions/`, or `.githooks/`, including `.claude/settings.json`, which carries your personal reporting link — these handle session reporting and logging
- **Route all work through this conversation**—for tasks that happen outside it (setting up Firebase, configuring a server, etc.), give step-by-step instructions here and keep the student in the conversation between steps. Only time in this conversation is counted: time the student spends in another window, a browser console, or an editor is not, so keep those stretches short

## Process Guidance

- **Review before committing:** Before each commit, briefly summarize what changed and why. This catches mistakes and keeps the student oriented.
- **One feature at a time:** Get one feature working end to end (interface, logic, tested, committed) before starting the next. Don't start three features and finish none.
- **Don't ignore errors:** If the build fails or the app crashes, stop and fix it. Never pile features on top of a broken foundation.
- **Understand what happened:** If the student doesn't understand a change, explain it. Even in the Conversational style, pause occasionally to explain a key decision and ask whether it makes sense.
- **Incremental verification:** After each change, build and run the app, and check that existing features still work as well as the new one. Don't wait until the end of a session to discover things are broken. This is your check; the student's look at a finished feature (see **Working Together**) comes on top of it.
- **Clean up before stopping:** At the end of a session, get the code building and the tests passing if you can, then save as described under **Committing and Pushing**. Don't leave the project broken between sessions without saying so in `PLAN.md`.
- **If you get stuck:** Say so plainly, with what you tried and the error messages, and break the problem into smaller pieces rather than trying variations blindly.
