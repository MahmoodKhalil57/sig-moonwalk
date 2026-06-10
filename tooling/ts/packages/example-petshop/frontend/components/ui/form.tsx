import * as React from "react";
import { FormProvider, Controller, type ControllerProps, type FieldValues } from "react-hook-form";
// shadcn's Form IS react-hook-form's FormProvider; FormField IS Controller.
export const Form = FormProvider;
export function FormField<T extends FieldValues>(props: ControllerProps<T>) { return <Controller {...props} />; }
export function FormItem({ children }: { children: React.ReactNode }) { return <div className="suluk-field">{children}</div>; }
export function FormLabel({ children }: { children: React.ReactNode }) { return <label className="suluk-label">{children}</label>; }
export function FormControl({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function FormMessage() { return null; }
export function FormDescription({ children }: { children: React.ReactNode }) { return <p className="suluk-desc">{children}</p>; }
