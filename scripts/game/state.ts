import { z } from "zod";

export const MOVE_COMMANDS = ["forward", "back", "left", "right"] as const;
export type MoveCommand = (typeof MOVE_COMMANDS)[number];
export type GameCommand = MoveCommand | "reset";

export const MOVE_COOLDOWN_SECONDS = 20;
export const RESET_COOLDOWN_SECONDS = 3600;
export const RECENT_LIMIT = 8;
export const START_POSE = { x: 8, y: 4, angle: 0 } as const;

const MS_PER_SECOND = 1000;
const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TITLE_PATTERN = /^walk:(forward|back|left|right|reset)$/;

const poseSchema = z.object({ x: z.number(), y: z.number(), angle: z.number() });
const playerSchema = z.object({
  moves: z.number().int().nonnegative(),
  lastMoveAt: z.string().nullable(),
  lastResetAt: z.string().nullable(),
});
const recentSchema = z.object({ login: z.string(), command: z.string(), at: z.string() });

const stateSchema = z.object({
  version: z.literal(1),
  pose: poseSchema,
  totalMoves: z.number().int().nonnegative(),
  players: z.record(z.string(), playerSchema),
  recent: z.array(recentSchema),
});

export type Pose = z.infer<typeof poseSchema>;
export type GameState = z.infer<typeof stateSchema>;

export type Decision =
  | { readonly kind: "accepted"; readonly command: GameCommand }
  | { readonly kind: "rejected"; readonly reason: string };

export function initialState(): GameState {
  return { version: 1, pose: { ...START_POSE }, totalMoves: 0, players: {}, recent: [] };
}

/** State comes from a file on a branch, so it is validated like any external input. */
export function parseState(raw: unknown): GameState {
  return stateSchema.parse(raw);
}

export function isValidLogin(login: string): boolean {
  return LOGIN_PATTERN.test(login);
}

function isGameCommand(value: string): value is GameCommand {
  return value === "reset" || (MOVE_COMMANDS as readonly string[]).includes(value);
}

export function parseCommand(title: string): GameCommand | null {
  const candidate = TITLE_PATTERN.exec(title.trim())?.[1];
  return candidate !== undefined && isGameCommand(candidate) ? candidate : null;
}

function secondsLeft(lastAt: string | null, cooldownSeconds: number, now: Date): number {
  if (lastAt === null) return 0;
  const elapsed = (now.getTime() - Date.parse(lastAt)) / MS_PER_SECOND;
  return Math.ceil(Math.min(cooldownSeconds, Math.max(0, cooldownSeconds - elapsed)));
}

export function decide(state: GameState, input: { login: string; title: string; now: Date }): Decision {
  const { login, title, now } = input;
  if (!isValidLogin(login)) return { kind: "rejected", reason: "This account name cannot be used." };

  const command = parseCommand(title);
  if (command === null) {
    return { kind: "rejected", reason: "Unknown command. Use one of the links in the profile README." };
  }

  const player = Object.hasOwn(state.players, login) ? state.players[login] : undefined;
  const wait =
    command === "reset"
      ? secondsLeft(player?.lastResetAt ?? null, RESET_COOLDOWN_SECONDS, now)
      : secondsLeft(player?.lastMoveAt ?? null, MOVE_COOLDOWN_SECONDS, now);
  if (wait > 0) return { kind: "rejected", reason: `Slow down: you can ${command} again in ${String(wait)}s.` };

  return { kind: "accepted", command };
}

export function applyCommand(
  state: GameState,
  input: { login: string; command: GameCommand; pose: Pose; now: Date },
): GameState {
  const { login, command, pose, now } = input;
  const at = now.toISOString();
  const previous = Object.hasOwn(state.players, login) ? state.players[login] : undefined;
  const isReset = command === "reset";

  return {
    ...state,
    pose: isReset ? { ...START_POSE } : pose,
    totalMoves: state.totalMoves + 1,
    players: {
      ...state.players,
      [login]: {
        moves: (previous?.moves ?? 0) + 1,
        lastMoveAt: isReset ? (previous?.lastMoveAt ?? null) : at,
        lastResetAt: isReset ? at : (previous?.lastResetAt ?? null),
      },
    },
    recent: [{ login, command, at }, ...state.recent].slice(0, RECENT_LIMIT),
  };
}

export function topPlayers(state: GameState, limit: number): { login: string; moves: number }[] {
  return Object.entries(state.players)
    .map(([login, player]) => ({ login, moves: player.moves }))
    .sort((a, b) => b.moves - a.moves || a.login.localeCompare(b.login))
    .slice(0, limit);
}
