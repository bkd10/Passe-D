import Link from "next/link";
import type { Card, FullArticle } from "@/lib/queries";
import { ArticleCard } from "./card";
import { FORMAT_LABELS, MERCATO_LABELS, moduleBySlug } from "@/lib/editorial";
import { formatDate, formatDateTime, SITE_URL } from "@/lib/util";
import { ShareButtons } from "./share";
import { ViewTracker } from "./view-tracker";
import type { MercatoStatus } from "@/db/schema";

export function videoEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&cc_load_policy=1` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?texttrack=fr` };
  const dm = url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i);
  if (dm) return { kind: "iframe", src: `https://www.dailymotion.com/embed/video/${dm[1]}?autoplay=0` };
  if (/^(https?:\/\/|\/uploads\/).+\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return null;
}

export function ArticleView({ a, related, preview = false }: { a: FullArticle; related: Card[]; preview?: boolean }) {
  const art = a.article;
  const mod = art.module ? moduleBySlug(art.module) : null;
  const video = videoEmbed(art.videoUrl);
  const mercato = art.mercatoStatus ? MERCATO_LABELS[art.mercatoStatus as MercatoStatus] : null;
  const url = `${SITE_URL}/articles/${art.slug}`;
  const cover = a.cover;
  const coverSrc = cover ? cover.variants?.lg || cover.url : null;

  return (
    <article style={{ ["--cat" as string]: a.category?.color ?? undefined }}>
      {!preview && <ViewTracker id={art.id} />}
      <div className="wrap">
        <header className="article-head">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="kicker">
              <span className="dot" />
              {a.category ? <Link href={`/${a.category.slug}`}>{a.category.name}</Link> : "Passe D"}
              {mod ? ` · ${mod.name}` : art.format !== "article" ? ` · ${FORMAT_LABELS[art.format]}` : ""}
            </span>
            {art.sponsored && <span className="badge sponsor">Contenu sponsorisé{art.sponsorName ? ` · ${art.sponsorName}` : ""}</span>}
            {mercato && <span className={`badge ${mercato.tone === "lime" ? "lime-soft" : mercato.tone}`}>{mercato.label}</span>}
          </div>
          <h1 className="headline">{art.title}</h1>
          {art.dek && <p className="dek">{art.dek}</p>}
          <div className="byline">
            {a.author && (
              <span className="who">
                {a.author.avatarUrl ? <img className="avatar" src={a.author.avatarUrl} alt="" /> : null}
                <span>
                  Par <Link href={`/auteurs/${a.author.slug}`}>{a.author.name}</Link>
                  {a.contributors.length > 0 && (
                    <>
                      {" avec "}
                      {a.contributors.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ", "}
                          <Link href={`/auteurs/${c.slug}`}>{c.name}</Link>
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </span>
            )}
            <span className="meta">
              {art.publishedAt ? <time dateTime={art.publishedAt.toISOString()}>{formatDate(art.publishedAt)}</time> : "Non publié"}
              {art.updatedContentAt && art.publishedAt && art.updatedContentAt.getTime() - art.publishedAt.getTime() > 3600_000 && (
                <> · Mis à jour le {formatDateTime(art.updatedContentAt)}</>
              )}
              {" · "}
              {art.readingMinutes} min de lecture
            </span>
            <div className="share">
              <ShareButtons url={url} title={art.title} />
            </div>
          </div>
        </header>
      </div>

      {video && art.format === "video" ? (
        <div className="wrap">
          <div className="video-embed">
            {video.kind === "iframe" ? (
              <iframe src={video.src} title={art.title} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
            ) : (
              <video src={video.src} controls preload="metadata" poster={coverSrc ?? undefined} />
            )}
          </div>
        </div>
      ) : (
        cover && (
          <figure className="wrap article-cover" style={{ margin: "0 auto" }}>
            <img
              src={coverSrc!}
              srcSet={[cover.variants?.md && `${cover.variants.md} 960w`, cover.variants?.lg && `${cover.variants.lg} 1600w`].filter(Boolean).join(", ") || undefined}
              sizes="(max-width: 1200px) 100vw, 1200px"
              alt={cover.alt}
              width={cover.width ?? undefined}
              height={cover.height ?? undefined}
              fetchPriority="high"
            />
            {(cover.caption || cover.credit) && (
              <figcaption>
                {cover.caption}
                {cover.credit && <> · © {cover.credit}</>}
              </figcaption>
            )}
          </figure>
        )
      )}

      <div className="wrap">
        <div className="article-layout">
          <div />
          <div className="prose-col">
            {art.status === "archived" && (
              <p className="notice archive-note">
                <strong>Archive</strong> Cet article a été publié le {formatDateTime(art.publishedAt!)} et n&apos;est plus mis à jour.
              </p>
            )}
            <div className="prose" dangerouslySetInnerHTML={{ __html: art.bodyHtml }} />
          </div>
          <aside className="article-aside">
            {mercato && (
              <div className="notice">
                <strong>Statut mercato</strong>
                <span className={`badge ${mercato.tone === "lime" ? "lime-soft" : mercato.tone}`}>{mercato.label}</span>
                <p style={{ margin: "8px 0" }}>{mercato.help}</p>
                {art.mercatoSource && <p style={{ margin: 0 }}>Source : {art.mercatoSource}</p>}
                {a.mercato.length > 0 && (
                  <>
                    <p className="meta" style={{ margin: "12px 0 8px" }}>Historique</p>
                    <ol className="timeline">
                      {a.mercato.map((m) => (
                        <li key={m.id}>
                          <span className="meta">{formatDateTime(m.createdAt)}</span>
                          <br />
                          {MERCATO_LABELS[m.status]?.label}
                          {m.source ? ` · ${m.source}` : ""}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}
            {art.sponsored && (
              <div className="notice">
                <strong>Contenu sponsorisé</strong>
                Ce contenu a été réalisé en partenariat{art.sponsorName ? ` avec ${art.sponsorName}` : ""}. Il est distinct du travail indépendant de la rédaction.
              </div>
            )}
          </aside>
        </div>
      </div>


      {a.gallery.length > 0 && (
        <div className="wrap">
          <div className="gallery">
            {a.gallery.map((g) => (
              <figure key={g.id}>
                <img src={g.variants?.md || g.url} alt={g.alt} loading="lazy" />
                {(g.caption || g.credit) && (
                  <figcaption>
                    {g.caption}
                    {g.credit && <> · © {g.credit}</>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {video && art.format !== "video" && (
        <div className="wrap">
          <div className="video-embed">
            {video.kind === "iframe" ? (
              <iframe src={video.src} title={`Vidéo : ${art.title}`} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
            ) : (
              <video src={video.src} controls preload="metadata" />
            )}
          </div>
        </div>
      )}

      <div className="wrap">
        <div className="article-foot">
          {a.corrections.length > 0 && (
            <div className="notice" style={{ marginBottom: 16 }}>
              <strong>Corrections</strong>
              {a.corrections.map((c) => (
                <p key={c.id} style={{ margin: "4px 0" }}>
                  <span className="meta">{formatDateTime(c.createdAt)}</span> — {c.body}
                </p>
              ))}
            </div>
          )}
          {a.tags.length > 0 && (
            <div className="tag-list">
              {a.tags.map((t) => (
                <Link key={t.id} href={`/sujets/${t.slug}`} className="chip">
                  {t.name}
                </Link>
              ))}
            </div>
          )}
          {a.author?.bio && (
            <div className="notice">
              <strong>L&apos;auteur</strong>
              <Link href={`/auteurs/${a.author.slug}`} style={{ fontWeight: 700 }}>{a.author.name}</Link> — {a.author.bio}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="wrap">
          <section className="section" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <div className="section-head">
              <h2>À lire ensuite</h2>
            </div>
            <div className="grid-4">
              {related.map((r) => (
                <ArticleCard key={r.id} c={r} sizes="(max-width: 720px) 100vw, 25vw" />
              ))}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
