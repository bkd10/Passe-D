import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/admin/team-forms";
import { ROLE_LABELS } from "@/lib/permissions";

export const metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const u = await requireUser();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Mon profil</h1>
          <p>{ROLE_LABELS[u.role]}</p>
        </div>
      </div>
      <ProfileForm u={{ ...u }} />
    </>
  );
}
