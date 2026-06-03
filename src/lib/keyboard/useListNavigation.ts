/**
 * useListNavigation.ts
 *
 * Reusable hook that adds ↑ ↓ Home End Enter keyboard navigation to any list.
 *
 * Works by registering global window handlers (via useKeyboardShortcuts) that
 * are only active when `enabled` is true. The consuming component controls
 * `enabled` based on whether the list panel is the active context.
 *
 * Usage:
 *   const { activeIndex, setActiveIndex, getItemRef, resetActive } =
 *     useListNavigation({
 *       items: filteredMatters,
 *       onActivate: (m) => onSelect(m),
 *       enabled: isKeyboardActive,
 *     });
 *
 *   // In JSX:
 *   {items.map((item, i) => (
 *     <div ref={getItemRef(i)} data-active={activeIndex === i} ...>
 *   ))}
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { SHORTCUTS } from "./shortcuts";

interface Options<T> {
  items: T[];
  onActivate: (item: T) => void;
  enabled: boolean;
}

interface ListNavResult {
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  getItemRef: (index: number) => (el: HTMLElement | null) => void;
  resetActive: () => void;
}

export function useListNavigation<T>({
  items,
  onActivate,
  enabled,
}: Options<T>): ListNavResult {
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Reset active index when items change or navigation disabled
  useEffect(() => {
    if (!enabled) setActiveIndex(-1);
  }, [enabled]);

  // Scroll active item into view whenever it changes
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  const resetActive = useCallback(() => setActiveIndex(-1), []);

  const move = useCallback((delta: number) => {
    if (!enabled || items.length === 0) return;
    setActiveIndex(prev => {
      if (prev === -1) return delta > 0 ? 0 : items.length - 1;
      return Math.max(0, Math.min(items.length - 1, prev + delta));
    });
  }, [enabled, items.length]);

  const jumpTo = useCallback((index: number) => {
    if (!enabled || items.length === 0) return;
    setActiveIndex(Math.max(0, Math.min(items.length - 1, index)));
  }, [enabled, items.length]);

  useKeyboardShortcuts([
    { key: SHORTCUTS.LIST_DOWN.key,  handler: () => move(1),            enabled },
    { key: SHORTCUTS.LIST_UP.key,    handler: () => move(-1),           enabled },
    { key: SHORTCUTS.LIST_FIRST.key, handler: () => jumpTo(0),          enabled },
    { key: SHORTCUTS.LIST_LAST.key,  handler: () => jumpTo(items.length - 1), enabled },
    {
      key: SHORTCUTS.LIST_OPEN.key,
      enabled: enabled && activeIndex >= 0,
      handler: () => {
        if (activeIndex >= 0 && activeIndex < items.length) {
          onActivate(items[activeIndex]);
        }
      },
    },
  ]);

  const getItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  return { activeIndex, setActiveIndex, getItemRef, resetActive };
}
