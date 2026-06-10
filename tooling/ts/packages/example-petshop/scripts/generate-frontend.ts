// Writes the buildApp-generated frontend components to frontend/components/ (the real generator output).
// Run: bun run gen:frontend
import { built } from "../src/app";

const dir = new URL("../frontend/components/", import.meta.url).pathname;
for (const c of built.frontend.components) {
  await Bun.write(`${dir}${c.name}.tsx`, c.tsx);
  console.log("wrote frontend/components/" + c.name + ".tsx");
}
