"use client";
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal / drawer: role=dialog, aria-modal, focus moves in on open, Tab is trapped inside,
 * Esc closes (and does not also close other Esc handlers such as the tour), focus returns to the
 * element that opened it, and clicking the dim background closes it.
 */
export function ModalShell({ label, onClose, children, align = "right", panelClassName = "" }: { label: string; onClose: () => void; children: ReactNode; align?: "right" | "center"; panelClassName?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const p = panel.current;
    const first = p?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? p)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !p) return;
      const items = [...p.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        p.focus();
        return;
      }
      const a = items[0];
      const z = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === a || active === p)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && active === z) {
        e.preventDefault();
        a.focus();
      } else if (!p.contains(active)) {
        e.preventDefault();
        a.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex ${align === "right" ? "justify-end" : "items-center justify-center p-4"}`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => onCloseRef.current()} aria-hidden />
      <div ref={panel} tabIndex={-1} className={`relative outline-none ${panelClassName}`}>
        {children}
      </div>
    </div>
  );
}
