import { useState, useRef, useEffect } from "react";
import { Scale, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { verifyLock } from "../db";
import type { AppLock } from "../db";

interface Props {
  lock: AppLock;
  onUnlock: () => void;
}

export default function LockScreen({ lock, onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [shaking, setShaking]   = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError("");
    const ok = await verifyLock(lock.username, password);
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setPassword("");
      setError("Incorrect password. Please try again.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col items-center justify-center select-none">
      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-6 shadow-2xl">
        <Scale size={36} className="text-white" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Memo</h1>
      <p className="text-slate-400 text-sm mb-8">Sign in to continue</p>

      {/* Card */}
      <div className={`bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 w-full max-w-xs shadow-2xl ${shaking ? "animate-shake" : ""}`}>
        <div className="mb-4 text-center">
          <p className="text-white/80 text-sm font-medium">{lock.username}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-blue-400/50 pr-10 transition-colors"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <ShieldAlert size={13} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={!password || checking}
            className="w-full py-3 bg-neutral-900 hover:bg-neutral-1000 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
            {checking ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>

      <p className="text-slate-600 text-xs mt-8">
        Memo · All data stored locally on this Mac
      </p>
    </div>
  );
}
