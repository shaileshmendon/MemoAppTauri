import { useState, useEffect } from "react";
import { Shield, ShieldOff, ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";
import { getLock, setLock, removeLock, verifyLock } from "../db";
import type { AppLock } from "../db";

interface Props {
  onLockChanged: () => void; // tells App.tsx to re-check lock state
}

export default function LockSettings({ onLockChanged }: Props) {
  const [lock, setLockState]   = useState<AppLock | null>(null);
  const [mode, setMode]        = useState<"view" | "set" | "change" | "remove">("view");
  const [loading, setLoading]  = useState(true);
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState("");
  const [success, setSuccess]  = useState("");

  // Form fields
  const [username, setUsername]   = useState("");
  const [current, setCurrent]     = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);

  useEffect(() => {
    getLock().then(l => { setLockState(l); setLoading(false); });
  }, []);

  const reset = () => {
    setMode("view"); setError(""); setUsername(""); setCurrent(""); setNewPw(""); setConfirm(""); setShowPw(false);
  };

  const flash = (msg: string) => {
    setSuccess(msg); setTimeout(() => setSuccess(""), 3000);
  };

  const handleSet = async () => {
    if (!username.trim())       return setError("Username is required.");
    if (newPw.length < 6)       return setError("Password must be at least 6 characters.");
    if (newPw !== confirm)      return setError("Passwords do not match.");
    setSaving(true);
    await setLock(username.trim(), newPw);
    const updated = await getLock();
    setLockState(updated);
    onLockChanged();
    setSaving(false);
    reset();
    flash("App lock enabled.");
  };

  const handleChange = async () => {
    if (!lock) return;
    const ok = await verifyLock(lock.username, current);
    if (!ok) return setError("Current password is incorrect.");
    if (newPw.length < 6) return setError("New password must be at least 6 characters.");
    if (newPw !== confirm) return setError("Passwords do not match.");
    setSaving(true);
    await setLock(lock.username, newPw);
    const updated = await getLock();
    setLockState(updated);
    onLockChanged();
    setSaving(false);
    reset();
    flash("Password updated.");
  };

  const handleRemove = async () => {
    if (!lock) return;
    const ok = await verifyLock(lock.username, current);
    if (!ok) return setError("Password is incorrect.");
    setSaving(true);
    await removeLock();
    setLockState(null);
    onLockChanged();
    setSaving(false);
    reset();
    flash("App lock removed.");
  };

  const inp = "w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 transition-colors";
  const lbl = "block text-xs font-medium text-neutral-600 mb-1";

  if (loading) return null;

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      {/* Header status */}
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
          lock ? "bg-green-100" : "bg-neutral-100"
        }`}>
          {lock
            ? <ShieldCheck size={18} className="text-green-600" />
            : <ShieldOff   size={18} className="text-neutral-400" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-800">App Lock</p>
          {lock ? (
            <p className="text-xs text-neutral-500 mt-0.5">
              Enabled — signed in as <span className="font-medium text-neutral-700">{lock.username}</span>.
              The app will require a password when opened.
            </p>
          ) : (
            <p className="text-xs text-neutral-500 mt-0.5">
              Disabled — anyone who opens the app can access your data.
              Enable a lock to protect client information.
            </p>
          )}
        </div>
        {mode === "view" && (
          <div className="flex gap-2 shrink-0">
            {lock ? (
              <>
                <button onClick={() => setMode("change")}
                  className="px-3 py-1.5 text-xs border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors">
                  Change Password
                </button>
                <button onClick={() => setMode("remove")}
                  className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                  Remove Lock
                </button>
              </>
            ) : (
              <button onClick={() => setMode("set")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium">
                <Lock size={12} /> Enable Lock
              </button>
            )}
          </div>
        )}
      </div>

      {/* Forms */}
      {mode !== "view" && (
        <div className="border-t border-neutral-100 px-5 py-4 space-y-3 bg-neutral-50">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            {mode === "set"    ? "Set App Lock"      :
             mode === "change" ? "Change Password"   :
                                 "Remove App Lock"}
          </p>

          {/* Set lock */}
          {mode === "set" && (
            <>
              <div>
                <label className={lbl}>Username</label>
                <input className={inp} placeholder="e.g. Priya Sharma"
                  value={username} onChange={e => { setUsername(e.target.value); setError(""); }} />
              </div>
              <div>
                <label className={lbl}>Password (min. 6 characters)</label>
                <PasswordInput value={newPw} onChange={v => { setNewPw(v); setError(""); }}
                  show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="New password" />
              </div>
              <div>
                <label className={lbl}>Confirm Password</label>
                <PasswordInput value={confirm} onChange={v => { setConfirm(v); setError(""); }}
                  show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Repeat password" />
              </div>
            </>
          )}

          {/* Change password */}
          {mode === "change" && (
            <>
              <div>
                <label className={lbl}>Current Password</label>
                <PasswordInput value={current} onChange={v => { setCurrent(v); setError(""); }}
                  show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Current password" />
              </div>
              <div>
                <label className={lbl}>New Password</label>
                <PasswordInput value={newPw} onChange={v => { setNewPw(v); setError(""); }}
                  show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="New password" />
              </div>
              <div>
                <label className={lbl}>Confirm New Password</label>
                <PasswordInput value={confirm} onChange={v => { setConfirm(v); setError(""); }}
                  show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Repeat new password" />
              </div>
            </>
          )}

          {/* Remove lock */}
          {mode === "remove" && (
            <div>
              <label className={lbl}>Enter your password to confirm removal</label>
              <PasswordInput value={current} onChange={v => { setCurrent(v); setError(""); }}
                show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Password" />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Shield size={12} /> {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={mode === "set" ? handleSet : mode === "change" ? handleChange : handleRemove}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 transition-colors ${
                mode === "remove" ? "bg-red-600 hover:bg-red-700" : "bg-neutral-900 hover:bg-neutral-800"
              }`}>
              {saving ? "Saving…" :
               mode === "set"    ? "Enable Lock" :
               mode === "change" ? "Update Password" :
                                   "Remove Lock"}
            </button>
            <button onClick={reset}
              className="px-4 py-2 text-sm border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="px-5 py-3 bg-green-50 border-t border-green-100 text-xs text-green-700 font-medium flex items-center gap-2">
          <ShieldCheck size={13} /> {success}
        </div>
      )}
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 pr-9 transition-colors"
        placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}
