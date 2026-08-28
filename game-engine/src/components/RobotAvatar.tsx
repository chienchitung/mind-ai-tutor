import React from 'react';

export const RobotAvatar: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="200" 
      height="200" 
      viewBox="0 0 200 200" 
      className={className}
    >
      <defs>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="1"/>
          <stop offset="100%" stopColor="#0088ff" stopOpacity="0.8"/>
        </radialGradient>
        <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0"/>
          <stop offset="50%" stopColor="#a0a0a0"/>
          <stop offset="100%" stopColor="#808080"/>
        </linearGradient>
        <linearGradient id="faceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#202030"/>
          <stop offset="100%" stopColor="#101020"/>
        </linearGradient>
      </defs>
      <ellipse cx="35" cy="100" rx="15" ry="25" fill="#a0a0a0" stroke="#808080" strokeWidth="1"/>
      <ellipse cx="165" cy="100" rx="15" ry="25" fill="#a0a0a0" stroke="#808080" strokeWidth="1"/>
      <circle cx="100" cy="100" r="75" fill="url(#metalGradient)" stroke="#606060" strokeWidth="2"/>
      <line x1="100" y1="25" x2="100" y2="15" stroke="#808080" strokeWidth="2"/>
      <circle cx="100" cy="10" r="5" fill="#a0a0a0"/>
      <rect x="50" y="60" width="100" height="80" rx="20" ry="20" fill="url(#faceGradient)" stroke="#303040" strokeWidth="1"/>
      <g id="eyes">
        <ellipse cx="75" cy="90" rx="10" ry="15" fill="#00ffff" filter="url(#blueGlow)"/>
        <ellipse cx="125" cy="90" rx="10" ry="15" fill="#00ffff" filter="url(#blueGlow)"/>
      </g>
      <path d="M70,120 Q100,140 130,120" stroke="#00ccff" strokeWidth="3" fill="none" filter="url(#blueGlow)" strokeLinecap="round"/>
    </svg>
  );
}; 