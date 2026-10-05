import { notFound } from 'next/navigation';
import { DOC_SLUGS, DocsView, type DocSlug } from '@/marketing/docs';

/** Every page is known at build time, so the docs are static. */
export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!DOC_SLUGS.includes(slug as DocSlug)) notFound();
  return <DocsView slug={slug as DocSlug} />;
}
