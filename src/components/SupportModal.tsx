/**
 * SupportModal — "Free. Forever." pricing screen with optional developer tip.
 *
 * Tip flow (no server required):
 *   1. User selects an amount.
 *   2. We open a UPI deep-link: upi://pay?pa=<VPA>&am=<amount>&…
 *      macOS routes this to whichever UPI app (GPay, PhonePe, Paytm …)
 *      the user has installed.
 *   3. The payment goes directly to the developer's UPI account —
 *      100% peer-to-peer, no backend needed.
 *
 * ⚙️  To activate tips: replace DEVELOPER_UPI below with your real UPI VPA.
 */
import { useState } from "react";
import { X, Heart, Check, Copy } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

// ── Configuration ─────────────────────────────────────────────────────────────

const DEVELOPER_UPI  = "ssmendon@icici";
const DEVELOPER_NAME = "Memo";
const APP_VERSION    = "1.0.2";

const FREE_FEATURES = [
  "Unlimited matters & clients",
  "PDF invoice generation",
  "GST & TDS support",
  "Appearances & time tracking",
  "Apple Contacts integration",
  "Works fully offline",
  "Backup & restore",
];

const TIP_FEATURES = [
  "Everything in Free",
  "Helps fund new features",
  "Supports indie Mac development",
  "One-time, no recurring charge",
  "100% optional",
];

const TIP_AMOUNTS = [49, 99, 199, 499];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function SupportModal({ onClose }: Props) {
  const [selectedAmount, setSelectedAmount] = useState<number>(99);
  const [customAmount,   setCustomAmount]   = useState("");
  const [isCustom,       setIsCustom]       = useState(false);
  const [sending,        setSending]         = useState(false);
  const [sent,           setSent]            = useState(false);
  const [copied,         setCopied]          = useState(false);

  const finalAmount = isCustom
    ? parseInt(customAmount || "0", 10)
    : selectedAmount;

  const handleSendTip = async () => {
    if (!finalAmount || finalAmount < 1) return;
    setSending(true);
    try {
      // UPI deep-link — opens GPay / PhonePe / Paytm / any UPI app
      const note = encodeURIComponent(`Tip for ${DEVELOPER_NAME} v${APP_VERSION}`);
      const name = encodeURIComponent(DEVELOPER_NAME);
      const upiUrl = `upi://pay?pa=${DEVELOPER_UPI}&pn=${name}&am=${finalAmount}&tn=${note}&cu=INR`;
      await openUrl(upiUrl);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch {
      // Fallback: open mail with tip intent
      const subject = encodeURIComponent(`Tip for Memo v${APP_VERSION}`);
      const body    = encodeURIComponent(`I'd like to send a tip of ₹${finalAmount}. Please share your payment details.`);
      await openUrl(`mailto:${DEVELOPER_UPI}?subject=${subject}&body=${body}`);
    } finally {
      setSending(false);
    }
  };

  const handleCopyUPI = async () => {
    await navigator.clipboard.writeText(DEVELOPER_UPI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-neutral-50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center">
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition-colors">
            <X size={16} />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Pricing</p>
          <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">Free. Forever.</h1>
          <p className="text-neutral-500 mt-3 text-base leading-relaxed max-w-md mx-auto">
            Memo is completely free to use. If it saves you time and you'd
            like to support the developer, a small tip goes a long way.
          </p>
        </div>

        {/* Two cards */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-4">

          {/* Free plan card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400 mb-4">Free Plan</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-neutral-900">₹0</span>
            </div>
            <p className="text-sm text-neutral-400 mb-5">No subscription. No hidden fees.</p>
            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-neutral-700">
                  <Check size={14} className="text-neutral-900 shrink-0" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <div className="flex items-center justify-center gap-2 w-full py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold">
                Download Free
                <span className="text-neutral-400 text-xs font-normal">v{APP_VERSION}</span>
              </div>
            </div>
          </div>

          {/* Support card */}
          <div className="bg-neutral-900 rounded-2xl p-6 flex flex-col text-white">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400 mb-4">Support the Creator</p>

            <div className="text-center mb-2">
              <Heart size={32} className="mx-auto text-white mb-2" fill="white" />
              <p className="text-sm text-neutral-400">A tip — any amount you like.</p>
            </div>

            <ul className="space-y-2 my-4">
              {TIP_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-neutral-300">
                  <Check size={13} className="text-neutral-400 shrink-0" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>

            {/* Amount selector */}
            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {TIP_AMOUNTS.map(amt => (
                  <button key={amt} type="button"
                    onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                    className={`py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      !isCustom && selectedAmount === amt
                        ? "bg-white text-neutral-900 border-white"
                        : "bg-white/10 text-neutral-300 border-white/10 hover:bg-white/20"
                    }`}>
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setIsCustom(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors shrink-0 ${
                    isCustom
                      ? "bg-white text-neutral-900 border-white"
                      : "bg-white/10 text-neutral-300 border-white/10 hover:bg-white/20"
                  }`}>
                  Custom
                </button>
                {isCustom && (
                  <div className="flex-1 flex items-center bg-white/10 border border-white/10 rounded-lg px-2 py-1.5">
                    <span className="text-neutral-400 text-sm mr-1">₹</span>
                    <input
                      type="number" min="1" max="10000"
                      className="flex-1 bg-transparent text-white text-sm outline-none w-full"
                      placeholder="Amount"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Send button */}
              <button
                type="button"
                onClick={handleSendTip}
                disabled={sending || !finalAmount || finalAmount < 1}
                className="w-full py-3 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {sending ? "Opening payment…" : sent ? "✓ Payment app opened!" : `Send a Tip — ₹${finalAmount || "?"}`}
              </button>

              {/* UPI ID copy fallback */}
              <button type="button" onClick={handleCopyUPI}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy UPI ID</>}
              </button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-neutral-400">
            You can send a tip anytime from within the app via{" "}
            <strong className="text-neutral-600">About → Support the Developer</strong>.
            Every tip is deeply appreciated and helps keep Memo free for everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
