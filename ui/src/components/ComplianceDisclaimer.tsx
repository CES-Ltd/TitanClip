/**
 * ComplianceDisclaimer — legal-grade compliance notice for dangerous settings.
 *
 * Displayed next to any toggle that can compromise security, violate org policy,
 * or enable unrestricted agent capabilities.
 */

import { AlertTriangle, ShieldAlert, FlaskConical } from "lucide-react";
import { cn } from "../lib/utils";

interface ComplianceDisclaimerProps {
  severity: "danger" | "warning" | "beta";
  className?: string;
}

const DANGER_TEXT = `COMPLIANCE NOTICE: Enabling this feature may violate your organization's security policies, acceptable use policies, and regulatory compliance requirements. By enabling this setting, you acknowledge that:

1. You have obtained explicit written authorization from your organization's authorized representative (CISO, CTO, or equivalent authority)
2. You accept full responsibility for any security incidents, data breaches, or policy violations that may result from this configuration change
3. This change will be permanently recorded in the audit log with your identity and timestamp
4. Your organization's IT security team has been notified of this configuration change

Unauthorized modification of security settings may result in disciplinary action including termination and potential legal liability. If you are unsure whether you have the authority to make this change, do not proceed and consult your organization's security team.`;

const WARNING_TEXT = `NOTICE: This setting modifies system behavior in ways that may affect security, data integrity, or operational stability. Changes are logged in the audit trail. Ensure you have the appropriate authorization before making modifications.`;

const BETA_TEXT = `BETA FEATURE NOTICE: This feature is in active development and has not completed full security review. Enabling beta features in a production environment may introduce instability, unexpected behavior, or security gaps. By enabling this feature, you acknowledge the associated risks and agree to report any issues to your system administrator. Use of beta features in regulated environments may require additional compliance review.`;

export function ComplianceDisclaimer({ severity, className }: ComplianceDisclaimerProps) {
  const config = {
    danger: {
      icon: ShieldAlert,
      text: DANGER_TEXT,
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/5",
      iconColor: "text-red-500",
      textColor: "text-red-400/80",
      labelColor: "text-red-500",
      label: "Compliance Notice",
    },
    warning: {
      icon: AlertTriangle,
      text: WARNING_TEXT,
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
      iconColor: "text-amber-500",
      textColor: "text-amber-400/80",
      labelColor: "text-amber-500",
      label: "Notice",
    },
    beta: {
      icon: FlaskConical,
      text: BETA_TEXT,
      borderColor: "border-indigo-500/30",
      bgColor: "bg-indigo-500/5",
      iconColor: "text-indigo-500",
      textColor: "text-indigo-400/70",
      labelColor: "text-indigo-500",
      label: "Beta Feature Notice",
    },
  }[severity];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 mt-3",
        config.borderColor,
        config.bgColor,
        className
      )}
    >
      <div className="flex gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.iconColor)} />
        <div>
          <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", config.labelColor)}>
            {config.label}
          </div>
          <p className={cn("text-[11px] leading-relaxed whitespace-pre-line", config.textColor)}>
            {config.text}
          </p>
        </div>
      </div>
    </div>
  );
}
