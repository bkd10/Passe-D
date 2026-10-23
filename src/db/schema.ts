import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ROLES = [
  "admin",
  "publisher",
  "editor_in_chief",
  "journalist",
  "media",
  "seo",
  "contributor",
] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "idea",
  "assigned",
  "writing",
  "review",
  "changes",
  "approved",
  "scheduled",
  "published",
  "update_needed",
  "archived",
] as const;
export type Status = (typeof STATUSES)[number];

export const FORMATS = [
  "article",
  "portrait",
  "analyse",
  "entretien",
  "reportage",
  "dossier",
  "breve",
  "video",
  "chiffre",
  "debat",
] as const;
export type Format = (typeof FORMATS)[number];

export const MERCATO_STATUSES = [
  "rumeur",
  "interet",
  "negociations",
  "accord",
  "confirme",
  "dementi",
] as const;
export type MercatoStatus = (typeof MERCATO_STATUSES)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    role: text("role").$type<Role>().notNull().default("journalist"),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    specialties: text("specialties").notNull().default(""),
    categoryIds: jsonb("category_ids").$type<number[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    inviteToken: text("invite_token"),
    inviteExpiresAt: ts("invite_expires_at"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_slug_idx").on(t.slug)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#f2b631"),
    parentId: integer("parent_id"),
    position: integer("position").notNull().default(0),
    inNav: boolean("in_nav").notNull().default(true),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("sujet"), // sujet | joueur | club | metier | competition
    description: text("description").notNull().default(""),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug)],
);

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull(),
    storageKey: text("storage_key").notNull(),
    kind: text("kind").notNull().default("image"), // image | video
    mime: text("mime").notNull(),
    filename: text("filename").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    credit: text("credit").notNull().default(""),
    rights: text("rights").notNull().default(""), // ex. « Libre de droits », « Usage éditorial uniquement »
    folder: text("folder").notNull().default(""),
    keywords: text("keywords").notNull().default(""),
    variants: jsonb("variants").$type<Record<string, string>>().notNull().default({}),
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    dek: text("dek").notNull().default(""), // chapô
    body: jsonb("body").$type<unknown>(), // document TipTap
    bodyHtml: text("body_html").notNull().default(""),
    format: text("format").$type<Format>().notNull().default("article"),
    status: text("status").$type<Status>().notNull().default("idea"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    coverId: integer("cover_id").references(() => media.id, { onDelete: "set null" }),
    gallery: jsonb("gallery").$type<number[]>().notNull().default([]),
    videoUrl: text("video_url").notNull().default(""),
    priority: integer("priority").notNull().default(2), // 1 haute, 2 normale, 3 basse
    deadline: ts("deadline"),
    scheduledAt: ts("scheduled_at"),
    publishedAt: ts("published_at"),
    archiveAt: ts("archive_at"), // archivage automatique : l'article quitte l'accueil et les rubriques à cette date
    updatedContentAt: ts("updated_content_at"),
    featured: boolean("featured").notNull().default(false),
    module: text("module").notNull().default(""), // format éditorial récurrent (talent-a-suivre, ...)
    sponsored: boolean("sponsored").notNull().default(false),
    sponsorName: text("sponsor_name").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    canonicalUrl: text("canonical_url").notNull().default(""),
    ogImageId: integer("og_image_id").references(() => media.id, { onDelete: "set null" }),
    mercatoStatus: text("mercato_status").$type<MercatoStatus | "">().notNull().default(""),
    mercatoSource: text("mercato_source").notNull().default(""),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    views: integer("views").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_slug_idx").on(t.slug),
    index("articles_status_idx").on(t.status),
    index("articles_published_idx").on(t.publishedAt),
    index("articles_category_idx").on(t.categoryId),
  ],
);

export const articleContributors = pgTable(
  "article_contributors",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.userId] })],
);

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] })],
);

export const articleRelated = pgTable(
  "article_related",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    relatedId: integer("related_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.relatedId] })],
);

export const revisions = pgTable(
  "revisions",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    note: text("note").notNull().default(""),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("revisions_article_idx").on(t.articleId)],
);

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("comment"), // comment | correction | validation
    resolved: boolean("resolved").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notes_article_idx").on(t.articleId)],
);

export const mercatoUpdates = pgTable("mercato_updates", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  status: text("status").$type<MercatoStatus>().notNull(),
  source: text("source").notNull().default(""),
  note: text("note").notNull().default(""),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const corrections = pgTable("corrections", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull().default(""),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    confirmed: boolean("confirmed").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(t.email)],
);

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // resultat | compte-rendu | portrait | evenement | correction | sujet
  clubName: text("club_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("nouveau"), // nouveau | en-cours | accepte | refuse
  reviewNote: text("review_note").notNull().default(""),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  votes: jsonb("votes").$type<number[]>().notNull(),
  articleId: integer("article_id").references(() => articles.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Mesure d'audience sans cookie : un compteur agrégé par jour et par article.
export const dailyViews = pgTable(
  "daily_views",
  {
    day: text("day").notNull(), // AAAA-MM-JJ
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(0),
    referrers: jsonb("referrers").$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.day, t.articleId] })],
);
