import React, { useState } from 'react';
import type { Profile } from '../services/supabase';
import { useCharacterAvatar } from '../hooks/useCharacterAvatar';
import { useNavigate } from 'react-router-dom';

export interface MiniPipAvatarProps {
  profile?: Profile;
  activeHabitName?: string;
  className?: string;
  onProfileUpdate?: (p: Profile) => void;
  onClick?: () => void;
}

export const MiniPipAvatar: React.FC<MiniPipAvatarProps> = ({
  profile,
  activeHabitName,
  className = '',
  onProfileUpdate,
  onClick,
}) => {
  const { bodyTier, contextState, bmiFormatted } = useCharacterAvatar({
    profile,
    activeHabitName,
  });

  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  const imageSrc = `/assets/character/${bodyTier}_${contextState}.png`;

  const handleClick = () => {
    // Antropometriya faqat Profildagi "Shaxsiy parametrlar"da tahrirlanadi
    if (onClick) onClick();
    else navigate('/profile');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`BMI: ${bmiFormatted}`}
        title={`BMI: ${bmiFormatted}`}
        className={`w-11 h-11 rounded-2xl bg-slate-900 border border-emerald-500/30 overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-md shrink-0 relative group ${className}`}
      >
        {!imageError ? (
          <img
            src={imageSrc}
            alt="Character Avatar"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-950/80">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="11" r="5" className="fill-emerald-400" />
              <path
                d="M8 25 C8 19, 24 19, 24 25 Z"
                className="fill-emerald-500/80"
              />
            </svg>
          </div>
        )}
      </button>

    </>
  );
};
