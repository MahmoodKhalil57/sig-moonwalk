import * as React from "react";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} {...props} value={(props.value as string) ?? ""} className="suluk-input" />,
);
Textarea.displayName = "Textarea";
