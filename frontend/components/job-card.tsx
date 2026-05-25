import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FitScoreBadge } from "./fit-score-badge";
import { MapPin, Building, ExternalLink } from "lucide-react";
import type { Job } from "@/types";

export function JobCard({ job }: { job: Job }) {
  return (
    <Card className="flex flex-col h-full hover:border-primary/50 transition-colors duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight line-clamp-2">
              {job.title}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.company || "Unknown"}</span>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.location || "N/A"}</span>
              </span>
            </CardDescription>
          </div>
          {job.fit_score !== undefined && job.fit_score > 0 && (
            <FitScoreBadge score={job.fit_score} />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <p className="text-sm text-muted-foreground line-clamp-4">
          {job.description}
        </p>
        {job.fit_explanation && (
          <div className="mt-3 p-2.5 bg-muted/50 rounded-md text-xs italic border-l-4 border-primary/60">
            &ldquo;{job.fit_explanation}&rdquo;
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t pt-4 mt-auto">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {job.source}
        </span>
        <Button asChild variant="outline" size="sm">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            Apply <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
