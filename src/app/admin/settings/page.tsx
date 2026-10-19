import { AppShell } from "@/components/app-shell";
import { AdminLoginForm, AdminSetupForm } from "@/components/admin-access";
import { AdminSettings } from "@/components/admin-settings";
import { currentAdmin } from "@/lib/auth/current";
import { adminPasswordIsSet } from "@/lib/auth/accounts";
import { providerList } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!adminPasswordIsSet()) {
    return (
      <AppShell>
        <AdminSetupForm />
      </AppShell>
    );
  }
  if (!(await currentAdmin())) {
    return (
      <AppShell>
        <AdminLoginForm />
      </AppShell>
    );
  }
  const ready = providerList.filter((provider) => provider.meta.availability === "ready").map((provider) => provider.meta);
  const later = providerList.filter((provider) => provider.meta.availability !== "ready").map((provider) => provider.meta.name);
  return (
    <AppShell>
      <AdminSettings metas={ready} later={later} />
    </AppShell>
  );
}
