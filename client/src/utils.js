export function formatOrdinalCa(n) {
  if (n === 1) return '1r';
  if (n === 2) return '2n';
  if (n === 3) return '3r';
  if (n === 4) return '4t';
  return `${n}è`;
}

export function moveItemInArray(arr, fromIdx, toIdx) {
  if (!Array.isArray(arr) || fromIdx === toIdx || toIdx < 0 || toIdx >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export function extractOrderedCodes(pref) {
  if (!pref) return [];
  if (Array.isArray(pref)) return pref.map(String);
  if (Array.isArray(pref.orderedLampCodes)) return pref.orderedLampCodes.map(String);
  return [];
}

export function isLampNoApta(lamp) {
  return Boolean(lamp && (lamp.status === 'NO_APTA' || lamp.lockedUnsuitable));
}

export function isLampSelected(lamp) {
  if (!lamp || isLampNoApta(lamp)) return false;
  return lamp.status ? lamp.status === 'SELECCIONADA' : Boolean(lamp.selected);
}

export function getActiveLotLamps(lot) {
  if (!lot || !Array.isArray(lot.lamps)) return [];
  return lot.lamps.filter(l => (l.status ? l.status === 'SELECCIONADA' : l.suitable !== false));
}

export function buildEffectiveLotOrder(lots = [], lotPreferences = {}, explicitLotOrder = []) {
  const eligible = (lots || []).filter(l => !l.reserved && (l.lampCount || 0) > 0);
  const byId = new Map(eligible.map(l => [l.id, l]));
  const seen = new Set();
  const ordered = [];

  if (Array.isArray(explicitLotOrder)) {
    explicitLotOrder.forEach(lid => {
      const lot = byId.get(lid);
      if (lot && !seen.has(lot.id)) {
        seen.add(lot.id);
        ordered.push(lot);
      }
    });
  }

  eligible.forEach(lot => {
    if (seen.has(lot.id)) return;
    const activeCodes = new Set(getActiveLotLamps(lot).map(l => String(l.codi)));
    const hasNumbered = extractOrderedCodes(lotPreferences?.[lot.id]).some(c => activeCodes.has(String(c)));
    if (hasNumbered) {
      seen.add(lot.id);
      ordered.push(lot);
    }
  });

  eligible.forEach(lot => {
    if (!seen.has(lot.id)) {
      seen.add(lot.id);
      ordered.push(lot);
    }
  });

  return ordered;
}

export function resizeImageFileToDataUrl(file, maxWidth = 480, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / (img.width || maxWidth));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
