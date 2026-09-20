import React, { useState } from 'react';
import { requestOtp, verifyOtp } from '../api';
import { useAuth } from '../context/AuthContext';
import { Phone, ShieldCheck, X, Info } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
}

/**
 * Phone-number registration/login, OTP-based (no password). No SMS gateway
 * is wired up in this build — the backend returns the code directly in dev
 * mode so the flow is demoable end to end; a real deployment would swap
 * that for an actual SMS provider without changing this UI.
 */
export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { setUser } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await requestOtp(phone.trim());
      setDevOtp(res.dev_otp || null);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(phone.trim(), otp.trim());
      setUser(res.user);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1 pt-1">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center mx-auto shadow-md shadow-sky-200">
            {step === 'phone' ? <Phone className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {step === 'phone' ? 'Sign in with your phone' : 'Enter the code'}
          </h2>
          <p className="text-[11px] text-slate-500 px-4">
            {step === 'phone'
              ? 'No password needed. We\'ll send a one-time code to verify it\'s you.'
              : `We sent a code to ${phone}.`}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <input
              type="tel"
              required
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-center tracking-wide"
            />
            {error && <p className="text-[11px] text-rose-600 font-medium text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code"
              className="w-full px-3 py-2.5 text-lg font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-center tracking-[0.4em]"
            />
            {devOtp && (
              <div className="flex items-start space-x-1.5 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Dev mode (no SMS gateway configured): your code is <span className="font-mono font-bold">{devOtp}</span>. In production this would arrive by SMS instead.
                </span>
              </div>
            )}
            {error && <p className="text-[11px] text-rose-600 font-medium text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Verify & continue'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
              className="w-full text-[11px] text-slate-500 hover:text-slate-700 font-medium"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
