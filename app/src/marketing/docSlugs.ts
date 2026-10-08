/**
 * The documentation's table of contents, in a module with no `'use client'`.
 *
 * `generateStaticParams` runs on the server, and a server component importing from a client module
 * gets a client reference proxy rather than the real value — so the list of slugs has to live
 * somewhere both sides can read it.
 */
export const DOC_SLUGS = [
  'introduction',
  'quick-start',
  'roles',
  'risk-tiers',
  'policy',
  'recipients',
  'limits',
  'modes',
  'changes',
  'recovery',
  'agents',
  'move-package',
  'invariants',
  'limitations',
] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

export const DOC_GROUPS = ['Start', 'Model', 'Reference', 'Assurance'] as const;
