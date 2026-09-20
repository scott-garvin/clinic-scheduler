import type { HelpRequest, HelpRequestInput } from "../shared/kiosk";
import { reactive, toRaw } from "vue";
import { z } from "zod";
import { seed, workspaceSchema, apply, type Command } from "../shared/domain";
const helpCache = "clera.help.v1";
function loadHelp(): HelpRequest[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(helpCache) || "[]");
    return Array.isArray(list)
      ? list.filter(
          (h) =>
            typeof h.id === "string" &&
            typeof h.category === "string" &&
            typeof h.visitId === "string",
        )
      : [];
  } catch {
    return [];
  }
}
const cache = "clera.workspace.v2";
function load() {
  try {
    return workspaceSchema.parse(
      JSON.parse(sessionStorage.getItem(cache) || ""),
    );
  } catch {
    return seed();
  }
}
export const workspace = reactive({
  data: load(),
  helpRequests: loadHelp(),
  mode: "sample" as "sample" | "live",
  key: "",
  busy: false,
  error: "",
  notice: "",
});
export async function request(
  path: string,
  body?: unknown,
  key = workspace.key,
) {
  const r = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(130000),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      "The API is not available here. Open the hosted demo or start the local backend.",
    );
  }
  if (!r.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export async function run(action: () => Promise<void>) {
  if (workspace.busy) return;
  workspace.busy = true;
  workspace.error = "";
  workspace.notice = "";
  try {
    await action();
  } catch (e) {
    workspace.error =
      e instanceof z.ZodError
        ? e.issues[0]?.message || "Check required fields."
        : e instanceof Error
          ? e.message
          : "Please try again.";
  } finally {
    workspace.busy = false;
  }
}
export async function execute(command: Command) {
  workspace.data =
    workspace.mode === "sample"
      ? apply(toRaw(workspace.data), command)
      : workspaceSchema.parse(
          await request("commands", {
            version: workspace.data.version,
            command,
          }),
        );
  if (command.type === "reset") {
    workspace.helpRequests = [];
    try {
      sessionStorage.removeItem(helpCache);
    } catch {}
  }
  if (workspace.mode === "sample")
    try {
      sessionStorage.setItem(cache, JSON.stringify(workspace.data));
    } catch {
      workspace.notice =
        "Browser storage is unavailable. Changes last until reload.";
    }
}
export async function connect(key: string) {
  if (key.startsWith("sk-"))
    throw new Error("Use the Clera demo access key, not your OpenAI key.");
  workspace.data = workspaceSchema.parse(await request("session", {}, key));
  workspace.key = key;
  workspace.mode = "live";
}
export function disconnect() {
  workspace.mode = "sample";
  workspace.key = "";
  workspace.data = load();
  workspace.error = "";
}
export async function refresh() {
  if (workspace.mode === "live")
    workspace.data = workspaceSchema.parse(await request("workspace"));
}

export async function refreshHelp() {
  workspace.helpRequests =
    workspace.mode === "live" ? await request("help-requests") : loadHelp();
}
function saveHelp() {
  try {
    sessionStorage.setItem(helpCache, JSON.stringify(workspace.helpRequests));
  } catch {}
}
export async function requestAssistance(
  input: HelpRequestInput,
): Promise<HelpRequest> {
  if (workspace.mode === "live") {
    const r = await request("help-requests", input);
    await refreshHelp();
    return r;
  }
  const existing = workspace.helpRequests.find(
    (h) => h.visitId === input.visitId && !h.resolvedAt,
  );
  if (existing) return existing;
  if (workspace.helpRequests.length >= 100)
    throw new Error("Reset this demo to clear the help queue.");
  const r: HelpRequest = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  workspace.helpRequests.unshift(r);
  saveHelp();
  return r;
}
export async function resolveAssistance(id: string) {
  if (workspace.mode === "live") {
    await request(`help-requests/${id}/resolve`, {});
    await refreshHelp();
  } else {
    const r = workspace.helpRequests.find((h) => h.id === id);
    if (r) r.resolvedAt = new Date().toISOString();
    saveHelp();
  }
}
