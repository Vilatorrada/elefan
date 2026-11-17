// Distinct high-contrast categorical palette for Streetlamp Lots on the map & tables
// (Avoids pure `#dc2626` red used for Reserved lots and `#0284c7` sky-blue used for active selection)
export const LOT_COLOR_PALETTE = [
  '#7c3aed', // 01 - Violet
  '#ea580c', // 02 - Deep Orange
  '#0d9488', // 03 - Teal
  '#db2777', // 04 - Magenta
  '#4f46e5', // 05 - Indigo
  '#ca8a04', // 06 - Amber Gold
  '#059669', // 07 - Emerald
  '#be185d', // 08 - Rose
  '#1d4ed8', // 09 - Royal Blue
  '#65a30d', // 10 - Olive Lime
  '#9333ea', // 11 - Vivid Purple
  '#c2410c'  // 12 - Terracotta
];

export function getLotPaletteColor(lotOrId, fallbackIndex = 0) {
  const idStr = typeof lotOrId === 'string' ? lotOrId : (lotOrId?.id || '');
  const numMatch = /(\d+)/.exec(idStr);
  if (numMatch) {
    const num = Math.max(1, parseInt(numMatch[1], 10));
    return LOT_COLOR_PALETTE[(num - 1) % LOT_COLOR_PALETTE.length];
  }
  if (idStr) {
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
    }
    return LOT_COLOR_PALETTE[hash % LOT_COLOR_PALETTE.length];
  }
  return LOT_COLOR_PALETTE[Math.abs(fallbackIndex) % LOT_COLOR_PALETTE.length];
}
