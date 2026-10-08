import { notFound } from 'next/navigation';
import { DocsView } from '@/marketing/docs';
import { DOC_SLUGS, type DocSlug } from '@/marketing/docSlugs';

/** Every page is known ahead of time, so the documentation is static. */
export function generateStaticParams() {
  return DOC_SLUGS.filter((slug) => slug !== 'introduction').map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(DOC_SLUGS as readonly string[]).includes(slug)) notFound();
  return <DocsView slug={slug as DocSlug} />;
}
