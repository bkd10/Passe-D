import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { ArticleError } from "./articles";

/** Transforme les erreurs connues en réponses JSON lisibles par l'interface. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof AuthError || e instanceof ArticleError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Données invalides : " + e.issues.map((i) => i.path.join(".") + " " + i.message).join(", ") }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur. Réessayez dans un instant." }, { status: 500 });
  });
}
