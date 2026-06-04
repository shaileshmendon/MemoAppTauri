/**
 * UpdateModal.tsx — "Update Available" notification modal
 *
 * Shown when a newer version is detected via UpdateService.
 * Phase 1: Manual download only — no auto-install.
 *
 * Actions:
 *   Download Update   — opens the download URL in the default browser
 *   Remind Me Later   — snoozes for 24h
 *   Skip This Version — suppresses this version permanently
 */

import { useState } from "react";
import { X, Download, ArrowRight, Clock, SkipForward } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { skipVersion, snoozeReminder } from "../lib/updates/updateService";
import type { UpdateInfo } from "../lib/updates/updateService";
import { format } from "date-fns";

interface Props {
  update:   UpdateInfo;
  onClose:  () => void;
}

export default function UpdateModal({ update, onClose }: Props) {
  const { currentVersion, manifest } = update;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await openUrl(manifest.downloadUrl);
      // Don't auto-close — let the user finish downloading then close manually
    } finally {
      setDownloading(false);
    }
  };

  const handleRemindLater = async () => {
    await snoozeReminder();
    onClose();
  };

  const handleSkip = async () => {
    await skipVersion(manifest.version);
    onClose();
  };

  const releaseDate = (() => {
    try { return format(new Date(manifest.releaseDate), "d MMMM yyyy"); }
    catch { return manifest.releaseDate; }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget && !manifest.mandatory) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-neutral-900 px-6 pt-6 pb-5 relative">
          {!manifest.mandatory && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={15} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-lg leading-none">M</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                Update Available
              </p>
              <h2 className="text-white font-bold text-lg leading-tight">
                Memo {manifest.version}
              </h2>
            </div>
          </div>

          {/* Version comparison */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs bg-white/10 text-neutral-400 rounded-full px-2.5 py-1 font-mono">
              v{currentVersion}
            </span>
            <ArrowRight size={12} className="text-neutral-600" />
            <span className="text-xs bg-blue-500 text-white rounded-full px-2.5 py-1 font-mono font-semibold">
              v{manifest.version}
            </span>
            <span className="text-xs text-neutral-500 ml-1">{releaseDate}</span>
          </div>
        </div>

        {/* Release notes */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            What's New
          </p>
          {manifest.notes.length > 0 ? (
            <ul className="space-y-1.5">
              {manifest.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">No release notes provided.</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          {/* Primary: Download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            <Download size={15} />
            {downloading ? "Opening download…" : `Download Memo ${manifest.version}`}
          </button>

          {!manifest.mandatory && (
            <div className="flex gap-2">
              {/* Remind Later */}
              <button
                onClick={handleRemindLater}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-neutral-200 text-neutral-600 text-xs font-medium rounded-xl hover:bg-neutral-50 transition-colors"
              >
                <Clock size={12} />
                Remind Me Later
              </button>

              {/* Skip This Version */}
              <button
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-neutral-200 text-neutral-400 text-xs font-medium rounded-xl hover:bg-neutral-50 transition-colors"
              >
                <SkipForward size={12} />
                Skip This Version
              </button>
            </div>
          )}

          {manifest.mandatory && (
            <p className="text-center text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              This is a required update. Please download to continue using Memo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
