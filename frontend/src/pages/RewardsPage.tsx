import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getPointsSummary, getRewards, redeemReward, getMyRedemptions,
  getVerifiableReports, verifyReport, getCommunityPartners
} from '../api';
import { PointsSummary, Reward, Redemption, VerifiableReport, CommunityPartner } from '../types';
import { LevelProgressBar } from '../components/LevelProgressBar';
import { RewardCard } from '../components/RewardCard';
import { getCategoryMeta } from '../utils/categoryConfig';
import {
  Trophy, CheckCircle2, FileCheck2, Users2, Gift, History, Handshake,
  Wallet, ShieldCheck, MapPin, Loader2
} from 'lucide-react';

const StatTile: React.FC<{ icon: React.ElementType; label: string; value: string | number; accent: string }> = (
  { icon: Icon, label, value, accent }
) => (
  <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-4 flex items-center space-x-3">
    <div className={`p-2.5 rounded-xl ${accent}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-extrabold text-navy-900">{value}</p>
    </div>
  </div>
);

export const RewardsPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [verifiable, setVerifiable] = useState<VerifiableReport[]>([]);
  const [partners, setPartners] = useState<CommunityPartner[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [rewardsData, partnersData, verifiableData] = await Promise.all([
        getRewards(),
        getCommunityPartners(),
        getVerifiableReports(),
      ]);
      setRewards(rewardsData);
      setPartners(partnersData);
      setVerifiable(verifiableData);

      if (user) {
        const [summaryData, redemptionsData] = await Promise.all([
          getPointsSummary(),
          getMyRedemptions(),
        ]);
        setSummary(summaryData);
        setRedemptions(redemptionsData);
      }
    } catch {
      /* backend may still be starting up — sections just render empty */
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleRedeem = async (reward: Reward) => {
    setRedeemingId(reward.id);
    setError(null);
    try {
      await redeemReward(reward.id);
      showToast(`Redeemed "${reward.name}"! Check "My Redeemed Rewards" below.`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Redemption failed.');
    } finally {
      setRedeemingId(null);
    }
  };

  const handleVerify = async (reportId: string) => {
    setVerifyingId(reportId);
    setError(null);
    try {
      await verifyReport(reportId);
      showToast('Confirmed — the reporter just earned +10 points!');
      setVerifiable((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {toast && (
        <div className="fixed top-24 right-6 z-[2000] p-3 rounded-xl shadow-xl bg-emerald-600 text-white text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {!user ? (
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
            <Trophy className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-navy-900">Sign in to start earning points</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Report issues, add evidence, and help verify others' reports to earn points toward real rewards.
            Browse what's redeemable below even before you sign in.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile icon={Trophy} label="Total Earned" value={summary?.total_points_earned ?? '—'} accent="bg-amber-100 text-amber-700" />
            <StatTile icon={Gift} label="Redeemed" value={summary?.points_redeemed ?? '—'} accent="bg-purple-100 text-purple-700" />
            <StatTile icon={Wallet} label="Remaining" value={summary?.points_remaining ?? '—'} accent="bg-sky-100 text-sky-700" />
            <StatTile icon={FileCheck2} label="Verified Reports" value={summary?.verified_reports ?? '—'} accent="bg-emerald-100 text-emerald-700" />
            <StatTile icon={Users2} label="Issues Contributed" value={summary?.issues_contributed ?? '—'} accent="bg-indigo-100 text-indigo-700" />
          </div>

          {/* Level + progress */}
          {summary && <LevelProgressBar summary={summary} />}
        </>
      )}

      {error && <p className="text-xs text-rose-600 font-medium text-center">{error}</p>}

      {/* Community verification panel */}
      {user && (
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-navy-800 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-sky-300" />
            <h3 className="text-xs font-bold text-white">Help Verify Community Reports</h3>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-slate-500 mb-3">
              Confirming someone else's report earns <span className="font-bold text-navy-800">them</span> +10 points — spread out and see something for yourself.
            </p>
            {verifiable.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">No reports awaiting verification right now.</p>
            ) : (
              <div className="space-y-2">
                {verifiable.slice(0, 6).map((r) => {
                  const meta = getCategoryMeta(r.category);
                  return (
                    <div key={r.report_id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${meta.bgColor} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-slate-700 truncate">{r.description}</span>
                      </div>
                      <button
                        onClick={() => handleVerify(r.report_id)}
                        disabled={verifyingId === r.report_id}
                        className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-navy-900 text-white hover:bg-navy-700 disabled:opacity-50 transition"
                      >
                        {verifyingId === r.report_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>Confirm this too</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reward catalog */}
      <div>
        <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center space-x-2">
          <Gift className="w-4 h-4 text-sky-600" />
          <span>Redeem a Reward</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              pointsRemaining={summary?.points_remaining ?? -1}
              onRedeem={handleRedeem}
              redeeming={redeemingId === reward.id}
            />
          ))}
        </div>
      </div>

      {/* Redeemed rewards history */}
      {user && (
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-navy-900 mb-3 flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>My Redeemed Rewards</span>
          </h3>
          {redemptions.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-3">No rewards redeemed yet.</p>
          ) : (
            <div className="space-y-1.5">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg bg-slate-50">
                  <span className="font-semibold text-slate-700">{r.reward_name}</span>
                  <span className="text-slate-400">{r.points_spent} pts · {formatDate(r.redeemed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Community Partners */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-700 rounded-2xl p-5 text-white">
        <div className="flex items-center space-x-2 mb-1.5">
          <Handshake className="w-5 h-5 text-sky-300" />
          <h3 className="text-sm font-bold">Community Partners</h3>
        </div>
        <p className="text-xs text-sky-100/90 mb-4">
          Earn rewards while supporting local businesses. Every voucher redeemed here brings foot traffic to a
          real neighborhood partner — a two-sided benefit for citizens and small businesses alike.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {partners.map((p) => (
            <div key={p.name} className="bg-white/10 border border-white/15 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{p.name}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-300/30">{p.category}</span>
              </div>
              <p className="text-[10px] text-sky-100/70 mt-1 flex items-center space-x-1">
                <MapPin className="w-2.5 h-2.5" />
                <span>{p.offer}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-sky-200/50 mt-3 italic">
          Example partners shown for demo purposes — a live deployment would onboard real local businesses here.
        </p>
      </div>

    </div>
  );
};
