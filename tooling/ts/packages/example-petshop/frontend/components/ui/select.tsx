import * as React from "react";
// Minimal native <select>: SelectTrigger/SelectContent are fragment passthroughs, SelectItem → <option>,
// SelectValue → a disabled placeholder option. React flattens the fragments into the <select>.
export function Select({ children, onValueChange, defaultValue }: { children?: React.ReactNode; onValueChange?: (v: string) => void; defaultValue?: string }) {
  return <select className="suluk-input" defaultValue={defaultValue ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>;
}
export function SelectTrigger({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
export function SelectValue({ placeholder }: { placeholder?: string }) { return <option value="" disabled hidden>{placeholder}</option>; }
export function SelectContent({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) { return <option value={value}>{children}</option>; }
