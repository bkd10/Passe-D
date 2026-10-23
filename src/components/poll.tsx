"use client";

import { useEffect, useState } from "react";

type PollData = { id: number; question: string; options: string[]; votes: number[] };

export function Poll({ poll }: { poll: PollData }) {
  const [votes, setVotes] = useState(poll.votes);
  const [voted, setVoted] = useState<number | null>(null);
  const [error, setError] = useState("");
  const key = `qs-poll-${poll.id}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) setVoted(Number(v));
    } catch {}
  }, [key]);

  const total = votes.reduce((a, b) => a + b, 0);
  const vote = async (i: number) => {
    setError("");
    const res = await fetch(`/api/poll/${poll.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option: i }),
    });
    if (!res.ok) {
      setError("Vote impossible pour le moment.");
      return;
    }
    const data = await res.json();
    setVotes(data.votes);
    setVoted(i);
    try {
      localStorage.setItem(key, String(i));
    } catch {}
  };

  return (
    <>
      <h3 style={{ textTransform: "none", fontSize: 24 }}>{poll.question}</h3>
      <form onSubmit={(e) => e.preventDefault()}>
        {poll.options.map((o, i) => {
          const pct = total ? Math.round((votes[i] / total) * 100) : 0;
          return (
            <button key={i} type="button" className="poll-option" disabled={voted !== null} onClick={() => vote(i)} aria-pressed={voted === i}>
              {voted !== null && <span className="bar" style={{ width: `${pct}%` }} />}
              <span>{voted === i ? "✓ " : ""}{o}</span>
              {voted !== null && <span className="pct">{pct}%</span>}
            </button>
          );
        })}
      </form>
      <span className="meta">{voted !== null ? `${total} vote${total > 1 ? "s" : ""}. Sondage non scientifique.` : "Votez pour voir les résultats."}</span>
      {error && <span className="form-msg err">{error}</span>}
    </>
  );
}
