import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Settings, Sun, Moon, Flame, Power, Sparkles, Home, SquarePen, MessageSquare } from "lucide-react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme, type Theme } from "../context/ThemeContext";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { isElectron } from "../api/ipc-client";

const electronAPI = (window as any).electronAPI;
const platform = electronAPI?.getPlatform?.() ?? (navigator.platform?.startsWith("Mac") ? "darwin" : "other");
const isMac = platform === "darwin";

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "titanclip", icon: Flame, label: "TitanClip" },
];

export function AppTitleBar() {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fun Mode state
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const funModeEnabled = experimentalSettings?.enableFunMode === true;
  const funModeMutation = useMutation({
    mutationFn: () => instanceSettingsApi.updateExperimental({ enableFunMode: !funModeEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings });
    },
  });
  const { theme, setTheme } = useTheme();
  const { openNewIssue } = useDialog();
  const { selectedCompany } = useCompany();
  const prefix = selectedCompany?.issuePrefix?.toLowerCase() ?? "";

  // Sync theme to Electron title bar overlay (Windows)
  useEffect(() => {
    electronAPI?.setTheme?.(theme === "light" ? "light" : "dark");
  }, [theme]);

  // Update nav button state on route change
  useEffect(() => {
    const update = async () => {
      if (isElectron && electronAPI?.navCanGoBack) {
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
    if (isElectron && electronAPI?.navBack) {
      electronAPI.navBack();
    } else {
      navigate(-1);
    }
  };

  const handleForward = () => {
    if (isElectron && electronAPI?.navForward) {
      electronAPI.navForward();
    } else {
      navigate(1);
    }
  };

  const handleQuit = () => {
    if (electronAPI?.quit) {
      electronAPI.quit();
    }
  };

  const btnClass = "w-7 h-7 rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50";
  const btnDisabled = "text-muted-foreground/30 cursor-not-allowed";

  return (
    <div
      className="flex items-center h-9 bg-background border-b border-border shrink-0 select-none"
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

      {/* Center — quick shortcuts */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as any}>
          <Link to={prefix ? `/${prefix}/dashboard` : "/dashboard"} className={cn(btnClass, "gap-1 w-auto px-2")} title="Home">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <button onClick={() => openNewIssue()} className={cn(btnClass, "gap-1 w-auto px-2")} title="New Issue">
            <SquarePen className="h-3.5 w-3.5" />
          </button>
          <Link to="/chat" className={cn(btnClass, "gap-1 w-auto px-2")} title="Chat">
            <MessageSquare className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Right actions: Help, Settings, Theme Switcher, Quit */}
      <div className="flex items-center gap-0.5 px-2" style={{ WebkitAppRegion: "no-drag" } as any}>
        <Link to="/help" className={cn(btnClass, "gap-1 w-auto px-2")} title="Help & Documentation">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-[11px]">Help</span>
        </Link>

        <Link to="/instance/settings/general" className={btnClass} title="Instance Settings">
          <Settings className="h-3.5 w-3.5" />
        </Link>

        {/* 3-segment theme switcher */}
        <div
          className="flex items-center h-7 rounded-md border border-border bg-muted/50 overflow-hidden"
          role="radiogroup"
          aria-label="Theme"
        >
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center justify-center w-7 h-full transition-colors",
                theme === value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Fun Mode toggle */}
        <button
          onClick={() => funModeMutation.mutate()}
          disabled={funModeMutation.isPending}
          className={cn(
            btnClass,
            funModeEnabled
              ? "text-amber-400 hover:text-amber-300"
              : "text-muted-foreground/40 hover:text-muted-foreground"
          )}
          title={funModeEnabled ? "Fun Mode (on)" : "Fun Mode (off)"}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>

        {isElectron && (
          <button onClick={handleQuit} className={cn(btnClass, "hover:text-red-400 hover:bg-red-500/10")}
            title="Quit TitanClip">
            <Power className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Windows title bar overlay spacer */}
      {!isMac && <div className="w-[138px] shrink-0" />}
    </div>
  );
}
