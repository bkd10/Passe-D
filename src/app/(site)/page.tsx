import Link from "next/link";
import { ArticleCard, CoverFallback, Kicker, pickImage, srcSet } from "@/components/card";
import { LiveFeed } from "@/components/live-feed";
import { Poll } from "@/components/poll";
import { Newsletter } from "@/components/newsletter";
import { activePoll, getSetting, listPublic, navCategories, type Card } from "@/lib/queries";
import { DEFAULT_CATEGORIES, MERCATO_LABELS, moduleBySlug } from "@/lib/editorial";
import { LogoMark } from "@/components/logo";
import { timeAgo } from "@/lib/util";
import { PlayIcon } from "@/components/icons";
import type { MercatoStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

function SectionHead({ num, title, sub, href, more = "Tout voir" }: { num: string; title: string; sub?: string; href?: string; more?: string }) {
  return (
    <div className="section-head">
      <div>
        <h2>
          <span className="num">{num}</span>
          {title}
        </h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {href && (
        <Link className="more" href={href}>
          {more} →
        </Link>
      )}
    </div>
  );
}

export default async function Home() {
  const [featured, latest, cats, talent, mercato, figure, videos, amateur, metiers, innovations, invisible, popular, poll, figureSetting] =
    await Promise.all([
      listPublic({ featured: true, limit: 1 }),
      listPublic({ limit: 12 }),
      navCategories(),
      listPublic({ module: "talent-a-suivre", limit: 2 }),
      listPublic({ categorySlug: "mercato", limit: 6 }),
      listPublic({ module: "chiffre-du-jour", limit: 1 }),
      listPublic({ format: "video", limit: 8 }),
      listPublic({ categorySlug: "football-amateur", limit: 4 }),
      listPublic({ categorySlug: "metiers-du-football", limit: 3 }),
      listPublic({ categorySlug: "innovations", limit: 3 }),
      listPublic({ module: "football-invisible", limit: 1 }),
      listPublic({ sort: "popular", limit: 5, since: new Date(Date.now() - 30 * 86400_000) }),
      activePoll(),
      getSetting<{ value: string; label: string; source: string } | null>("chiffre_du_jour", null),
    ]);

  const lead: Card | undefined = featured[0] ?? latest[0];
  const secondary = latest.filter((a) => a.id !== lead?.id).slice(0, 3);
  const topCats = cats.filter((c) => !c.parentId);
  const catColor = (slug: string) => topCats.find((c) => c.slug === slug)?.color;

  if (!lead) {
    const tiles = topCats.length ? topCats : DEFAULT_CATEGORIES;
    return (
      <>
        <section className="launch">
          <div className="wrap launch-inner">
            <LogoMark className="launch-mark" />
            <h1>
              Passe <span>D</span>
            </h1>
            <p className="launch-sub">Média</p>
            <p className="launch-text">Talents, terrains amateurs, mercato vérifié et métiers de l&apos;ombre. Les premiers articles arrivent très bientôt.</p>
            <div className="launch-actions">
              <a className="btn" href="#newsletter">Être prévenu du lancement</a>
              <Link className="btn ghost" href="/contribuer">Proposer une info (clubs)</Link>
            </div>
          </div>
        </section>
        <div className="wrap">
          <section className="section">
            <SectionHead num="01" title="Les rubriques" sub="Ce que vous lirez sur Passe D." />
            <div className="rubrics">
              {tiles.map((c) => (
                <Link key={c.slug} href={`/${c.slug}`} className="rubric-tile" style={{ ["--cat" as string]: c.color }}>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="section" id="newsletter">
            <Newsletter cats={tiles.map((c) => ({ slug: c.slug, name: c.name }))} />
          </section>
        </div>
      </>
    );
  }

  const leadImg = pickImage(lead, "lg");
  const talentPick = talent.find((t) => t.id !== lead.id);
  const figurePick = figure[0];
  const invisiblePick = invisible[0];

  return (
    <div className="wrap">
      {/* A. La une */}
      <section className={`hero ${secondary.length ? "" : "solo"}`} aria-label="À la une">
        <article className="hero-main" style={{ ["--cat" as string]: lead.categoryColor ?? undefined }}>
          {leadImg ? <img src={leadImg} srcSet={srcSet(lead)} sizes="(max-width: 1080px) 100vw, 62vw" alt={lead.coverAlt ?? ""} fetchPriority="high" /> : <LogoMark className="hero-watermark" />}
          <div className="inner">
            <Kicker c={lead} />
            <h1>
              <Link href={`/articles/${lead.slug}`}>{lead.title}</Link>
            </h1>
            {lead.dek && <p>{lead.dek}</p>}
            <div className="meta">
              {lead.authorName} · {lead.publishedAt && timeAgo(lead.publishedAt)} · {lead.readingMinutes} min de lecture
              {lead.sponsored && ` · Contenu sponsorisé${lead.sponsorName ? ` avec ${lead.sponsorName}` : ""}`}
            </div>
          </div>
        </article>
        {secondary.length > 0 && <div className="hero-side">
          {secondary.map((a, i) => (
            <ArticleCard key={a.id} c={a} variant={i === 0 ? "default" : "row"} sizes="(max-width: 720px) 112px, 30vw" />
          ))}
        </div>}
      </section>

      <section className="manifesto" aria-label="Notre promesse">
        <span className="display">
          Notre <em>promesse.</em>
        </span>
        <p>Des talents avant tout le monde, des terrains amateurs, les métiers de l&apos;ombre et les idées qui changent le jeu. Vérifié et sourcé.</p>
        <Link className="btn ghost" href="/charte">Notre charte</Link>
      </section>

      {/* C. Fil d'actualité + colonne mercato / chiffre / débat */}
      <section className="section">
        <SectionHead num="01" title="Le fil" sub="Tout ce qui vient de tomber, mis à jour automatiquement." />
        <div className="feed-layout">
          <LiveFeed initial={latest} cats={topCats.map((c) => ({ slug: c.slug, name: c.name }))} />
          <aside style={{ display: "grid", gap: 20, alignContent: "start" }}>
            {mercato.length > 0 && (
              <div className="module" style={{ ["--cat" as string]: catColor("mercato") }}>
                <div className="module-tag">
                  <span>Le mercato décrypté</span>
                  <Link href="/mercato" className="count">Tout →</Link>
                </div>
                <ul className="mercato-board">
                  {mercato.slice(0, 5).map((m) => {
                    const st = m.mercatoStatus ? MERCATO_LABELS[m.mercatoStatus as MercatoStatus] : null;
                    return (
                      <li key={m.id}>
                        <Link href={`/articles/${m.slug}`}>{m.title}</Link>
                        {st && <span className={`badge ${st.tone === "lime" ? "lime-soft" : st.tone}`}>{st.label}</span>}
                        <span className="meta">Mis à jour {m.publishedAt && timeAgo(m.publishedAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {(figureSetting?.value || figurePick) && (
              <div className="module figure-module">
                <div className="module-tag"><span>Le chiffre du jour</span></div>
                {figureSetting?.value ? (
                  <>
                    <div className="big">{figureSetting.value}</div>
                    <p>{figureSetting.label}</p>
                    {figureSetting.source && <span className="meta" style={{ color: "inherit", opacity: 0.7 }}>Source : {figureSetting.source}</span>}
                  </>
                ) : (
                  figurePick && (
                    <>
                      <h3 style={{ textTransform: "none", fontSize: 26 }}>
                        <Link href={`/articles/${figurePick.slug}`}>{figurePick.title}</Link>
                      </h3>
                      {figurePick.dek && <p>{figurePick.dek}</p>}
                    </>
                  )
                )}
              </div>
            )}
            {poll && (
              <div className="module poll">
                <div className="module-tag"><span>Le débat du vestiaire</span></div>
                <Poll poll={{ id: poll.id, question: poll.question, options: poll.options, votes: poll.votes }} />
              </div>
            )}
            {popular.length > 0 && (
              <div className="module">
                <div className="module-tag"><span>Les plus lus du mois</span></div>
                <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 12 }}>
                  {popular.map((p) => (
                    <li key={p.id} style={{ fontWeight: 700, fontStretch: "85%", lineHeight: 1.2 }}>
                      <Link href={`/articles/${p.slug}`}>{p.title}</Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* D. Le talent à suivre */}
      {talentPick && (
        <section className="section" aria-label="Le talent à suivre">
          <article className="talent" style={{ position: "relative" }}>
            <div className="photo">
              {pickImage(talentPick, "lg") ? <img src={pickImage(talentPick, "lg")!} alt={talentPick.coverAlt ?? ""} loading="lazy" /> : <CoverFallback label="Talent" />}
            </div>
            <div className="body">
              <span className="label">● Le talent à suivre</span>
              <h2>
                <Link href={`/articles/${talentPick.slug}`}>{talentPick.title}</Link>
              </h2>
              {talentPick.dek && <p>{talentPick.dek}</p>}
              <span className="meta">
                Par {talentPick.authorName} · {talentPick.readingMinutes} min
              </span>
            </div>
          </article>
        </section>
      )}

      {/* F. Le foot d'à côté */}
      {amateur.length > 0 && (
        <section className="section">
          <SectionHead
            num="02"
            title="Le foot d'à côté"
            sub="Clubs, résultats et héros du football amateur. Votre club a une histoire ? Racontez-la nous."
            href="/football-amateur"
          />
          <div className="grid-4">
            {amateur.map((a) => (
              <ArticleCard key={a.id} c={a} sizes="(max-width: 720px) 100vw, 25vw" />
            ))}
          </div>
          <p style={{ marginTop: 22 }}>
            <Link className="btn ghost" href="/contribuer">Envoyer un résultat ou une histoire de club →</Link>
          </p>
        </section>
      )}

      {/* G. Vidéos */}
      {videos.length > 0 && (
        <section className="section">
          <SectionHead num="03" title="La minute terrain" sub="Formats courts, coulisses et analyses. Lecture uniquement si vous la lancez." href="/videos" />
          <div className="video-rail">
            {videos.map((v) => (
              <article key={v.id} className="video-card">
                {pickImage(v, "md") ? <img src={pickImage(v, "md")!} alt={v.coverAlt ?? ""} loading="lazy" /> : <CoverFallback small />}
                <span className="play" aria-hidden><PlayIcon size={18} /></span>
                <div className="inner">
                  <span className="kicker" style={{ color: "#ddd" }}>{v.categoryName}</span>
                  <h3><Link href={`/articles/${v.slug}`}>{v.title}</Link></h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Derrière le match + L'idée qui change le jeu */}
      {(metiers.length > 0 || innovations.length > 0) && (
        <section className="section">
          <div className="split">
            {metiers.length > 0 && (
              <div>
                <SectionHead num="04" title="Derrière le match" sub="Les métiers et les gens qui rendent le football possible." href="/metiers-du-football" />
                <div style={{ display: "grid", gap: 22 }}>
                  <ArticleCard c={metiers[0]} sizes="(max-width: 1080px) 100vw, 55vw" />
                  {metiers.slice(1).map((a) => (
                    <ArticleCard key={a.id} c={a} variant="row" />
                  ))}
                </div>
              </div>
            )}
            {innovations.length > 0 && (
              <div>
                <SectionHead num="05" title="L'idée qui change le jeu" sub="Data, tactique, technologie, économie." href="/innovations" />
                <div style={{ display: "grid", gap: 22 }}>
                  {innovations.map((a) => (
                    <ArticleCard key={a.id} c={a} variant="row" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* E. Découverte */}
      {invisiblePick && (
        <section className="section">
          <SectionHead num="06" title={moduleBySlug("football-invisible")!.name} sub="Une histoire que personne ne vous a encore racontée." />
          <div className="list-grid" style={{ padding: 0 }}>
            <ArticleCard c={invisiblePick} sizes="(max-width: 720px) 100vw, 66vw" />
          </div>
        </section>
      )}

      <section className="section">
        <SectionHead num="07" title="Explorer" sub="Chaque rubrique a sa personnalité." />
        <div className="rubrics">
          {topCats.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} className="rubric-tile" style={{ ["--cat" as string]: c.color }}>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* H. Communauté */}
      <section className="section" id="newsletter" style={{ borderBottom: 0 }}>
        <Newsletter cats={topCats.map((c) => ({ slug: c.slug, name: c.name }))} />
      </section>
    </div>
  );
}
