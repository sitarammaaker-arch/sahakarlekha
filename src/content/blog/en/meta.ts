/**
 * English card/meta text for translated blog posts (the body is src/content/blog/en/<slug>.md).
 * A post appears here ONLY when its English body exists too — scripts/test-content-en.mjs checks both ways.
 */
export interface BlogPostEn {
  metaTitle: string;
  metaDescription: string;
  title: string;
  shortTitle: string;
  excerpt: string;
  imageAlt?: string;
}

import { BLOG_EN_B1G1 } from './meta-b1g1';
import { BLOG_EN_B1G2 } from './meta-b1g2';
import { BLOG_EN_B1G3 } from './meta-b1g3';
import { BLOG_EN_B1G4 } from './meta-b1g4';
import { BLOG_EN_B1G5 } from './meta-b1g5';
import { BLOG_EN_B1G6 } from './meta-b1g6';
import { BLOG_EN_B2G1 } from './meta-b2g1';
import { BLOG_EN_B2G2 } from './meta-b2g2';
import { BLOG_EN_B2G3 } from './meta-b2g3';
import { BLOG_EN_B2G4 } from './meta-b2g4';
import { BLOG_EN_B2G5 } from './meta-b2g5';
import { BLOG_EN_B2G6 } from './meta-b2g6';
import { BLOG_EN_B3G1 } from './meta-b3g1';
import { BLOG_EN_B3G2 } from './meta-b3g2';
import { BLOG_EN_B3G3 } from './meta-b3g3';
import { BLOG_EN_B3G4 } from './meta-b3g4';
import { BLOG_EN_B3G5 } from './meta-b3g5';
import { BLOG_EN_B3G6 } from './meta-b3g6';
import { BLOG_EN_B4G1 } from './meta-b4g1';
import { BLOG_EN_B4G2 } from './meta-b4g2';
import { BLOG_EN_B4G3 } from './meta-b4g3';
import { BLOG_EN_B4G4 } from './meta-b4g4';
import { BLOG_EN_B4G5 } from './meta-b4g5';
import { BLOG_EN_B4G6 } from './meta-b4g6';
import { BLOG_EN_B5G1 } from './meta-b5g1';
import { BLOG_EN_B5G2 } from './meta-b5g2';
import { BLOG_EN_B5G3 } from './meta-b5g3';
import { BLOG_EN_B5G4 } from './meta-b5g4';
import { BLOG_EN_B5G5 } from './meta-b5g5';
import { BLOG_EN_B5G6 } from './meta-b5g6';
import { BLOG_EN_B6G1 } from './meta-b6g1';
import { BLOG_EN_B6G2 } from './meta-b6g2';

/** Batch 1 (2026-11-15): the 24 newest published posts; batches 2–4: the next 24 each; batch 5: the last 29 published; batch 6: the 6 scheduled posts — each in six groups of four. */
export const BLOG_EN_META: Record<string, BlogPostEn> = {
  ...BLOG_EN_B1G1, ...BLOG_EN_B1G2, ...BLOG_EN_B1G3, ...BLOG_EN_B1G4, ...BLOG_EN_B1G5, ...BLOG_EN_B1G6,
  ...BLOG_EN_B2G1, ...BLOG_EN_B2G2, ...BLOG_EN_B2G3, ...BLOG_EN_B2G4, ...BLOG_EN_B2G5, ...BLOG_EN_B2G6,
  ...BLOG_EN_B3G1, ...BLOG_EN_B3G2, ...BLOG_EN_B3G3, ...BLOG_EN_B3G4, ...BLOG_EN_B3G5, ...BLOG_EN_B3G6,
  ...BLOG_EN_B4G1, ...BLOG_EN_B4G2, ...BLOG_EN_B4G3, ...BLOG_EN_B4G4, ...BLOG_EN_B4G5, ...BLOG_EN_B4G6,
  ...BLOG_EN_B5G1, ...BLOG_EN_B5G2, ...BLOG_EN_B5G3, ...BLOG_EN_B5G4, ...BLOG_EN_B5G5, ...BLOG_EN_B5G6,
  ...BLOG_EN_B6G1, ...BLOG_EN_B6G2,
};
