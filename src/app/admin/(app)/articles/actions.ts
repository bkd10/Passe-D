"use server";

import { redirect } from "next/navigation";
import { actorOf, requireUser } from "@/lib/auth";
import { ArticleError, createArticle } from "@/lib/articles";
import { parseParisLocal } from "@/lib/util";
import type { Status } from "@/db/schema";

export async function createArticleAction(_: { error?: string } | undefined, fd: FormData) {
  const user = await requireUser();
  const actor = actorOf(user);
  let id: number;
  try {
    const assignee = Number(fd.get("assigneeId")) || null;
    const row = await createArticle(actor, {
      title: String(fd.get("title") ?? ""),
      categoryId: Number(fd.get("categoryId")) || null,
      format: String(fd.get("format") ?? "article"),
      module: String(fd.get("module") ?? ""),
      status: (assignee ? "assigned" : String(fd.get("status") ?? "writing")) as Status,
      assigneeId: assignee,
      deadline: parseParisLocal(String(fd.get("deadline") ?? "")),
    });
    id = row.id;
  } catch (e) {
    return { error: e instanceof ArticleError ? e.message : "Création impossible." };
  }
  redirect(`/admin/articles/${id}`);
}
