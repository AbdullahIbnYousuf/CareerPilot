"use client";

interface FitScoreBadgeProps {
  score: number;
  explanation?: string;
}

export function FitScoreBadge({ score, explanation }: FitScoreBadgeProps) {
  const numericScore = typeof score === "number" ? score : (Number(score) || 0);

  let strokeColor = "stroke-[var(--cp-fit-low)]";
  let textColor = "text-[var(--cp-fit-low)]";
  let bgColor = "bg-[rgba(255,107,107,0.10)]";
  let hoverBorder = "group-hover:border-[rgba(255,107,107,0.35)]";

  if (numericScore >= 85) {
    strokeColor = "stroke-[var(--cp-fit-high)]";
    textColor = "text-[var(--cp-fit-high)]";
    bgColor = "bg-[rgba(61,220,151,0.10)]";
    hoverBorder = "group-hover:border-[rgba(61,220,151,0.35)]";
  } else if (numericScore >= 70) {
    strokeColor = "stroke-[var(--cp-champagne)]";
    textColor = "text-[var(--cp-champagne)]";
    bgColor = "bg-[rgba(242,214,162,0.10)]";
    hoverBorder = "group-hover:border-[rgba(242,214,162,0.35)]";
  } else if (numericScore >= 55) {
    strokeColor = "stroke-[var(--cp-fit-good)]";
    textColor = "text-[var(--cp-fit-good)]";
    bgColor = "bg-[rgba(224,164,106,0.10)]";
    hoverBorder = "group-hover:border-[rgba(224,164,106,0.35)]";
  } else if (numericScore >= 40) {
    strokeColor = "stroke-[var(--cp-fit-mid)]";
    textColor = "text-[var(--cp-fit-mid)]";
    bgColor = "bg-[rgba(244,201,93,0.10)]";
    hoverBorder = "group-hover:border-[rgba(244,201,93,0.35)]";
  }

  // SVG parameters for the circular progress
  const radius = 18;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, numericScore)) / 100) * circumference;

  return (
    <div className="relative group inline-flex items-center justify-center cursor-help">
      {/* Badge container */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--cp-border-soft)] transition-all duration-300 ${bgColor} ${hoverBorder}`}>
        {/* SVG Circular Progress */}
        <div className="relative w-9 h-9">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r={radius}
              className="stroke-white/[0.08]"
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
            {numericScore}
          </span>
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>Fit</span>
      </div>

      {/* Premium Tooltip */}
      {explanation && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-64 p-3.5 bg-[#0E0E12]/95 backdrop-blur-md text-white rounded-xl border border-white/[0.08] shadow-xl shadow-black/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 delay-100 flex flex-col gap-1.5 text-left translate-y-1 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold border-b border-white/[0.06] pb-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--cp-copper-strong)] animate-pulse" />
            AI Fit Explanation ({score}%)
          </div>
          <p className="text-xs font-medium leading-relaxed text-white/70">
            {explanation}
          </p>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0E0E12]" />
        </div>
      )}
    </div>
  );
}
