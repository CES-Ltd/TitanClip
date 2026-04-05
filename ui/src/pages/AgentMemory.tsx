import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Search, Plus, Trash2, Star } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { agentMemoryApi, type AgentMemory as MemoryType } from "../api/agentMemory";

const MEMORY_TYPES = [
  { value: "user_profile", label: "User Profile", color: "text-blue-500 bg-blue-500/10" },
  { value: "preference", label: "Preference", color: "text-purple-500 bg-purple-500/10" },
  { value: "project_context", label: "Project Context", color: "text-green-500 bg-green-500/10" },
  { value: "learned_fact", label: "Learned Fact", color: "text-amber-500 bg-amber-500/10" },
  { value: "entity", label: "Entity", color: "text-slate-400 bg-slate-500/10" },
];

export function AgentMemory() {
  const { agentId } = useParams();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | undefined>();
  const [showAdd, setShowAdd] = useState(false);

  const { data: memories = [] } = useQuery({
    queryKey: ["agent-memories", companyId, agentId, filterType],
    queryFn: () => agentMemoryApi.list(companyId!, agentId!, { type: filterType }),
    enabled: !!companyId && !!agentId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["agent-memory-search", companyId, agentId, searchQuery],
    queryFn: () => agentMemoryApi.search(companyId!, agentId!, searchQuery),
    enabled: !!companyId && !!agentId && searchQuery.length >= 2,
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => agentMemoryApi.remove(agentId!, memoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-memories"] }),
  });

  const displayMemories = searchQuery.length >= 2 ? (searchResults ?? []) : memories;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-500" />
              Agent Memory
            </h1>
            <p className="text-sm text-muted-foreground">{memories.length} memories stored</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" /> Add Memory
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <select
            value={filterType ?? ""}
            onChange={(e) => setFilterType(e.target.value || undefined)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {MEMORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Add Form */}
        {showAdd && companyId && agentId && (
          <AddMemoryForm
            companyId={companyId}
            agentId={agentId}
            onDone={() => {
              setShowAdd(false);
              queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Memory List */}
        <div className="space-y-3">
          {displayMemories.map((mem) => {
            const typeInfo = MEMORY_TYPES.find((t) => t.value === mem.memoryType);
            return (
              <div key={mem.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo?.color ?? "bg-muted text-muted-foreground"}`}>
                        {typeInfo?.label ?? mem.memoryType}
                      </span>
                      {mem.category && (
                        <span className="text-xs text-muted-foreground">{mem.category}</span>
                      )}
                      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < Math.ceil(mem.importance / 2) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="font-medium text-sm">{mem.key}</div>
                    <div className="text-sm text-muted-foreground mt-1">{mem.content}</div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(mem.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {displayMemories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No memories found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMemoryForm({ companyId, agentId, onDone, onCancel }: {
  companyId: string; agentId: string; onDone: () => void; onCancel: () => void;
}) {
  const [type, setType] = useState("learned_fact");
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(5);

  const mutation = useMutation({
    mutationFn: () => agentMemoryApi.create(companyId, agentId, { memoryType: type, key, content, importance }),
    onSuccess: onDone,
  });

  return (
    <div className="rounded-lg border border-purple-500/30 bg-card p-4 space-y-3">
      <h3 className="font-medium">Add Memory</h3>
      <select value={type} onChange={(e) => setType(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
        {MEMORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g., 'preferred_language')"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Memory content..."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-20 resize-none" />
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Importance:</label>
        <input type="range" min="1" max="10" value={importance} onChange={(e) => setImportance(Number(e.target.value))}
          className="flex-1" />
        <span className="text-sm w-6 text-center">{importance}</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-2 rounded-md text-sm hover:bg-accent">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!key || !content || mutation.isPending}
          className="px-3 py-2 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50">
          {mutation.isPending ? "Saving..." : "Save Memory"}
        </button>
      </div>
    </div>
  );
}
