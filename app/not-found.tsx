import Link from "next/link";

import { Page } from "@/components/shell/app-shell";

export default function NotFound() {
  return (
    <Page width="reading">
      <h1 className="text-page text-ink font-medium tracking-tight">
        There&rsquo;s nothing here.
      </h1>

      <p className="text-body text-ink-secondary mt-3">
        This page doesn&rsquo;t exist, or the entry it pointed to has been
        removed.
      </p>

      <Link
        href="/"
        className="text-small text-accent mt-8 inline-block underline underline-offset-4"
      >
        Back to the journey
      </Link>
    </Page>
  );
}
