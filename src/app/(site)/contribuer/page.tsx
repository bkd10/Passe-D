import type { Metadata } from "next";
import { ContributeForm } from "@/components/contribute-form";

export const metadata: Metadata = {
  title: "Contribuer : clubs amateurs",
  description: "Clubs amateurs : envoyez vos résultats, comptes rendus, portraits et histoires à la rédaction de Passe D.",
};

export default function ContributePage() {
  return (
    <div className="wrap">
      <header className="page-head" style={{ ["--cat" as string]: "#5ce1a6" }}>
        <span className="kicker"><span className="dot" />Football amateur</span>
        <h1>Votre club a une histoire</h1>
        <p>Résultats, comptes rendus, portraits d&apos;éducateurs ou de bénévoles, corrections : écrivez à la rédaction. Chaque contribution est vérifiée avant publication.</p>
      </header>
      <div className="contribute">
        <ContributeForm />
      </div>
    </div>
  );
}
