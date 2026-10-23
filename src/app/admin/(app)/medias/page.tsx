import { requireUser } from "@/lib/auth";
import { MediaLibrary } from "@/components/admin/media-library";
import { storageMode } from "@/lib/storage";

export const metadata = { title: "Médiathèque" };

export default async function MediaPage() {
  const user = await requireUser();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Médiathèque</h1>
          <p>Toutes les photos et vidéos de la rédaction, réutilisables sans réimport.</p>
        </div>
      </div>
      {storageMode() === "local" && process.env.NODE_ENV === "production" && (
        <div className="alert err">Stockage non configuré : ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour importer des médias.</div>
      )}
      <MediaLibrary meId={user.id} />
    </>
  );
}
