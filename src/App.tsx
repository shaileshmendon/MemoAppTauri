import { useState, useEffect, useCallback, useMemo } from "react";
import { useKeyboardShortcuts } from "./lib/keyboard/useKeyboardShortcuts";
import { SHORTCUTS } from "./lib/keyboard/shortcuts";
import "./index.css";
import Sidebar from "./components/Sidebar";
import MatterList from "./components/MatterList";
import MatterForm from "./components/MatterForm";
import MatterDetail from "./components/MatterDetail";
import MatterTabs from "./components/MatterTabs";
import WorkDone from "./components/WorkDone";
import Invoices from "./components/Invoices";
import type { MatterTab } from "./types";
import Dashboard from "./components/Dashboard";
import OutstandingDues from "./components/OutstandingDues";
import RecordPayment from "./components/RecordPayment";
import ContactList from "./components/ContactList";
import Onboarding from "./components/Onboarding";
import SettingsPage from "./components/SettingsPage";
import AboutModal from "./components/AboutModal";
import ScreenshotHelper from "./components/ScreenshotHelper";
import LockScreen from "./components/LockScreen";
import QuickCapture from "./components/QuickCapture";
import Inbox from "./components/Inbox";
import ShortcutHelpModal from "./components/ShortcutHelpModal";
import ReportsPage from "./components/reports/ReportsPage";
import UpdateModal from "./components/UpdateModal";
import { checkForUpdates, isDueForCheck, CHECK_INTERVAL } from "./lib/updates/updateService";
import type { UpdateInfo } from "./lib/updates/updateService";
import { isProfileSetup, loadProfile, getLock, fetchInboxCount, getSettingValue, setSettingValue } from "./db";
import type { AppLock } from "./db";
import type { Matter, NavSection, Profile } from "./types";

// Sidebar width in px — must match w-52 (13rem = 208px)
const SIDEBAR_W = 208;

export default function App() {
  const [nav, setNav] = useState<NavSection>("matters");
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [matterTab, setMatterTab] = useState<MatterTab>("overview");
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [refreshList, setRefreshList] = useState(0);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [lock, setLock] = useState<AppLock | null | "loading">("loading");
  const [unlocked, setUnlocked] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  /** Invoice ID to auto-expand when the Invoices tab opens after Bill Unbilled Work. */
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  /** Incremented each time ⌘6 is pressed while already on Reports — forces landing page reset */
  const [reportsKey, setReportsKey] = useState(0);
  /** First-run: show keyboard announcement banner once after v1.1 upgrade */
  const [showKeyboardAnnouncement, setShowKeyboardAnnouncement] = useState(false);
  /** Pending update info — set when a newer version is detected */
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    Promise.all([isProfileSetup(), loadProfile(), getLock()]).then(([ready, prof, lk]) => {
      setProfileReady(ready);
      if (prof) setProfile(prof);
      setLock(lk);
      if (!lk) setUnlocked(true);
    });
    fetchInboxCount().then(setInboxCount);
    // First-run keyboard announcement — show once after v1.1 upgrade
    getSettingValue("keyboard_announced").then(v => {
      if (!v) setShowKeyboardAnnouncement(true);
    });

    // Update check on launch (after a short delay so the UI is ready)
    setTimeout(async () => {
      const info = await checkForUpdates();
      if (info) setPendingUpdate(info);
    }, 3000);
  }, []);

  // Periodic 24-hour update check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (await isDueForCheck()) {
        const info = await checkForUpdates();
        if (info) setPendingUpdate(info);
      }
    }, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const dismissKeyboardAnnouncement = () => {
    setShowKeyboardAnnouncement(false);
    setSettingValue("keyboard_announced", "1");
  };

  const refreshInboxCount = useCallback(() => {
    fetchInboxCount().then(setInboxCount);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  // Tab order for ← → cycling
  const MATTER_TABS: MatterTab[] = ["overview", "work_done", "invoices"];

  const cycleTab = useCallback((dir: 1 | -1) => {
    if (!selectedMatter) return;
    const idx = MATTER_TABS.indexOf(matterTab);
    const next = MATTER_TABS[(idx + dir + MATTER_TABS.length) % MATTER_TABS.length];
    handleTabChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatter, matterTab]);

  // Focus the search input on the currently visible list panel
  const focusSearch = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>("[data-search-input]");
    el?.focus();
    el?.select();
  }, []);

  const inMatterView = nav === "matters" && !!selectedMatter && !editing && !isNew;

  const shortcuts = useMemo(() => [
    // Global navigation
    { key: SHORTCUTS.DASHBOARD.key,   handler: () => handleNavChange("dashboard") },
    { key: SHORTCUTS.MATTERS.key,     handler: () => handleNavChange("matters") },
    { key: SHORTCUTS.CLIENTS.key,     handler: () => handleNavChange("clients") },
    { key: SHORTCUTS.FIRMS.key,       handler: () => handleNavChange("firms") },
    { key: SHORTCUTS.OUTSTANDING.key, handler: () => handleNavChange("outstanding") },
    { key: SHORTCUTS.REPORTS.key,     handler: () => { if (nav === "reports") setReportsKey(k => k + 1); else handleNavChange("reports"); } },
    { key: SHORTCUTS.SETTINGS.key,    handler: () => handleNavChange("settings") },
    // Quick Capture + Help
    { key: SHORTCUTS.QUICK_CAPTURE.key, handler: () => setShowCapture(c => !c) },
    { key: SHORTCUTS.HELP.key,          handler: () => setShowHelp(c => !c) },
    // Focus search box
    { key: SHORTCUTS.SEARCH.key, handler: focusSearch },
    // Matter tab switching — ⌘⇧O/W/I (direct)
    {
      key: SHORTCUTS.TAB_OVERVIEW.key,
      handler: () => { if (selectedMatter) handleTabChange("overview"); },
      enabled: !!selectedMatter && nav === "matters",
    },
    {
      key: SHORTCUTS.TAB_WORK_DONE.key,
      handler: () => { if (selectedMatter) handleTabChange("work_done"); },
      enabled: !!selectedMatter && nav === "matters",
    },
    {
      key: SHORTCUTS.TAB_INVOICES.key,
      handler: () => { if (selectedMatter) handleTabChange("invoices"); },
      enabled: !!selectedMatter && nav === "matters",
    },
    // ← → cycle through matter tabs
    { key: SHORTCUTS.TAB_PREV.key, handler: () => cycleTab(-1), enabled: inMatterView },
    { key: SHORTCUTS.TAB_NEXT.key, handler: () => cycleTab(1),  enabled: inMatterView },
    // Esc on Overview deselects the matter and returns to the list
    {
      key: SHORTCUTS.CLOSE.key,
      handler: () => setSelectedMatter(null),
      enabled: !!selectedMatter && nav === "matters" && !editing && !isNew && !showCapture,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedMatter, nav, matterTab, editing, isNew]);

  useKeyboardShortcuts(shortcuts);

  // Called from SettingsPage when user sets/removes lock
  const handleLockChanged = () => {
    getLock().then(lk => { setLock(lk); if (!lk) setUnlocked(true); });
  };

  const handleOnboardingComplete = (p: Profile) => {
    setProfile(p);
    setProfileReady(true);
  };

  const handleProfileSaved = (p: Profile) => {
    setProfile(p);
  };

  const selectMatter = (m: Matter) => {
    setSelectedMatter(m);
    setEditing(false);
    setIsNew(false);
    setNav("matters");
  };

  const openNew = () => {
    setSelectedMatter(null);
    setEditing(false);
    setIsNew(true);
    setNav("matters");
  };

  const handleSaveMatter = (m: Matter) => {
    setSelectedMatter(m);
    setEditing(false);
    setIsNew(false);
    setMatterTab("overview");
    setRefreshList(r => r + 1);
  };

  const handleDeleteMatter = () => {
    setSelectedMatter(null);
    setEditing(false);
    setIsNew(false);
    setRefreshList(r => r + 1);
  };

  const handleNavChange = (n: NavSection) => {
    setNav(n);
    if (n === "matters") setMatterTab("overview");
    setEditing(false);
    setIsNew(false);
  };

  const handleTabChange = (t: MatterTab) => {
    setMatterTab(t);
    setEditing(false);
    setIsNew(false);
  };

  // ── Render the main content panel ───────────────────────────────────────

  const renderContent = () => {
    // Full-page sections (no matter context needed)
    if (nav === "dashboard")      return <Dashboard onEditProfile={() => setNav("settings")} />;
    if (nav === "outstanding")    return <OutstandingDues />;
    if (nav === "record_payment") return <RecordPayment />;
    if (nav === "inbox")          return <Inbox onAssigned={refreshInboxCount} />;
    if (nav === "clients")     return <ContactList type="client" isKeyboardActive={!showCapture} />;
    if (nav === "firms")       return <ContactList type="firm"   isKeyboardActive={!showCapture} />;
    if (nav === "settings")    return <SettingsPage profile={profile} onSaved={handleProfileSaved} onLockChanged={handleLockChanged} />;
    if (nav === "reports")     return <ReportsPage key={reportsKey} />;

    // New matter form
    if (isNew) {
      return (
        <MatterForm
          onSave={handleSaveMatter}
          onCancel={() => setIsNew(false)}
        />
      );
    }

    // No matter selected yet
    if (!selectedMatter) {
      return <EmptyState text="Select a matter or click + to create one" />;
    }

    // Edit form
    if (editing) {
      return (
        <MatterForm
          initial={selectedMatter}
          onSave={handleSaveMatter}
          onCancel={() => setEditing(false)}
        />
      );
    }

    // Tabbed matter view
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MatterTabs
          active={matterTab}
          onChange={handleTabChange}
          matterTitle={selectedMatter.case_title}
        />
        <div className="flex-1 overflow-hidden">
          {matterTab === "overview"     && (
            <MatterDetail
              matter={selectedMatter}
              onEdit={() => setEditing(true)}
              onDelete={handleDeleteMatter}
              onTabChange={handleTabChange}
              onInvoiceCreated={(invoiceId) => {
                setPendingInvoiceId(invoiceId);
                handleTabChange("invoices");
              }}
            />
          )}
          {matterTab === "work_done"    && (
            <WorkDone
              matter={selectedMatter}
              onInvoiceCreated={(invoiceId) => {
                setPendingInvoiceId(invoiceId);
                handleTabChange("invoices");
              }}
            />
          )}
          {matterTab === "invoices"     && (
            <Invoices
              matter={selectedMatter}
              autoExpandId={pendingInvoiceId}
              onAutoExpandConsumed={() => setPendingInvoiceId(null)}
            />
          )}
        </div>
      </div>
    );
  };

  const showMatterList = !["dashboard", "outstanding", "record_payment", "inbox", "clients", "firms", "settings", "reports"].includes(nav);

  // Show splash while checking
  if (profileReady === null || lock === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white text-sm">
        Loading…
      </div>
    );
  }

  // Show lock screen if lock is set and not yet unlocked
  if (lock && !unlocked) {
    return <LockScreen lock={lock} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Drag bar — uses data-tauri-drag-region so macOS handles window dragging
           without the WebView losing keyboard focus (startDragging() API was
           causing the WKWebView to cede OS-level keyboard focus on every click) */}
      <div
        className="h-9 w-full shrink-0 select-none cursor-default"
        style={{
          background: `linear-gradient(to right, #171717 ${SIDEBAR_W}px, #f9fafb ${SIDEBAR_W}px)`,
        }}
        data-tauri-drag-region
      />

      {/* Onboarding overlay */}
      {!profileReady && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {/* About modal */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Quick Capture palette — ⌘K */}
      {showCapture && (
        <QuickCapture
          onClose={() => setShowCapture(false)}
          onSaved={() => { setShowCapture(false); refreshInboxCount(); }}
        />
      )}

      {/* Shortcut Help modal — ⌘/ */}
      {showHelp && <ShortcutHelpModal onClose={() => setShowHelp(false)} />}

      {/* Update available modal */}
      {pendingUpdate && (
        <UpdateModal
          update={pendingUpdate}
          onClose={() => setPendingUpdate(null)}
        />
      )}

      {/* First-run keyboard announcement — shown once after v1.1 upgrade */}
      {showKeyboardAnnouncement && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white rounded-2xl shadow-2xl px-5 py-4 max-w-sm w-full mx-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">⌨️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1">Keyboard shortcuts are here</p>
              <div className="text-xs text-neutral-400 space-y-0.5">
                <p><kbd className="bg-neutral-700 rounded px-1">⌘K</kbd> — Quick Capture</p>
                <p><kbd className="bg-neutral-700 rounded px-1">⌘1–5</kbd> — Navigate sections</p>
                <p><kbd className="bg-neutral-700 rounded px-1">↑↓ Enter</kbd> — Navigate lists</p>
                <p><kbd className="bg-neutral-700 rounded px-1">⌘/</kbd> — Show all shortcuts</p>
              </div>
            </div>
            <button
              onClick={dismissKeyboardAnnouncement}
              className="text-neutral-400 hover:text-white text-xs shrink-0 mt-0.5 px-2 py-1 rounded hover:bg-white/10"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Dev-only screenshot helper — ⌘⇧D to toggle */}
      <ScreenshotHelper />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={nav}
          onChange={handleNavChange}
          onAbout={() => setShowAbout(true)}
          onLock={lock ? () => setUnlocked(false) : undefined}
          inboxCount={inboxCount}
          onQuickCapture={() => setShowCapture(true)}
        />

        {showMatterList && (
          <MatterList
            selectedId={selectedMatter?.id ?? null}
            onSelect={selectMatter}
            onNew={openNew}
            refresh={refreshList}
            isKeyboardActive={
              nav === "matters" &&
              !editing && !isNew && !showCapture &&
              // Disable when inside a matter's Work Done or Invoices tab
              // so their own ↑↓ navigation doesn't conflict with the list
              (matterTab === "overview" || !selectedMatter)
            }
          />
        )}

        <main className="flex-1 overflow-hidden bg-white">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full text-neutral-400 text-sm select-none">
      {text}
    </div>
  );
}
