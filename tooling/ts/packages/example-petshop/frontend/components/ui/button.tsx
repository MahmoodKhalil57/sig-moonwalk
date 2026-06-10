import * as React from "react";
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={"suluk-btn " + (props.className ?? "")} />;
}
