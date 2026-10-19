import { AppShell } from "@/components/app-shell";
import { AdminSetupForm } from "@/components/admin-access";
import { Dashboard } from "@/components/dashboard";
import { adminPasswordIsSet } from "@/lib/auth/accounts";
import { currentUser } from "@/lib/auth/current";
import { listDashboardPlatforms } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ needAccount?: string; disabled?: string }>;
}) {
  if (!adminPasswordIsSet()) {
    return (
      <AppShell>
        <AdminSetupForm />
      </AppShell>
    );
  }
  const query = await searchParams;
  const user = await currentUser();
  const { platforms, storageError } = listDashboardPlatforms(user?.id ?? null);
  return (
    <AppShell>
      <Dashboard
        platforms={platforms}
        storageError={storageError}
        displayName={user?.displayName ?? null}
        needAccount={query.needAccount === "1"}
        disabledPlatform={query.disabled ?? null}
      />
    </AppShell>
  );
}
