"use client";

interface FitScoreBadgeProps {
  score: number;
  explanation?: string;
}

export function FitScoreBadge({ score, explanation }: FitScoreBadgeProps) {
  // Determine color coding: <40 Red, 40-70 Yellow/Amber, >70 Green/Emerald
  let strokeColor = "stroke-[#EF4444]";
  let textColor = "text-[#EF4444]";
  let bgColor = "bg-[#EF4444]/10";
  let hoverBorder = "group-hover:border-[#EF4444]/30";

  if (score >= 70) {
    strokeColor = "stroke-[#10B981]";
    textColor = "text-[#10B981]";
    bgColor = "bg-[#10B981]/10";
    hoverBorder = "group-hover:border-[#10B981]/30";
  } else if (score >= 40) {
    strokeColor = "stroke-[#F59E0B]";
    textColor = "text-[#F59E0B]";
    bgColor = "bg-[#F59E0B]/10";
    hoverBorder = "group-hover:border-[#F59E0B]/30";
  }

  // SVG parameters for the circular progress
  const radius = 18;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="relative group inline-flex items-center justify-center cursor-help">
      {/* Badge container */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.04] transition-all duration-300 ${bgColor} ${hoverBorder}`}>
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
            {score}
          </span>
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>Fit</span>
      </div>

      {/* Premium Tooltip */}
      {explanation && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-64 p-3.5 bg-[#0E0E12]/95 backdrop-blur-md text-white rounded-xl border border-white/[0.08] shadow-xl shadow-black/50 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 delay-100 flex flex-col gap-1.5 text-left translate-y-1 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold border-b border-white/[0.06] pb-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C74DB] animate-pulse" />
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
