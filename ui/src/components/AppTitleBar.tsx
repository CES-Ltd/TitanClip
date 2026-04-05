import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Link, useLocation } from "@/lib/router";
import { cn } from "../lib/utils";

const electronAPI = (window as any).electronAPI;

export function AppTitleBar() {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const location = useLocation();

  // Update nav state on route change
  useEffect(() => {
    if (!electronAPI?.navCanGoBack) return;
    const update = async () => {
      setCanGoBack(await electronAPI.navCanGoBack());
      setCanGoForward(await electronAPI.navCanGoForward());
    };
    update();
  }, [location.pathname]);

  const handleBack = () => {
    if (electronAPI?.navBack) electronAPI.navBack();
    else window.history.back();
  };

  const handleForward = () => {
    if (electronAPI?.navForward) electronAPI.navForward();
    else window.history.forward();
  };

  return (
    <div className="flex items-center h-9 px-2 bg-[#09090b] border-b border-border/50 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            canGoBack ? "text-muted-foreground hover:text-foreground hover:bg-muted/30" : "text-muted-foreground/30 cursor-not-allowed",
          )}
          title="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            canGoForward ? "text-muted-foreground hover:text-foreground hover:bg-muted/30" : "text-muted-foreground/30 cursor-not-allowed",
          )}
          title="Forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Title (draggable area) */}
      <div className="flex-1 text-center">
        <span className="text-[11px] text-muted-foreground/60 font-medium">TitanClip</span>
      </div>

      {/* Help & Docs */}
      <div style={{ WebkitAppRegion: "no-drag" } as any}>
        <Link
          to="/help"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Help & Docs
        </Link>
      </div>
    </div>
  );
}
