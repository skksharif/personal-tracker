import { RenderedMarkdown } from "@/components/markdown/rendered-markdown";

/**
 * Renders a diary entry body.
 *
 * Kept as a thin alias over the shared renderer so the diary and the technical
 * notes cannot drift apart in how they display images, code or diagrams.
 */
export function EntryBody({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  return <RenderedMarkdown body={body} className={className} />;
}
