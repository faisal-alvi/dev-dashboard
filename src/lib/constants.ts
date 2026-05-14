/** Weekly billable hour target. Adjust here when it changes. */
export const WEEKLY_TARGET_HOURS = 40;

/** Linear workspace slug — used to build ticket URLs from ticket numbers. */
export const LINEAR_WORKSPACE = 'a8c';

/** Local plugins directory path on this machine — used by Copy Path buttons. */
export const PLUGINS_ROOT =
  '/Users/faisalalvi/LocalSites/wpne4/app/public/wp-content/plugins';

/** Build a Linear ticket URL from a ticket number (e.g. WOOACBK-120). */
export function linearUrl(ticket: string): string {
  return `https://linear.app/${LINEAR_WORKSPACE}/issue/${ticket}`;
}

/** Build the local worktree path for a given plugin + ticket. */
export function worktreePath(plugin: string, ticket: string): string {
  return `${PLUGINS_ROOT}/${plugin}/.claude/worktrees/${ticket}`;
}
