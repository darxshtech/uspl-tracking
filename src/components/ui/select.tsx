"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: Record<string, React.ReactNode>;
  registerLabel: (value: string, label: React.ReactNode) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

export function Select({
  value = "",
  onValueChange,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, React.ReactNode>>({});

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback((newOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  }, [isControlled, onOpenChange]);

  const registerLabel = useCallback((val: string, label: React.ReactNode) => {
    setLabels((prev) => {
      // For primitive labels, equality check works perfectly.
      // For complex React elements, to avoid infinite loops, we can also check if it exists or do a shallow compare, 
      // but if we are replacing the label, it's safer to avoid triggering an update if the string representation is identical, 
      // or simply avoid updating if it already exists and is non-null.
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  }, []);

  const contextValue = useMemo(() => ({
    value,
    onValueChange: onValueChange || (() => {}),
    open,
    setOpen,
    labels,
    registerLabel,
  }), [value, onValueChange, open, setOpen, labels, registerLabel]);

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(SelectContext);
  if (!context) throw new Error("SelectTrigger must be used within Select");

  const { open, setOpen } = context;

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <div className="truncate flex-1 text-left">{children}</div>
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

export function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const context = useContext(SelectContext);
  if (!context) throw new Error("SelectValue must be used within Select");

  const { value, labels } = context;
  const displayLabel = value && labels[value] ? labels[value] : null;

  return (
    <span className={cn("block truncate", !displayLabel && "text-slate-400", className)}>
      {displayLabel || placeholder || "Select option..."}
    </span>
  );
}

export function SelectContent({
  className,
  children,
  side,
}: {
  className?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "auto";
}) {
  const context = useContext(SelectContext);
  if (!context) throw new Error("SelectContent must be used within Select");

  const { open, setOpen } = context;
  const ref = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (side === "top") {
      setOpenUpward(true);
    } else if (side === "bottom") {
      setOpenUpward(false);
    } else if (ref.current && ref.current.parentElement) {
      const parentRect = ref.current.parentElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - parentRect.bottom;
      const spaceAbove = parentRect.top;

      // If space below is limited and there is more space above, open upwards
      if (spaceBelow < 230 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        // Only close if click is not inside the trigger button
        const trigger = ref.current.parentElement?.querySelector("button");
        if (trigger && trigger.contains(event.target as Node)) return;
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen, side]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute left-0 z-50 max-h-60 w-full min-w-[8rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-fade-in text-slate-900 ring-1 ring-black/5",
        openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
        !open && "hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(SelectContext);
  if (!context) throw new Error("SelectItem must be used within Select");

  const { value: selectedValue, onValueChange, setOpen, registerLabel } = context;
  const isSelected = selectedValue === value;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    registerLabel(value, children);
  }, [value, registerLabel]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value);
    setOpen(false);
  };

  return (
    <div
      onClick={handleSelect}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-sky-50 hover:text-sky-900 focus:bg-sky-50",
        isSelected ? "bg-sky-50/80 text-sky-600 font-semibold" : "text-slate-700",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-600 ml-2" />}
    </div>
  );
}

export function SelectGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-1", className)}>{children}</div>;
}

export function SelectLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider", className)}>{children}</div>;
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-slate-100", className)} />;
}
