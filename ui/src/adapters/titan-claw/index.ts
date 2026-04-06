import { createElement } from "react";
import type { UIAdapterModule, AdapterConfigFieldsProps } from "../types";
import type { TranscriptEntry, CreateConfigValues } from "@titanclip/adapter-utils";

function parseLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", text: line, ts }];
}

function ConfigFields(props: AdapterConfigFieldsProps) {
  const { mode, values, set, config, eff, mark, models } = props;

  if (mode === "create" && values && set) {
    const currentModel = (values as any).model ?? "";
    return createElement("div", { className: "space-y-2" },
      createElement("label", { className: "text-xs text-muted-foreground block mb-1" }, "Model"),
      createElement("select", {
        value: currentModel,
        onChange: (e: any) => set({ model: e.target.value } as any),
        className: "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
      },
        createElement("option", { value: "" }, models.length === 0 ? "Loading models..." : "Select model..."),
        ...models.map((m) =>
          createElement("option", { key: m.id, value: m.id }, m.label || m.id)
        ),
      ),
      createElement("p", { className: "text-[10px] text-muted-foreground" },
        "Models available from enabled HTTP adapters."
      ),
    );
  }

  if (mode === "edit") {
    const currentModel = eff("adapterConfig", "model", (config.model as string) ?? "");
    return createElement("div", { className: "space-y-2" },
      createElement("label", { className: "text-xs text-muted-foreground block mb-1" }, "Model"),
      createElement("select", {
        value: currentModel,
        onChange: (e: any) => mark("adapterConfig", "model", e.target.value),
        className: "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
      },
        createElement("option", { value: "" }, "Select model..."),
        ...models.map((m) =>
          createElement("option", { key: m.id, value: m.id }, m.label || m.id)
        ),
      ),
    );
  }

  return null;
}

function buildConfig(values: CreateConfigValues): Record<string, unknown> {
  return {
    provider: (values as any).provider ?? "",
    model: (values as any).model ?? "",
  };
}

export const titanClawUIAdapter: UIAdapterModule = {
  type: "titanclaw_local",
  label: "TitanClaw",
  parseStdoutLine: parseLine,
  ConfigFields,
  buildAdapterConfig: buildConfig,
};
