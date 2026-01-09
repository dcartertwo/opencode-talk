import { cn } from '../../../lib/utils';

interface SuperWhisperIllustrationProps {
  className?: string;
}

export function SuperWhisperIllustration({ className }: SuperWhisperIllustrationProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <svg
        width="160"
        height="120"
        viewBox="0 0 200 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-400 dark:text-gray-500"
      >
        {/* Background circle */}
        <circle
          cx="100"
          cy="70"
          r="50"
          className="fill-gray-100 dark:fill-gray-800"
        />
        
        {/* Microphone body */}
        <rect
          x="85"
          y="45"
          width="30"
          height="45"
          rx="15"
          className="stroke-current"
          strokeWidth="3"
          fill="none"
        />
        
        {/* Microphone grille lines */}
        <line
          x1="90"
          y1="55"
          x2="110"
          y2="55"
          className="stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="90"
          y1="63"
          x2="110"
          y2="63"
          className="stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="90"
          y1="71"
          x2="110"
          y2="71"
          className="stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Microphone stand arc */}
        <path
          d="M75 75 Q75 100 100 100 Q125 100 125 75"
          className="stroke-current"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Microphone stand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="115"
          className="stroke-current"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Microphone base */}
        <line
          x1="85"
          y1="115"
          x2="115"
          y2="115"
          className="stroke-current"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Sound waves - left side */}
        <path
          d="M60 60 Q50 70 60 80"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M50 52 Q35 70 50 88"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M40 44 Q20 70 40 96"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Sound waves - right side */}
        <path
          d="M140 60 Q150 70 140 80"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M150 52 Q165 70 150 88"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M160 44 Q180 70 160 96"
          stroke="#F6821F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Label */}
        <text
          x="100"
          y="138"
          textAnchor="middle"
          className="fill-gray-500 dark:fill-gray-400"
          fontSize="12"
          fontWeight="500"
        >
          SuperWhisper
        </text>
      </svg>
    </div>
  );
}
