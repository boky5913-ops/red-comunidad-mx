export function normalizeMexicanPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("52") ? digits : `52${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${normalizeMexicanPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export const MAX_COMMUNITY_IMAGES = 5;
export const MAX_COMMUNITY_IMAGE_BYTES = 3_000_000;

export function isBase64WithinBytes(base64: string, maxBytes = MAX_COMMUNITY_IMAGE_BYTES) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding <= maxBytes;
}

export function canManageCommunityPost(userId: number, ownerId: number | null | undefined) {
  return ownerId !== null && ownerId !== undefined && userId === ownerId;
}
