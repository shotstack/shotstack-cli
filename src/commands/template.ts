import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { createClient, type Client } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";

export interface TemplateRecord {
  id: string;
  name?: string;
  owner?: string;
  // The Edit JSON ({ timeline, output, merge }) — the same shape `render` takes.
  template: unknown;
}

interface TemplateResponse {
  success: boolean;
  message: string;
  response: TemplateRecord;
}

interface CreateResponse {
  success: boolean;
  message: string;
  response: { id: string; message?: string };
}

export interface TemplateSummary {
  id: string;
  name?: string;
  created?: string;
  updated?: string;
}

interface TemplateListResponse {
  success: boolean;
  message: string;
  response: { owner: string; templates: TemplateSummary[] };
}

/**
 * Fetch a saved template by id. Returns the record; `.template` is the Edit
 * JSON, so callers can hand it straight to a render.
 */
export async function fetchTemplate(client: Client, id: string): Promise<TemplateRecord> {
  const result = await client.get<TemplateResponse>(`/templates/${encodeURIComponent(id)}`);
  return result.response;
}

/** List saved templates (metadata only), newest first. */
export async function listTemplates(client: Client): Promise<TemplateSummary[]> {
  const result = await client.get<TemplateListResponse>("/templates");
  return result.response.templates;
}

/** Save an edit as a new template. Returns the new template id. */
export async function createTemplate(client: Client, name: string, edit: unknown): Promise<string> {
  const result = await client.post<CreateResponse>("/templates", { name, template: edit });
  return result.response.id;
}

/** Overwrite a saved template's edit (and optionally rename it). */
export async function updateTemplate(client: Client, id: string, edit: unknown, name?: string): Promise<void> {
  const body: { template: unknown; name?: string } = { template: edit };
  if (name) body.name = name;
  await client.put(`/templates/${encodeURIComponent(id)}`, body);
}

/** Delete a saved template by id. */
export async function deleteTemplate(client: Client, id: string): Promise<void> {
  await client.del(`/templates/${encodeURIComponent(id)}`);
}

async function readEdit(file: string): Promise<unknown> {
  const raw = await readFile(resolve(process.cwd(), file), "utf8");
  return JSON.parse(raw) as unknown;
}

export const templateCommand = new Command("template").description("Work with saved Shotstack templates");

templateCommand
  .command("get <id>")
  .description("Fetch a saved template's Edit JSON by id — pipe it to a file or `shotstack render`")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, options: { env?: string; output: string }) => {
    await withRecording("template get", commandArgv("get"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const record = await fetchTemplate(client, id);
      // Emit the Edit JSON itself (not the API wrapper) so the output is a
      // valid edit that pipes straight into `shotstack render`.
      emit(format, record.template, JSON.stringify(record.template, null, 2));
      return { templateId: record.id, exitCode: 0 };
    });
  });

templateCommand
  .command("list")
  .description("List your saved templates (id and name), newest first")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (options: { env?: string; output: string }) => {
    await withRecording("template list", commandArgv("list"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const templates = await listTemplates(client);
      const human = templates.length
        ? templates.map((t) => `${t.id}  ${t.name ?? ""}`.trimEnd()).join("\n")
        : "No templates found";
      emit(format, templates, human);
      return { count: templates.length, exitCode: 0 };
    });
  });

templateCommand
  .command("create <file>")
  .description("Save an Edit JSON file as a new template; prints the new template id")
  .requiredOption("--name <name>", "Name for the saved template")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { name: string; env?: string; output: string }) => {
    await withRecording("template create", commandArgv("create"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const edit = await readEdit(file);
      const id = await createTemplate(client, options.name, edit);
      emit(format, { id }, id);
      return { templateId: id, exitCode: 0 };
    });
  });

templateCommand
  .command("update <id> <file>")
  .description("Overwrite a saved template with an Edit JSON file")
  .option("--name <name>", "Also rename the template")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, file: string, options: { name?: string; env?: string; output: string }) => {
    await withRecording("template update", commandArgv("update"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const edit = await readEdit(file);
      await updateTemplate(client, id, edit, options.name);
      emit(format, { id, status: "updated" }, `updated ${id}`);
      return { templateId: id, exitCode: 0 };
    });
  });

templateCommand
  .command("delete <id>")
  .description("Delete a saved template")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, options: { env?: string; output: string }) => {
    await withRecording("template delete", commandArgv("delete"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      await deleteTemplate(client, id);
      emit(format, { id, status: "deleted" }, `deleted ${id}`);
      return { templateId: id, exitCode: 0 };
    });
  });
