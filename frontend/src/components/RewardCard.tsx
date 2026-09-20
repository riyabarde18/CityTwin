import React from 'react';
import { Reward } from '../types';
import { Gift, Lock, Loader2 } from 'lucide-react';

interface RewardCardProps {
  reward: Reward;
  pointsRemaining: number;
  onRedeem: (reward: Reward) => void;
  redeeming: boolean;
}

export const RewardCard: React.FC<RewardCardProps> = ({ reward, pointsRemaining, onRedeem, redeeming }) => {
  const affordable = pointsRemaining >= reward.points_required;

  return (
    <div className={`p-4 rounded-2xl border shadow-sm space-y-3 flex flex-col ${
      affordable ? 'bg-white border-sky-200' : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-xl ${affordable ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-400'}`}>
          <Gift className="w-5 h-5" />
        </div>
        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
          affordable ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-500'
        }`}>
          {reward.points_required} pts
        </span>
      </div>

      <div className="flex-1">
        <h4 className="text-sm font-bold text-navy-900">{reward.name}</h4>
        <p className="text-[11px] text-slate-500 mt-1">{reward.description}</p>
        <p className="text-[10px] text-slate-400 mt-1.5 italic">via {reward.partner}</p>
      </div>

      <button
        onClick={() => onRedeem(reward)}
        disabled={!affordable || redeeming}
        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
          affordable
            ? 'bg-sky-600 text-white hover:bg-sky-700'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        } disabled:opacity-60`}
      >
        {redeeming ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : affordable ? (
          <span>Redeem</span>
        ) : (
          <>
            <Lock className="w-3 h-3" />
            <span>Need {reward.points_required - pointsRemaining} more</span>
          </>
        )}
      </button>
    </div>
  );
};
