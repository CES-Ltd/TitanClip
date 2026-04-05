import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Crosshair, Plus, Trash2, Star, Users, Zap, Search,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { skillRoutingApi } from "../api/skillRouting";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PROFICIENCY_LABELS, PROFICIENCY_COLORS, SKILL_CATALOG } from "@titanclip/shared";
import type { ProficiencyLevel, TaskSkillRequirement, RoutingCandidate } from "@titanclip/shared";

function ProficiencyStars({ level, size = "sm" }: { level: number; size?: "sm" | "md" }) {
  const s = size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(s, i <= level ? "fill-amber-400 text-amber-400" : "text-zinc-600")} />
      ))}
    </div>
  );
}

function ProficiencyBadge({ level }: { level: ProficiencyLevel }) {
  return (
    <span className={cn("text-[10px] font-semibold", PROFICIENCY_COLORS[level])}>
      {PROFICIENCY_LABELS[level]}
    </span>
  );
}

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-medium w-8 text-right">{score}</span>
    </div>
  );
}

export function SkillRouting() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"matrix" | "router">("matrix");

  // Matrix state
  const [addingSkill, setAddingSkill] = useState<{ agentId: string; agentName: string } | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(3);
  const [skillFilter, setSkillFilter] = useState("");

  // Router state
  const [routerReqs, setRouterReqs] = useState<TaskSkillRequirement[]>([]);
  const [routerSkill, setRouterSkill] = useState("");
  const [routerLevel, setRouterLevel] = useState<ProficiencyLevel>(2);
  const [routerResult, setRouterResult] = useState<{ candidates: RoutingCandidate[]; bestMatch: RoutingCandidate | null } | null>(null);

  const { data: matrix } = useQuery({
    queryKey: queryKeys.skillProficiency.matrix(cid),
    queryFn: () => skillRoutingApi.getMatrix(cid),
    enabled: !!cid,
  });

  const setSkillMut = useMutation({
    mutationFn: ({ agentId, skillName, proficiency }: { agentId: string; skillName: string; proficiency: number }) =>
      skillRoutingApi.setSkill(cid, agentId, skillName, proficiency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skillProficiency.matrix(cid) });
      setAddingSkill(null);
      setNewSkillName("");
      setNewSkillLevel(3);
      pushToast({ title: "Skill updated", tone: "success", ttlMs: 2000 });
    },
  });

  const removeSkillMut = useMutation({
    mutationFn: (skillId: string) => skillRoutingApi.removeSkill(cid, skillId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.skillProficiency.matrix(cid) }),
  });

  const { data: allSkills } = useQuery({
    queryKey: queryKeys.skillProficiency.list(cid),
    queryFn: () => skillRoutingApi.listSkills(cid),
    enabled: !!cid,
  });

  const routeMut = useMutation({
    mutationFn: () => skillRoutingApi.routeTask(cid, routerReqs),
    onSuccess: (result) => setRouterResult(result),
  });

  // Filter skills in matrix
  const filteredSkills = useMemo(() => {
    if (!matrix) return [];
    if (!skillFilter) return matrix.skills;
    return matrix.skills.filter(s => s.toLowerCase().includes(skillFilter.toLowerCase()));
  }, [matrix, skillFilter]);

  // All unique skills for autocomplete
  const allSkillNames = useMemo(() => {
    const fromMatrix = matrix?.skills ?? [];
    const combined = new Set([...fromMatrix, ...SKILL_CATALOG]);
    return [...combined].sort();
  }, [matrix]);

  // Map skill records by agentId+skillName for delete lookup
  const skillRecordMap = useMemo(() => {
    const map = new Map<string, string>(); // "agentId:skillName" -> id
    for (const s of allSkills ?? []) {
      map.set(`${s.agentId}:${s.skillName}`, s.id);
    }
    return map;
  }, [allSkills]);

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Crosshair className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-lg font-semibold">Skill Routing</h1>
            <p className="text-xs text-muted-foreground">Agent skill proficiency and intelligent task assignment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["matrix", "router"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                activeTab === tab ? "bg-primary/10 text-primary border-primary/30 font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}>
              {tab === "matrix" ? "Skill Matrix" : "Smart Router"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Skill Matrix Tab */}
        {activeTab === "matrix" && matrix && (
          <>
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input value={skillFilter} onChange={e => setSkillFilter(e.target.value)}
                  placeholder="Filter skills..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-muted/30 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <span className="text-xs text-muted-foreground">{matrix.agents.length} agents, {matrix.skills.length} skills</span>
            </div>

            {/* Matrix Table */}
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground sticky left-0 bg-muted/20 min-w-[160px]">Agent</th>
                    {filteredSkills.map(skill => (
                      <th key={skill} className="px-3 py-2.5 font-semibold text-muted-foreground text-center min-w-[90px]">
                        <span className="truncate block max-w-[80px]" title={skill}>{skill}</span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.agents.map(agent => (
                    <tr key={agent.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-4 py-2.5 sticky left-0 bg-card">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full",
                            agent.status === "active" ? "bg-emerald-400" : agent.status === "paused" ? "bg-amber-400" : "bg-zinc-400"
                          )} />
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-[10px] text-muted-foreground">{agent.role}</p>
                          </div>
                        </div>
                      </td>
                      {filteredSkills.map(skill => {
                        const level = matrix.matrix[agent.id]?.[skill] ?? 0;
                        return (
                          <td key={skill} className="px-3 py-2.5 text-center">
                            {level > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <ProficiencyStars level={level} />
                                <ProficiencyBadge level={level as ProficiencyLevel} />
                              </div>
                            ) : (
                              <button
                                onClick={() => setSkillMut.mutate({ agentId: agent.id, skillName: skill, proficiency: 1 })}
                                className="text-zinc-700 hover:text-zinc-400 transition-colors"
                                title="Add skill"
                              >
                                <Plus className="h-3 w-3 mx-auto" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5">
                        <button onClick={() => setAddingSkill({ agentId: agent.id, agentName: agent.name })}
                          className="text-muted-foreground hover:text-primary transition-colors" title="Add new skill">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add skill dialog */}
            {addingSkill && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Add Skill to {addingSkill.agentName}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Skill</label>
                    <input list="skill-options" value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="e.g. coding" />
                    <datalist id="skill-options">
                      {allSkillNames.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Proficiency</label>
                    <select value={newSkillLevel} onChange={e => setNewSkillLevel(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                      {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map(l => (
                        <option key={l} value={l}>{l} - {PROFICIENCY_LABELS[l]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button onClick={() => setSkillMut.mutate({ agentId: addingSkill.agentId, skillName: newSkillName, proficiency: newSkillLevel })}
                      disabled={!newSkillName.trim() || setSkillMut.isPending}
                      className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      Add
                    </button>
                    <button onClick={() => setAddingSkill(null)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {matrix.agents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No agents found</p>
              </div>
            )}
          </>
        )}

        {/* Smart Router Tab */}
        {activeTab === "router" && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold">Smart Task Router</h2>
              </div>
              <p className="text-xs text-muted-foreground">Define skill requirements and find the best agent match based on skill fit, availability, workload balance, and cost efficiency.</p>

              {/* Requirements builder */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Skill Requirements</label>
                {routerReqs.map((req, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">{req.skillName}</span>
                    <ProficiencyStars level={req.minProficiency} size="md" />
                    <span className="text-xs text-muted-foreground">min {PROFICIENCY_LABELS[req.minProficiency]}</span>
                    <button onClick={() => setRouterReqs(routerReqs.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}

                <div className="flex items-center gap-2 mt-2">
                  <input list="router-skill-options" value={routerSkill} onChange={e => setRouterSkill(e.target.value)}
                    placeholder="Add required skill..."
                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <datalist id="router-skill-options">
                    {allSkillNames.map(s => <option key={s} value={s} />)}
                  </datalist>
                  <select value={routerLevel} onChange={e => setRouterLevel(Number(e.target.value) as ProficiencyLevel)}
                    className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg">
                    {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map(l => (
                      <option key={l} value={l}>Min: {PROFICIENCY_LABELS[l]}</option>
                    ))}
                  </select>
                  <button onClick={() => {
                    if (routerSkill.trim() && !routerReqs.some(r => r.skillName === routerSkill.trim().toLowerCase())) {
                      setRouterReqs([...routerReqs, { skillName: routerSkill.trim().toLowerCase(), minProficiency: routerLevel }]);
                      setRouterSkill("");
                    }
                  }} className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <button onClick={() => routeMut.mutate()} disabled={routerReqs.length === 0 || routeMut.isPending}
                className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> {routeMut.isPending ? "Routing..." : "Find Best Match"}
              </button>
            </div>

            {/* Results */}
            {routerResult && (
              <div className="space-y-4">
                {/* Best match */}
                {routerResult.bestMatch && (
                  <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-emerald-400">Best Match</h3>
                      <span className="text-xs text-muted-foreground ml-auto">Score: {routerResult.bestMatch.overallScore}/100</span>
                    </div>
                    <CandidateCard candidate={routerResult.bestMatch} isBest />
                  </div>
                )}

                {/* Other candidates */}
                {routerResult.candidates.length > 1 && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Other Candidates ({routerResult.candidates.length - 1})</h3>
                    {routerResult.candidates.slice(1).map((c, i) => (
                      <CandidateCard key={c.agentId} candidate={c} rank={i + 2} />
                    ))}
                  </div>
                )}

                {routerResult.candidates.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <XCircle className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">No available agents found</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CandidateCard({ candidate: c, isBest, rank }: { candidate: RoutingCandidate; isBest?: boolean; rank?: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn("rounded-lg border p-3", isBest ? "border-emerald-500/20" : "border-border/50")}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 text-left">
        {rank && <span className="text-xs font-mono text-muted-foreground w-4">#{rank}</span>}
        <span className={cn("w-2 h-2 rounded-full",
          c.agentStatus === "active" ? "bg-emerald-400" : "bg-amber-400"
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{c.agentName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{c.agentRole}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span>{c.currentTaskCount} active tasks</span>
            <span>Health: {c.healthScore}%</span>
            {c.missingSkills.length > 0 && <span className="text-amber-400">Missing: {c.missingSkills.join(", ")}</span>}
          </div>
        </div>
        <div className="text-right">
          <span className={cn("text-lg font-bold", c.overallScore >= 70 ? "text-emerald-400" : c.overallScore >= 40 ? "text-amber-400" : "text-red-400")}>
            {c.overallScore}
          </span>
          <p className="text-[10px] text-muted-foreground">score</p>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
          <ScoreBar score={c.skillFitScore} label="Skill Fit" color={c.skillFitScore >= 70 ? "bg-emerald-500" : c.skillFitScore >= 40 ? "bg-amber-500" : "bg-red-500"} />
          <ScoreBar score={c.availabilityScore} label="Availability" color="bg-blue-500" />
          <ScoreBar score={c.workloadScore} label="Workload" color="bg-purple-500" />
          <ScoreBar score={c.costScore} label="Cost Eff." color="bg-cyan-500" />

          {c.matchedSkills.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-muted-foreground font-semibold">Matched Skills:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {c.matchedSkills.map(s => (
                  <span key={s.skillName} className={cn("text-[10px] px-1.5 py-0.5 rounded border",
                    s.proficiency >= s.required ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}>
                    {s.skillName} ({s.proficiency}/{s.required})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
