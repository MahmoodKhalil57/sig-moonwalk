import * as React from "react";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} value={(props.value as string) ?? ""} className="suluk-input" />,
);
Input.displayName = "Input";
