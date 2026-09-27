export const DESKTOP_APPLICATION_PROCESS_PATTERN =
  "^/Applications/(ChatGPT\\.app/Contents/MacOS/ChatGPT|Codex\\.app/Contents/MacOS/Codex)( |$)";

const desktopApplicationProcessRegex = new RegExp(
  DESKTOP_APPLICATION_PROCESS_PATTERN,
);

export function isDesktopApplicationCommand(command: string): boolean {
  return desktopApplicationProcessRegex.test(command);
}
