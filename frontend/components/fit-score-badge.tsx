"use client";

interface FitScoreBadgeProps {
  score: number;
  explanation?: string;
}

export function FitScoreBadge({ score, explanation }: FitScoreBadgeProps) {
  // Determine color coding: <40 Red, 40-70 Yellow/Amber, >70 Green/Emerald
  let strokeColor = "stroke-red-500";
  let textColor = "text-red-600 dark:text-red-400";
  let bgColor = "bg-red-50 dark:bg-red-950/20";
  let hoverBorder = "group-hover:border-red-400";

  if (score >= 70) {
    strokeColor = "stroke-emerald-500";
    textColor = "text-emerald-600 dark:text-emerald-400";
    bgColor = "bg-emerald-50 dark:bg-emerald-950/20";
    hoverBorder = "group-hover:border-emerald-400";
  } else if (score >= 40) {
    strokeColor = "stroke-amber-500";
    textColor = "text-amber-600 dark:text-amber-400";
    bgColor = "bg-amber-50 dark:bg-amber-950/20";
    hoverBorder = "group-hover:border-amber-400";
  }

  // SVG parameters for the circular progress
  const radius = 18;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="relative group inline-flex items-center justify-center cursor-help">
      {/* Badge container */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 transition-all duration-300 ${bgColor} ${hoverBorder}`}>
        {/* SVG Circular Progress */}
        <div className="relative w-9 h-9">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              className="stroke-muted/40"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Foreground circle */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              className={`transition-all duration-500 ease-out ${strokeColor}`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          {/* Central percentage number */}
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${textColor}`}>
            {score}
          </span>
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>Fit</span>
      </div>

      {/* Premium Tooltip */}
      {explanation && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-64 p-3 bg-popover text-popover-foreground rounded-lg border border-border shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 delay-100 flex flex-col gap-1 text-left translate-y-1 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold border-b pb-1 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            AI Fit Explanation ({score}%)
          </div>
          <p className="text-xs font-medium leading-normal text-muted-foreground">
            {explanation}
          </p>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
        </div>
      )}
    </div>
  );
}
