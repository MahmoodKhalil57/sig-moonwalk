import * as React from "react";
const make = (Tag: keyof JSX.IntrinsicElements, cls: string) =>
  function El({ children, ...rest }: React.HTMLAttributes<HTMLElement>) { return React.createElement(Tag, { className: cls, ...rest }, children); };
export const Table = make("table", "suluk-table");
export const TableHeader = make("thead", "");
export const TableBody = make("tbody", "");
export const TableRow = make("tr", "");
export const TableHead = make("th", "suluk-th");
export const TableCell = make("td", "suluk-td");
