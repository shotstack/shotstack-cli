import { Command } from "commander";
import { renderCommand } from "./commands/render.ts";
import { statusCommand } from "./commands/status.ts";
import { feedbackCommand } from "./commands/feedback.ts";
import { studioCommand } from "./commands/studio.ts";
import { ingestCommand } from "./commands/ingest.ts";
import { templateCommand } from "./commands/template.ts";
import { validateCommand } from "./commands/validate.ts";
import { loginCommand, logoutCommand } from "./commands/auth.ts";
import { ApiError } from "./http/client.ts";
import { MissingApiKeyError } from "./http/auth.ts";
import { InvalidEnvError } from "./http/env.ts";
import { version } from "./version.ts";

const program = new Command()
  .name("shotstack")
  .description("Command-line interface for the Shotstack video rendering API")
  .version(version)
  .addCommand(renderCommand)
  .addCommand(statusCommand)
  .addCommand(studioCommand)
  .addCommand(ingestCommand)
  .addCommand(templateCommand)
  .addCommand(validateCommand)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(feedbackCommand);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  process.exit(handleError(err));
}

function handleError(err: unknown): number {
  if (err instanceof MissingApiKeyError || err instanceof InvalidEnvError) {
    console.error(err.message);
    return 1;
  }
  if (err instanceof ApiError) {
    console.error(err.message);
    if (err.body) console.error(typeof err.body === "string" ? err.body : JSON.stringify(err.body));
    return err.isTransient ? 2 : 1;
  }
  if (err instanceof Error) {
    if ("code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(err.message);
      return 1;
    }
    console.error(err.message);
    return 2;
  }
  console.error(String(err));
  return 2;
}
