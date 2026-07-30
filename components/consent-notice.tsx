import Link from "next/link";
import { CONSENT_NOTICE } from "@/lib/consent";

export function ConsentNotice({ light }: { light?: boolean }) {
  return (
    <p className={`text-[11px] leading-snug ${light ? "text-white/40" : "text-text-light"}`}>
      {CONSENT_NOTICE}{" "}
      <Link href="/terms" className="underline hover:no-underline">
        Terms
      </Link>{" "}
      &middot;{" "}
      <Link href="/privacy" className="underline hover:no-underline">
        Privacy
      </Link>
    </p>
  );
}
