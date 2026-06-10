/**
 * The runnable frontend — composes the GENERATED shadcn components against the live API. Proves the UI corner
 * isn't just generated TSX on disk: it bundles (Bun) and renders, with live data from the same backend.
 */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { PetForm } from "./components/PetForm";
import { PetTable } from "./components/PetTable";
import { CategoryTable } from "./components/CategoryTable";

type Row = Record<string, unknown>;

function useResource(path: string): [Row[], () => void] {
  const [rows, setRows] = React.useState<Row[]>([]);
  const load = React.useCallback(() => { void fetch(path).then((r) => r.json()).then(setRows); }, [path]);
  React.useEffect(() => { load(); }, [load]);
  return [rows, load];
}

function App() {
  const [pets, reloadPets] = useResource("/pet");
  const [categories, reloadCats] = useResource("/category");

  // x-suluk-action ties this button click to the cost the server meters; x-user attributes it (demo only).
  const addPet = async () => {
    await fetch("/pet", { method: "POST", headers: { "content-type": "application/json", "x-suluk-action": "add-pet-button", "x-user": "demo-user" }, body: JSON.stringify({ name: "Pet " + Math.floor(performance.now()) % 1000, status: "available" }) });
    reloadPets();
  };
  const addCat = async () => {
    await fetch("/category", { method: "POST", headers: { "content-type": "application/json", "x-suluk-action": "add-category-button", "x-user": "demo-user" }, body: JSON.stringify({ name: "Category " + Math.floor(performance.now()) % 1000 }) });
    reloadCats();
  };

  return (
    <main>
      <header><b>PETSHOP</b> — generated UI · <a href="/superadmin">superadmin</a> · <a href="/scalar">docs</a></header>
      <section>
        <div className="row"><h2>Pets</h2><button className="suluk-btn" onClick={addPet}>+ pet</button></div>
        <PetTable rows={pets} />
        <h3>Create a pet (generated form)</h3>
        <PetForm />
      </section>
      <section>
        <div className="row"><h2>Categories</h2><button className="suluk-btn" onClick={addCat}>+ category</button></div>
        <CategoryTable rows={categories} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
