import { defineCollection, z } from 'astro:content';

const seoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    canonical: z.string().optional(),
    schema: z.unknown().optional(),
    robots: z.array(z.string()).optional(),
    focusKeywords: z.array(z.string()).optional(),
  })
  .optional();

const contentSchema = z.object({
  id: z.number().optional(),
  type: z.enum(['post', 'page']).default('post'),
  wpSlug: z.string(),
  path: z.string().regex(/^\/$|^\/.*\/$/),
  url: z.string().url().optional(),
  title: z.string(),
  excerpt: z.string().optional(),
  date: z.coerce.date(),
  modified: z.coerce.date().optional(),
  author: z.string().optional(),
  authorSlug: z.string().optional(),
  categories: z.array(z.string()).default([]),
  categorySlugs: z.array(z.string()).default([]),
  categoryPaths: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  tagSlugs: z.array(z.string()).default([]),
  tagPaths: z.array(z.string()).default([]),
  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),
  seo: seoSchema,
});

const posts = defineCollection({
  type: 'content',
  schema: contentSchema.extend({
    type: z.literal('post').default('post'),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: contentSchema.extend({
    type: z.literal('page').default('page'),
  }),
});

export const collections = { posts, pages };
