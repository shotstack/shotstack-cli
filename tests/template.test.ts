import { describe, test, expect } from "bun:test";
import { fetchTemplate, listTemplates, createTemplate, updateTemplate, deleteTemplate } from "../src/commands/template.ts";
import type { Client } from "../src/http/client.ts";

const edit = { timeline: { tracks: [] }, output: { format: "mp4" } };

describe("fetchTemplate", () => {
  test("requests the template by (encoded) id and returns its edit JSON", async () => {
    let requestedPath = "";
    const client = {
      get: async (path: string) => {
        requestedPath = path;
        return { success: true, message: "OK", response: { id: "ab cd", name: "Promo", template: edit } };
      },
    } as unknown as Client;

    const record = await fetchTemplate(client, "ab cd");

    expect(requestedPath).toBe("/templates/ab%20cd");
    expect(record.id).toBe("ab cd");
    expect(record.name).toBe("Promo");
    expect(record.template).toEqual(edit);
  });
});

describe("listTemplates", () => {
  test("GETs /templates and returns the templates array", async () => {
    let requestedPath = "";
    const summaries = [
      { id: "t2", name: "Newer", updated: "2026-02-01" },
      { id: "t1", name: "Older", updated: "2026-01-01" },
    ];
    const client = {
      get: async (path: string) => {
        requestedPath = path;
        return { success: true, message: "OK", response: { owner: "acct", templates: summaries } };
      },
    } as unknown as Client;

    const result = await listTemplates(client);

    expect(requestedPath).toBe("/templates");
    expect(result).toEqual(summaries);
  });
});

describe("createTemplate", () => {
  test("POSTs { name, template } and returns the new id", async () => {
    let captured: { path: string; body: unknown } | undefined;
    const client = {
      post: async (path: string, body: unknown) => {
        captured = { path, body };
        return { success: true, message: "Created", response: { id: "new-id-123" } };
      },
    } as unknown as Client;

    const id = await createTemplate(client, "My Promo", edit);

    expect(captured?.path).toBe("/templates");
    expect(captured?.body).toEqual({ name: "My Promo", template: edit });
    expect(id).toBe("new-id-123");
  });
});

describe("updateTemplate", () => {
  test("PUTs the edit to the (encoded) id, omitting name when not given", async () => {
    let captured: { path: string; body: unknown } | undefined;
    const client = {
      put: async (path: string, body: unknown) => {
        captured = { path, body };
        return { success: true, message: "OK", response: {} };
      },
    } as unknown as Client;

    await updateTemplate(client, "ab cd", edit);

    expect(captured?.path).toBe("/templates/ab%20cd");
    expect(captured?.body).toEqual({ template: edit });
  });

  test("includes name when renaming", async () => {
    let body: unknown;
    const client = {
      put: async (_path: string, b: unknown) => {
        body = b;
        return { success: true, message: "OK", response: {} };
      },
    } as unknown as Client;

    await updateTemplate(client, "id1", edit, "Renamed");

    expect(body).toEqual({ template: edit, name: "Renamed" });
  });
});

describe("deleteTemplate", () => {
  test("DELETEs the (encoded) id", async () => {
    let requestedPath = "";
    const client = {
      del: async (path: string) => {
        requestedPath = path;
        return { success: true, message: "OK", response: { message: "Template Successfully Deleted" } };
      },
    } as unknown as Client;

    await deleteTemplate(client, "ab cd");

    expect(requestedPath).toBe("/templates/ab%20cd");
  });
});
