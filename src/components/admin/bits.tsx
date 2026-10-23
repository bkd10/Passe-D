import Link from "next/link";
import type { Status } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/util";

export function StatusPill({ s }: { s: Status }) {
  return <span className={`st st-${s}`}>{STATUS_LABELS[s]}</span>;
}

export type MiniArticle = {
  id: number;
  title: string;
  status: Status;
  deadline: Date | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName?: string | null;
  assigneeName?: string | null;
  priority?: number;
};

export function MiniList({ items, empty, show = "updated" }: { items: MiniArticle[]; empty: string; show?: "updated" | "deadline" | "scheduled" }) {
  if (!items.length) return <p className="hint" style={{ margin: 0 }}>{empty}</p>;
  return (
    <table className="tbl">
      <tbody>
        {items.map((a) => {
          const late = a.deadline && a.deadline < new Date() && !["published", "scheduled", "archived", "approved"].includes(a.status);
          return (
            <tr key={a.id}>
              <td className="t">
                <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                  {a.assigneeName || a.authorName || "—"}
                  {a.priority === 1 && <b style={{ color: "#dc2626" }}> · priorité haute</b>}
                </div>
              </td>
              <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                <StatusPill s={a.status} />
                <div className={`meta ${late ? "late" : ""}`} style={{ fontSize: 11, marginTop: 4 }}>
                  {show === "deadline" && a.deadline && <>Échéance {formatDateTime(a.deadline)}</>}
                  {show === "scheduled" && a.scheduledAt && <>{formatDateTime(a.scheduledAt)}</>}
                  {show === "updated" && <>Modifié {formatDateTime(a.updatedAt)}</>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
