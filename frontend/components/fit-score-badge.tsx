import { Badge } from "@/components/ui/badge";

export function FitScoreBadge({ score }: { score: number }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";

  if (score >= 80) {
    className = "bg-emerald-500/90 hover:bg-emerald-500 text-white border-emerald-500";
  } else if (score >= 50) {
    className = "bg-amber-500/90 hover:bg-amber-500 text-white border-amber-500";
  } else {
    className = "bg-red-500/90 hover:bg-red-500 text-white border-red-500";
  }

  return (
    <Badge variant="outline" className={className}>
      {score}% Fit
    </Badge>
  );
}
