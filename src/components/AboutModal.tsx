import { useState } from "react";
import { X, Mail, Heart } from "lucide-react";
import SupportModal from "./SupportModal";

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}

      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

          {/* Header */}
          <div className="bg-neutral-900 px-8 py-8 text-white text-center relative">
            <button onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <X size={16} />
            </button>
            {/* M icon */}
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-black font-bold text-4xl leading-none">M</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Memo</h1>
            <p className="text-neutral-400 text-sm mt-1">Version 1.0.2</p>
            {/* Free badge */}
            <span className="inline-block mt-2 px-3 py-0.5 bg-white/10 text-white text-xs font-semibold rounded-full tracking-wide">
              Free Forever
            </span>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-4">
            <p className="text-sm text-neutral-600 text-center leading-relaxed">
              Professional billing and matter management for Indian advocates.
              Completely free — all data stays on your device.
            </p>

            <div className="border-t border-neutral-100 pt-4 space-y-2">
              <InfoRow label="Version"    value="1.0.2" />
              <InfoRow label="Platform"   value="macOS (Apple Silicon + Intel)" />
              <InfoRow label="Storage"    value="Local — SQLite (no cloud)" />
              <InfoRow label="Price"      value="₹0 — Free forever" />
            </div>

            {/* Support the developer */}
            <button
              onClick={() => setShowSupport(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors">
              <Heart size={14} fill="white" />
              Support the Developer
            </button>

            {/* Support email */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">Need help? Contact support</p>
              <a
                href="mailto:stripes_swoops_2b@icloud.com"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline">
                <Mail size={13} />
                stripes_swoops_2b@icloud.com
              </a>
            </div>

            <div className="border-t border-neutral-100 pt-2 text-center space-y-1">
              <p className="text-xs text-neutral-400">© {new Date().getFullYear()} Memo. All rights reserved.</p>
              <p className="text-xs text-neutral-400">Made in India 🇮🇳</p>
            </div>
          </div>

          {/* Close */}
          <div className="px-8 pb-6">
            <button onClick={onClose}
              className="w-full py-2.5 text-sm bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 transition-colors font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-700 font-medium text-right max-w-[55%]">{value}</span>
    </div>
  );
}
