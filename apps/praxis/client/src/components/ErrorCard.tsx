import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorCard({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="border border-destructive/20 bg-destructive/5 rounded-md p-6 text-center">
      <AlertTriangle size={24} className="mx-auto mb-3 text-destructive/60" />
      <p className="text-sm text-foreground mb-1">
        {message || "Something went wrong."}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Try refreshing the page, or come back in a moment.
      </p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <RefreshCw size={13} />
          Try again
        </Button>
      )}
    </div>
  );
}
