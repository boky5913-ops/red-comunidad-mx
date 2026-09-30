import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, canManageCommunityPost, isBase64WithinBytes, MAX_COMMUNITY_IMAGES, normalizeMexicanPhone } from "../shared/community";

describe("community contact helpers", () => {
  it("normalizes a Mexican phone number with country code", () => {
    expect(normalizeMexicanPhone("5512345678")).toBe("525512345678");
    expect(normalizeMexicanPhone("525512345678")).toBe("525512345678");
    expect(normalizeMexicanPhone("55 1234 5678")).toBe("525512345678");
  });

  it("builds an encoded WhatsApp deep link", () => {
    const url = buildWhatsAppUrl("5512345678", "Hola, me interesa la vacante");
    expect(url).toBe("https://wa.me/525512345678?text=Hola%2C%20me%20interesa%20la%20vacante");
  });

  it("enforces the gallery and compressed image size limits", () => {
    expect(MAX_COMMUNITY_IMAGES).toBe(5);
    expect(isBase64WithinBytes("YQ==", 1)).toBe(true);
    expect(isBase64WithinBytes("YWFh", 2)).toBe(false);
  });

  it("allows profile actions only for the post owner", () => {
    expect(canManageCommunityPost(7, 7)).toBe(true);
    expect(canManageCommunityPost(7, 8)).toBe(false);
    expect(canManageCommunityPost(7, null)).toBe(false);
  });
});
