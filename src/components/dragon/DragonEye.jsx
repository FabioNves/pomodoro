"use client";
import React, { useId } from 'react';
import './dragon.css';

export default function DragonEye({ state = 'idle', color = '#45e6cb', motion = true }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 240 160" aria-hidden="true" className={`dragon-eye dragon-eye--${state} ${motion ? '' : 'dragon-eye--still'}`} style={{ '--dragon-color': color }}>
      <defs>
        <radialGradient id={`${id}-iris`}><stop stopColor="#061a22" /><stop offset=".36" stopColor={color} /><stop offset=".7" stopColor="#123640" /><stop offset="1" stopColor="#030d14" /></radialGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor={color} stopOpacity=".24" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}-lid`}><path d="M28 80 Q120 4 212 80 Q120 151 28 80Z" /></clipPath>
      </defs>
      <ellipse cx="120" cy="80" rx="116" ry="76" fill={`url(#${id}-halo)`} />
      <g fill="none" stroke={color}>
        <ellipse className="dragon-orbit" cx="120" cy="80" rx="112" ry="65" strokeOpacity=".3" strokeDasharray="55 12 5 12" />
        <path d="M18 63 35 46 64 43 M176 43 205 46 222 63 M18 98 35 113 64 117 M176 117 205 113 222 98" strokeOpacity=".5" />
      </g>
      <g className="dragon-lids">
        <path d="M28 80 Q120 4 212 80 Q120 151 28 80Z" fill="#051019" stroke={color} strokeWidth="1.8" />
        <g clipPath={`url(#${id}-lid)`}>
          <circle cx="120" cy="80" r="47" fill={`url(#${id}-iris)`} stroke={color} strokeOpacity=".6" />
          <g className="dragon-iris" stroke={color} strokeOpacity=".55">
            {Array.from({ length: 32 }, (_, i) => <path key={i} d="M120 37l2 13-2 8" fill="none" transform={`rotate(${i * 11.25} 120 80)`} />)}
          </g>
          <path className="dragon-pupil" d="M120 37 Q104 80 120 123 Q136 80 120 37" fill="#01070c" />
          <ellipse cx="107" cy="62" rx="5" ry="8" fill="#e3fff9" opacity=".8" transform="rotate(30 107 62)" />
          <path d="M45 78 Q120 33 195 78" stroke="#d5fff7" fill="none" opacity=".13" />
        </g>
      </g>
      <circle cx="17" cy="80" r="3" fill={color} /><circle cx="223" cy="80" r="3" fill={color} />
    </svg>
  );
}
