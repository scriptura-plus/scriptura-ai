import "server-only";

import {
  formatOriginalLanguagePacketForPrompt,
  getOriginalLanguagePacket,
} from "@/lib/bible/getOriginalLanguagePacket";

export type PearlV3OriginalLanguageContext = {
  available: boolean;
  formatted: string;
};

export function getPearlV3OriginalLanguageContext(
  reference: string,
): PearlV3OriginalLanguageContext {
  const packet = getOriginalLanguagePacket(reference);

  return {
    available: Boolean(packet),
    formatted: formatOriginalLanguagePacketForPrompt(packet),
  };
}
