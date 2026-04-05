import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { cn } from "../lib/utils";

const electronAPI = (window as any).electronAPI;
const isMac = electronAPI?.getPlatform?.() === "darwin" || navigator.platform?.startsWith("Mac");

export function AppTitleBar() {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const update = async () => {
      if (electronAPI?.navCanGoBack) {
        setCanGoBack(await electronAPI.navCanGoBack());
        setCanGoForward(await electronAPI.navCanGoForward());
      } else {
        setCanGoBack(window.history.length > 1);
        setCanGoForward(false);
      }
    };
    update();
  }, [location.pathname]);

  const handleBack = () => {
    if (electronAPI?.navBack) electronAPI.navBack();
    else navigate(-1 as any);
  };

  const handleForward = () => {
    if (electronAPI?.navForward) electronAPI.navForward();
    else navigate(1 as any);
  };

  return (
    <div
      className="flex items-center h-9 bg-[#09090b] border-b border-border/30 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* macOS traffic light spacer */}
      {isMac && <div className="w-[76px] shrink-0" />}

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5 px-1" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
            canGoBack
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              : "text-zinc-700 cursor-not-allowed",
          )}
          title="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
            canGoForward
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              : "text-zinc-700 cursor-not-allowed",
          )}
          title="Forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Title — draggable center */}
      <div className="flex-1 text-center">
        <span className="text-[11px] text-zinc-500 font-medium tracking-wide">TitanClip</span>
      </div>

      {/* Help & Docs */}
      <div className="px-2" style={{ WebkitAppRegion: "no-drag" } as any}>
        <Link
          to="/help"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Help
        </Link>
      </div>

      {/* Windows title bar overlay spacer */}
      {!isMac && <div className="w-[138px] shrink-0" />}
    </div>
  );
}
