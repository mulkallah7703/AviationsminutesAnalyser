import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UserFacingError } from "@/lib/providers/types";

export function ErrorNotice({ error }: { error: UserFacingError }) {
  return (
    <Alert variant="destructive" className="bg-card px-4 py-3">
      <AlertTitle className="text-base">{error.titleAr}</AlertTitle>
      <AlertDescription className="text-sm leading-7 text-foreground/80">
        <p>{error.bodyAr}</p>
        {error.links && error.links.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {error.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.labelAr}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
