import "../admin.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-wrap">{children}</div>;
}
