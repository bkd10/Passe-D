"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 620 }}>
      <h2>Cette action n&apos;a pas abouti</h2>
      <p>{error.message && !error.message.includes("Server Components") ? error.message : "Vérifiez les champs et vos droits, puis réessayez."}</p>
      <button className="btn dark" onClick={reset}>Réessayer</button>
    </div>
  );
}
