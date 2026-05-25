import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { excerptText, SITE_DESCRIPTION, SITE_NAME, sortByDateDesc } from '../utils/site';

export async function GET(context) {
  const posts = sortByDateDesc(await getCollection('posts'));
  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: excerptText(post),
      link: post.data.path,
    })),
    customData: '<language>en-gb</language>',
  });
}
