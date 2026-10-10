import {
  applyCommand,
  decide,
  START_POSE,
  type GameCommand,
  type GameState,
  type MoveCommand,
  type Pose,
} from "./state.js";

export const MAX_ISSUES_PER_RUN = 20;
export const COMMAND_PREFIX = "walk:";

export interface GameIssue {
  readonly number: number;
  readonly title: string;
  readonly author: string;
}

export interface WalkerResult {
  readonly pose: Pose;
  /** Binary PPM of the rendered frame. */
  readonly ppm: Uint8Array;
}

export interface GameDependencies {
  /** Open issues in ascending order. Anything not starting with the command prefix may be omitted. */
  readonly listIssues: () => Promise<readonly GameIssue[]>;
  readonly runWalker: (pose: Pose, command: MoveCommand | "none") => Promise<WalkerResult>;
  /** Durably stores the state and frame. Called after every accepted move, before the player is answered. */
  readonly persist: (state: GameState, ppm: Uint8Array) => Promise<void>;
  /** Closes the issue first, then comments, so a move can never be replayed by a half-failed answer. */
  readonly respond: (issue: GameIssue, message: string) => Promise<void>;
  readonly now: () => Date;
  /** Receives engine failures so they reach the workflow logs even though the player gets a friendly reply. */
  readonly logError: (error: unknown) => void;
}

function isGameIssue(issue: GameIssue): boolean {
  return issue.title.trim().startsWith(COMMAND_PREFIX);
}

async function applyAccepted(
  state: GameState,
  issue: GameIssue,
  command: GameCommand,
  deps: GameDependencies,
): Promise<{ state: GameState; ppm: Uint8Array }> {
  const origin = command === "reset" ? START_POSE : state.pose;
  const walkerCommand = command === "reset" ? "none" : command;
  const { pose, ppm } = await deps.runWalker({ ...origin }, walkerCommand);
  return { state: applyCommand(state, { login: issue.author, command, pose, now: deps.now() }), ppm };
}

/**
 * Processes open game issues one by one. A failure on one issue never blocks the others and never
 * loses state: the previous state is kept and the player is told the move was not applied.
 */
export async function processIssues(initial: GameState, deps: GameDependencies): Promise<GameState> {
  const issues = (await deps.listIssues()).filter(isGameIssue).slice(0, MAX_ISSUES_PER_RUN);
  let state = initial;

  for (const issue of issues) {
    const decision = decide(state, { login: issue.author, title: issue.title, now: deps.now() });
    if (decision.kind === "rejected") {
      await deps.respond(issue, decision.reason);
      continue;
    }
    try {
      const applied = await applyAccepted(state, issue, decision.command, deps);
      await deps.persist(applied.state, applied.ppm);
      state = applied.state;
    } catch (error: unknown) {
      deps.logError(error);
      await deps.respond(issue, "Something went wrong on my side, so this move was not applied. Please try again.");
      continue;
    }
    await deps.respond(
      issue,
      `Done: **${decision.command}**. That is step ${String(state.totalMoves)} for everyone. ` +
        "The picture can take a few minutes to refresh because GitHub caches images.",
    );
  }
  return state;
}
