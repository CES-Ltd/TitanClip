/**
 * ElectronMenuProvider — bridges native menu actions to React Router navigation.
 *
 * Listens for "menu:navigate" and "menu:action" IPC events from the main
 * process (triggered by menu items, keyboard shortcuts, tray, deep links)
 * and translates them into React Router navigation or UI actions.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ElectronMenuProviderProps {
  /** Active company prefix for building full paths */
  companyPrefix?: string;
  /** Handler for non-navigation actions (e.g., open-command-palette) */
  onAction?: (action: string) => void;
  children: React.ReactNode;
}

export function ElectronMenuProvider({
  companyPrefix,
  onAction,
  children,
}: ElectronMenuProviderProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    // Handle navigation from native menus, tray, and deep links
    const unsubNav = api.onNavigate?.((path: string) => {
      // Paths from menu are relative (e.g., "/dashboard", "/agents")
      // Prepend the active company prefix if available
      const fullPath = companyPrefix ? `/${companyPrefix}${path}` : path;
      navigate(fullPath);
    });

    // Handle non-navigation actions from native menus
    const unsubAction = api.onMenuAction?.((action: string) => {
      switch (action) {
        case "open-command-palette":
          // Dispatch a keyboard event to trigger the command palette
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            })
          );
          break;

        case "new-issue":
          if (companyPrefix) {
            navigate(`/${companyPrefix}/issues?action=new`);
          }
          break;

        case "import-company":
          if (companyPrefix) {
            navigate(`/${companyPrefix}/settings/import`);
          }
          break;

        case "export-company":
          if (companyPrefix) {
            navigate(`/${companyPrefix}/settings/export`);
          }
          break;

        default:
          onAction?.(action);
          break;
      }
    });

    return () => {
      unsubNav?.();
      unsubAction?.();
    };
  }, [navigate, companyPrefix, onAction]);

  return <>{children}</>;
}
