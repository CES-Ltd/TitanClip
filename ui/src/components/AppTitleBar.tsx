import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Settings, Sun, Moon } from "lucide-react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { useTheme } from "../context/ThemeContext";
import { cn } from "../lib/utils";

const electronAPI = (window as any).electronAPI;
const isMac = electronAPI?.getPlatform?.() === "darwin" || navigator.platform?.startsWith("Mac");

export function AppTitleBar() {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

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

  const btnClass = "w-7 h-7 rounded-md flex items-center justify-center transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800";
  const btnDisabled = "text-zinc-700 cursor-not-allowed";

  return (
    <div
      className="flex items-center h-9 bg-[#09090b] border-b border-border/30 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* macOS traffic light spacer */}
      {isMac && <div className="w-[76px] shrink-0" />}

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5 px-1" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button onClick={handleBack} disabled={!canGoBack}
          className={cn(btnClass, !canGoBack && btnDisabled)} title="Back">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={handleForward} disabled={!canGoForward}
          className={cn(btnClass, !canGoForward && btnDisabled)} title="Forward">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Title — draggable center */}
      <div className="flex-1 text-center">
        <span className="text-[11px] text-zinc-500 font-medium tracking-wide">TitanClip</span>
      </div>

      {/* Right actions: Help, Settings, Theme */}
      <div className="flex items-center gap-0.5 px-2" style={{ WebkitAppRegion: "no-drag" } as any}>
        <Link to="/help" className={cn(btnClass, "gap-1 w-auto px-2")} title="Help & Documentation">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-[11px]">Help</span>
        </Link>

        <Link to="/instance/settings/general" className={btnClass} title="Instance Settings">
          <Settings className="h-3.5 w-3.5" />
        </Link>

        <button onClick={toggleTheme} className={btnClass}
          title={`Switch to ${nextTheme} mode`}>
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Windows title bar overlay spacer */}
      {!isMac && <div className="w-[138px] shrink-0" />}
    </div>
  );
}
