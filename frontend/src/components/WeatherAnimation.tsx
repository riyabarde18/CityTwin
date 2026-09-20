import React, { useEffect, useState } from 'react';
import { getEscalations } from '../api';

type SkyMood = 'dawn' | 'day' | 'dusk' | 'night';
type WeatherOverlay = 'clear' | 'windy' | 'rain';

const getSkyMood = (hour: number): SkyMood => {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
};

/**
 * A light, ambient hero animation — not decoration for its own sake: the
 * sun/moon reflects the actual time of day, and a storm overlay only
 * appears when there's a real active weather-risk escalation (fed by NOAA
 * via risk_escalation.py), so the sky on this page tracks the same signal
 * the Department Inbox is acting on.
 */
export const WeatherAnimation: React.FC = () => {
  const [mood] = useState<SkyMood>(() => getSkyMood(new Date().getHours()));
  const [overlay, setOverlay] = useState<WeatherOverlay>('clear');

  useEffect(() => {
    let cancelled = false;
    getEscalations({ acknowledged: false })
      .then((escalations) => {
        if (cancelled) return;
        if (escalations.some((e) => e.risk_level === 'severe')) setOverlay('rain');
        else if (escalations.some((e) => e.risk_level === 'elevated')) setOverlay('windy');
      })
      .catch(() => { /* no active escalations reachable — default to clear sky */ });
    return () => { cancelled = true; };
  }, []);

  // Fixed brand navy (#151B54) rather than a time-of-day color range — the
  // sun/moon/cloud/rain elements below still vary with time and weather,
  // but the backdrop itself stays this one consistent color.
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #151B54, #0f1440)' }}
      aria-hidden="true"
    >
      {/* Stars — night only */}
      {mood === 'night' && (
        <div className="absolute inset-0">
          {[...Array(18)].map((_, i) => (
            <span
              key={i}
              className="weather-star absolute rounded-full bg-white"
              style={{
                width: `${1 + (i % 3)}px`,
                height: `${1 + (i % 3)}px`,
                top: `${(i * 37) % 70}%`,
                left: `${(i * 53) % 95}%`,
                animationDelay: `${(i % 5) * 0.6}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Sun / Moon */}
      <div
        className={`weather-sun absolute rounded-full ${
          mood === 'night' ? 'bg-slate-200/90' : 'bg-gradient-to-br from-amber-200 to-amber-400'
        }`}
        style={{
          width: '72px', height: '72px',
          top: mood === 'night' ? '14%' : '10%',
          right: '12%',
          boxShadow: mood === 'night' ? '0 0 30px 6px rgba(226,232,240,0.35)' : '0 0 45px 12px rgba(251,191,36,0.35)',
        }}
      >
        {mood !== 'night' && (
          <svg className="weather-sun-rays absolute -inset-3" viewBox="0 0 100 100">
            {[...Array(8)].map((_, i) => (
              <line
                key={i}
                x1="50" y1="4" x2="50" y2="14"
                stroke="rgba(251,191,36,0.55)" strokeWidth="3" strokeLinecap="round"
                transform={`rotate(${i * 45} 50 50)`}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Drifting clouds */}
      <div className="weather-cloud-1 absolute top-[22%] left-[8%] opacity-90">
        <CloudShape tone={mood === 'night' ? 'dark' : 'light'} />
      </div>
      <div className="weather-cloud-2 absolute top-[38%] left-[40%] scale-75 opacity-70">
        <CloudShape tone={mood === 'night' ? 'dark' : 'light'} />
      </div>
      {overlay !== 'clear' && (
        <div className="weather-cloud-1 absolute top-[15%] left-[55%] scale-90 opacity-95">
          <CloudShape tone="storm" />
        </div>
      )}

      {/* Rain */}
      {overlay === 'rain' && (
        <div className="absolute top-[24%] left-[52%] w-40 h-16">
          {[...Array(10)].map((_, i) => (
            <span
              key={i}
              className="weather-raindrop absolute w-[2px] h-3 bg-sky-200/80 rounded-full"
              style={{ left: `${i * 10}%`, animationDelay: `${(i % 5) * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {/* Wind lines */}
      {overlay !== 'clear' && (
        <div className="absolute bottom-[18%] left-0 w-full h-10">
          {[...Array(4)].map((_, i) => (
            <span
              key={i}
              className="weather-wind-line absolute h-[2px] w-16 bg-white/40 rounded-full"
              style={{ top: `${i * 9}px`, animationDelay: `${i * 0.5}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CloudShape: React.FC<{ tone: 'light' | 'dark' | 'storm' }> = ({ tone }) => {
  const fill = tone === 'storm' ? '#334155' : tone === 'dark' ? '#475569' : '#ffffff';
  const opacity = tone === 'light' ? 0.9 : 0.75;
  return (
    <svg width="110" height="46" viewBox="0 0 110 46" style={{ opacity }}>
      <ellipse cx="30" cy="30" rx="26" ry="16" fill={fill} />
      <ellipse cx="55" cy="20" rx="22" ry="20" fill={fill} />
      <ellipse cx="80" cy="30" rx="24" ry="15" fill={fill} />
      <rect x="20" y="26" width="70" height="16" rx="8" fill={fill} />
    </svg>
  );
};
