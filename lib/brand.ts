export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'OwnEdge';
export const BRAND_TLD = process.env.NEXT_PUBLIC_BRAND_TLD ?? '.ai';
export const BRAND_SLUG = BRAND_NAME.toLowerCase();
export const BRAND_DOMAIN =
  process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? `${BRAND_SLUG}${BRAND_TLD.toLowerCase()}`;
export const BRAND_DISPLAY = `${BRAND_NAME}${BRAND_TLD}`;