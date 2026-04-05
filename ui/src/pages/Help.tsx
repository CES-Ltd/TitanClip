import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Search, X, ChevronRight, ChevronDown } from "lucide-react";
import { HELP_CATEGORIES, HELP_TOPICS, type HelpTopic } from "../help/content";
import { cn } from "../lib/utils";

export function Help() {
  const { topicId } = useParams<{ topicId?: string }>();
  const [selectedId, setSelectedId] = useState<string>(topicId ?? "overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (topicId) setSelectedId(topicId);
  }, [topicId]);

  // Search filtering
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return HELP_TOPICS;
    const q = searchQuery.toLowerCase();
    return HELP_TOPICS.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q)) ||
      t.content.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, HelpTopic[]>();
    for (const cat of HELP_CATEGORIES) map.set(cat, []);
    for (const topic of filteredTopics) {
      const list = map.get(topic.category);
      if (list) list.push(topic);
    }
    return map;
  }, [filteredTopics]);

  const selectedTopic = HELP_TOPICS.find((t) => t.id === selectedId);

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Simple markdown-like rendering (bold, headers, lists)
  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        return <h3 key={i} className="text-sm font-semibold mt-4 mb-2">{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return <p key={i} className="text-sm font-semibold mt-3 mb-1">{trimmed.slice(2, -2)}</p>;
      }
      if (trimmed.startsWith("- ")) {
        const text = trimmed.slice(2);
        return (
          <div key={i} className="flex items-start gap-2 ml-2 my-0.5">
            <span className="text-muted-foreground mt-1.5">•</span>
            <span className="text-sm text-foreground/80">{renderInline(text)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+)\.\s/)?.[1];
        const text = trimmed.replace(/^\d+\.\s/, "");
        return (
          <div key={i} className="flex items-start gap-2 ml-2 my-0.5">
            <span className="text-muted-foreground text-xs font-mono mt-0.5 w-4 shrink-0">{num}.</span>
            <span className="text-sm text-foreground/80">{renderInline(text)}</span>
          </div>
        );
      }
      if (trimmed === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-foreground/80 my-0.5">{renderInline(trimmed)}</p>;
    });
  }

  function renderInline(text: string) {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="flex h-[calc(100vh-2.25rem)] bg-background">
      {/* Left: Navigation */}
      <div className="w-[260px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          <h1 className="text-sm font-semibold">Help & Documentation</h1>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-muted/30 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              {filteredTopics.length} result{filteredTopics.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Topic Navigation */}
        <div className="flex-1 overflow-y-auto py-1">
          {[...grouped.entries()].map(([category, topics]) => {
            if (topics.length === 0) return null;
            const isCollapsed = collapsedCategories.has(category);
            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {category}
                </button>
                {!isCollapsed && topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedId(topic.id)}
                    className={cn(
                      "w-full text-left px-4 pl-7 py-1.5 text-xs transition-colors",
                      selectedId === topic.id
                        ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedTopic ? (
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4">
              <span>Help</span>
              <ChevronRight className="h-3 w-3" />
              <span>{selectedTopic.category}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{selectedTopic.title}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold mb-1">{selectedTopic.title}</h1>
            <p className="text-xs text-muted-foreground mb-6">{selectedTopic.category}</p>

            {/* Content */}
            <div className="space-y-0.5">
              {renderContent(selectedTopic.content)}
            </div>

            {/* Related topics */}
            {(() => {
              const related = HELP_TOPICS.filter(
                (t) => t.category === selectedTopic.category && t.id !== selectedTopic.id
              ).slice(0, 4);
              if (related.length === 0) return null;
              return (
                <div className="mt-10 pt-6 border-t border-border/30">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Related Topics</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedId(r.id); window.scrollTo(0, 0); }}
                        className="text-left px-3 py-2 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <p className="text-xs font-medium">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{r.category}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">Select a topic to view help</p>
          </div>
        )}
      </div>
    </div>
  );
}
