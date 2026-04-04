import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { adminSettingsApi } from "../api/adminSettings";
import { useAdminSession } from "../context/AdminSessionContext";

interface AdminPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminPinDialog({ open, onOpenChange }: AdminPinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { unlock } = useAdminSession();

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminSettingsApi.verifyPin(pin);
      unlock(result.token, result.expiresAt);
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.body?.error ?? err?.message ?? "Incorrect PIN";
      setError(msg);
      setPin("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Admin Authentication
          </DialogTitle>
          <DialogDescription>
            Enter your admin PIN to unlock settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="admin-pin">PIN</Label>
            <Input
              ref={inputRef}
              id="admin-pin"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !pin.trim()}>
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
