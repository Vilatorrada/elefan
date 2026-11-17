import React, { useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Rectangle,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import {
  Search,
  Layers,
  Crosshair,
  X,
  Edit2,
  ExternalLink,
  Lightbulb,
  PackagePlus,
  SquareDashedMousePointer,
  Check,
  Settings,
  Trash2,
  MapPin,
  Image as ImageIcon
} from 'lucide-react';
import { EMPTY_LOT_DRAFT, EMPTY_LOCATION_DRAFT } from '../adminDrafts';
import { getLotPaletteColor } from '../lotColors';
import {
  formatOrdinalCa,
  extractOrderedCodes,
  isLampNoApta,
  isLampSelected,
  getActiveLotLamps,
  buildEffectiveLotOrder,
  resizeImageFileToDataUrl
} from '../utils';

// Custom DivIcon generator for Streetlight Lot Center Badge
function createLotMarkerIcon({ badgeText, bgColor = '#6b7280', borderColor = '#374151' }) {
  const html = `
    <div style="
      background: ${bgColor};
      border: 2px solid ${borderColor};
      color: white;
      border-radius: 999px;
      min-width: 28px;
      height: 26px;
      padding: 0 7px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      white-space: nowrap;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      position: relative;
    ">
      ${badgeText}
    </div>
  `;

  return L.divIcon({
    className: 'custom-lot-icon',
    html,
    iconSize: [36, 26],
    iconAnchor: [18, 13]
  });
}

// Custom DivIcon generator for individual numbered streetlamp pins inside the active Lot
function createActiveLampPinIcon({ label, bgColor, borderColor, textColor = '#ffffff', size = 25 }) {
  const html = `
    <div style="
      background: ${bgColor};
      border: 2px solid ${borderColor};
      color: ${textColor};
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: ${String(label).length >= 3 ? '9px' : '11px'};
      box-shadow: 0 3px 7px rgba(0,0,0,0.38);
      user-select: none;
    ">
      ${label}
    </div>
  `;

  return L.divIcon({
    className: 'custom-lamp-rank-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)]
  });
}

// Custom DivIcon generator for Billboard Locations (Emplaçaments) — supports Party priority numbering (`#1..M`)
function createLocationMarkerIcon({
  isDraftPreview = false,
  isBeingEdited = false,
  rankLabel = null,
  partyColor = '#4a7729',
  isUnnumberedInteractive = false
} = {}) {
  if (rankLabel !== null) {
    const html = `
      <div style="
        background: ${partyColor};
        border: 2.5px solid #ffffff;
        color: #ffffff;
        border-radius: 10px;
        min-width: 38px;
        height: 32px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-weight: 800;
        font-size: 12px;
        box-shadow: 0 0 0 3px rgba(253, 224, 71, 0.65), 0 5px 12px rgba(0,0,0,0.38);
        user-select: none;
      ">
        <span style="font-size: 12px;">📍</span><span>${rankLabel}</span>
      </div>
    `;
    return L.divIcon({
      className: 'custom-loc-icon',
      html,
      iconSize: [42, 32],
      iconAnchor: [21, 32]
    });
  }

  if (isUnnumberedInteractive) {
    const html = `
      <div style="
        background: #ffffff;
        border: 2.5px solid #0f766e;
        color: #0f766e;
        border-radius: 10px;
        min-width: 38px;
        height: 32px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-weight: 800;
        font-size: 12px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.32);
        user-select: none;
      ">
        <span style="font-size: 12px;">📍</span><span>+</span>
      </div>
    `;
    return L.divIcon({
      className: 'custom-loc-icon',
      html,
      iconSize: [42, 32],
      iconAnchor: [21, 32]
    });
  }

  const bg = isDraftPreview ? '#0284c7' : (isBeingEdited ? '#b45309' : '#4a7729');
  const border = (isDraftPreview || isBeingEdited) ? '#fde047' : '#daaa00';
  const size = 32;
  const shadow = (isDraftPreview || isBeingEdited)
    ? '0 0 0 4px rgba(253, 224, 71, 0.65), 0 6px 14px rgba(0,0,0,0.38)'
    : '0 4px 10px rgba(0,0,0,0.3)';
  const html = `
    <div style="
      background: ${bg};
      border: 2.5px solid ${border};
      color: white;
      border-radius: 9px;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${shadow};
      font-size: 15px;
    ">
      📍
    </div>
  `;
  return L.divIcon({
    className: 'custom-loc-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), size]
  });
}

// Gentle Map Pan/Focus Controller: ONLY runs on explicit user focus requests (never forces unwanted zoom jumps)
function MapSearchController({ focusRequest }) {
  const map = useMap();
  const lastSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (!focusRequest || !focusRequest.seq || focusRequest.seq === lastSeqRef.current) {
      return;
    }
    lastSeqRef.current = focusRequest.seq;
    const target = [focusRequest.lat, focusRequest.lng];
    const currentZoom = map.getZoom();
    if (currentZoom < 16) {
      map.setView(target, 17, { animate: true });
    } else {
      map.panTo(target, { animate: true });
    }
  }, [focusRequest, map]);

  return null;
}

// Only pans/fits when switching to an off-screen Lot ID (never re-zooms while clicking pins or polling!)
function MapActiveLotFitter({ activeLot, enabled }) {
  const map = useMap();
  const activeLotId = activeLot?.id || null;
  const lastFittedLotIdRef = React.useRef(null);

  React.useEffect(() => {
    if (!enabled || !activeLotId) {
      lastFittedLotIdRef.current = null;
      return;
    }
    if (lastFittedLotIdRef.current === activeLotId) {
      return;
    }
    lastFittedLotIdRef.current = activeLotId;

    if (!activeLot || !Array.isArray(activeLot.coords) || activeLot.coords.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(activeLot.coords);
    const currentView = map.getBounds();
    // If the lot is already visible in the user's viewport, keep their exact zoom and position untouched!
    if (currentView && currentView.pad(-0.08).intersects(bounds)) {
      return;
    }

    if (activeLot.coords.length === 1) {
      map.panTo(activeLot.coords[0], { animate: true });
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    map.fitBounds(bounds, {
      paddingTopLeft: isMobile ? [24, 60] : [55, 75],
      paddingBottomRight: isMobile ? [24, Math.round(window.innerHeight * 0.50)] : [415, 95],
      maxZoom: Math.max(map.getZoom(), 17),
      animate: true
    });
  }, [activeLotId, enabled, activeLot, map]);

  return null;
}

// Map Click Coordinate Picker & Drag / 2-Click Rectangular Area Selector (freezes map panning while drawing)
function MapInteractionController({
  isPlacingLocationClick,
  onPickLocationEditorCoords,
  isDrawingBox,
  onFinishBox,
  onCancelBox
}) {
  const map = useMap();
  const [cornerA, setCornerA] = useState(null);
  const [hoverCorner, setHoverCorner] = useState(null);
  const boxStateRef = React.useRef(null);
  const onFinishBoxRef = React.useRef(onFinishBox);
  const onCancelBoxRef = React.useRef(onCancelBox);

  React.useEffect(() => {
    onFinishBoxRef.current = onFinishBox;
    onCancelBoxRef.current = onCancelBox;
  }, [onFinishBox, onCancelBox]);

  const activeCrosshair = isDrawingBox || isPlacingLocationClick;

  React.useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeCrosshair ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [activeCrosshair, map]);

  // Freeze map dragging/zoom gestures and capture pointer drag (or 2-click) when drawing selection rectangle
  React.useEffect(() => {
    if (!isDrawingBox) {
      boxStateRef.current = null;
      setCornerA(null);
      setHoverCorner(null);
      return undefined;
    }

    const container = map.getContainer();
    const prevTouchAction = container.style.touchAction;
    const prevUserSelect = container.style.userSelect;

    map.dragging.disable();
    map.doubleClickZoom.disable();
    if (map.boxZoom) map.boxZoom.disable();
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';

    const completeRectangle = (ptA, ptB) => {
      const minLat = Math.min(ptA[0], ptB[0]);
      const maxLat = Math.max(ptA[0], ptB[0]);
      const minLng = Math.min(ptA[1], ptB[1]);
      const maxLng = Math.max(ptA[1], ptB[1]);
      boxStateRef.current = null;
      setCornerA(null);
      setHoverCorner(null);
      if (onFinishBoxRef.current) {
        onFinishBoxRef.current({ minLat, maxLat, minLng, maxLng });
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.leaflet-control')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const ll = map.mouseEventToLatLng(e);
      const pt = [ll.lat, ll.lng];

      if (!boxStateRef.current) {
        boxStateRef.current = {
          startLatLng: pt,
          startX: e.clientX,
          startY: e.clientY,
          mode: 'PRESSING',
          pointerId: e.pointerId
        };
        setCornerA(pt);
        setHoverCorner(pt);
        try {
          container.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if synthetic event without active pointerId
        }
      } else if (boxStateRef.current.mode === 'WAITING_CLICK2') {
        completeRectangle(boxStateRef.current.startLatLng, pt);
      }
    };

    const handlePointerMove = (e) => {
      if (!boxStateRef.current) return;
      const ll = map.mouseEventToLatLng(e);
      setHoverCorner([ll.lat, ll.lng]);
    };

    const handlePointerUp = (e) => {
      if (!boxStateRef.current || boxStateRef.current.mode !== 'PRESSING') return;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }

      const dist = Math.hypot(
        e.clientX - boxStateRef.current.startX,
        e.clientY - boxStateRef.current.startY
      );
      const ll = map.mouseEventToLatLng(e);
      const pt = [ll.lat, ll.lng];

      if (dist >= 6) {
        completeRectangle(boxStateRef.current.startLatLng, pt);
      } else {
        boxStateRef.current.mode = 'WAITING_CLICK2';
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        boxStateRef.current = null;
        setCornerA(null);
        setHoverCorner(null);
        if (onCancelBoxRef.current) onCancelBoxRef.current();
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      container.style.touchAction = prevTouchAction;
      container.style.userSelect = prevUserSelect;
      map.dragging.enable();
      map.doubleClickZoom.enable();
      if (map.boxZoom) map.boxZoom.enable();
    };
  }, [isDrawingBox, map]);

  useMapEvents({
    click(e) {
      if (isDrawingBox) return;
      if (isPlacingLocationClick && onPickLocationEditorCoords) {
        onPickLocationEditorCoords([
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        ]);
      }
    }
  });

  if (isDrawingBox && cornerA && hoverCorner) {
    return (
      <Rectangle
        bounds={[cornerA, hoverCorner]}
        interactive={false}
        pathOptions={{
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.24,
          weight: 2.2,
          dashArray: '5, 5'
        }}
      />
    );
  }

  return null;
}

function crossProduct(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

// Andrew's Monotone Chain Convex Hull Algorithm
function getConvexHull(points) {
  if (!points || points.length <= 2) return points;

  const uniqueMap = new Map();
  points.forEach(p => uniqueMap.set(p[0].toFixed(6) + ',' + p[1].toFixed(6), [p[0], p[1]]));
  const unique = Array.from(uniqueMap.values());
  if (unique.length <= 2) return unique;

  const sorted = unique.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));

  const lower = [];
  for (let i = 0; i < sorted.length; i++) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Helper to compute a clean Convex Hull area polygon around all streetlamp points with outward margin padding
function createLotAreaPolygon(coords, marginMeters = 20) {
  if (!coords || coords.length === 0) return [];

  const uniqueMap = new Map();
  coords.forEach(p => uniqueMap.set(p[0].toFixed(6) + ',' + p[1].toFixed(6), [p[0], p[1]]));
  const uniquePoints = Array.from(uniqueMap.values());

  if (uniquePoints.length === 1) {
    const [lat, lng] = uniquePoints[0];
    const dLat = marginMeters / 111111;
    const dLng = marginMeters / (111111 * Math.cos((lat * Math.PI) / 180));
    return [
      [lat + dLat, lng - dLng],
      [lat + dLat, lng + dLng],
      [lat - dLat, lng + dLng],
      [lat - dLat, lng - dLng]
    ];
  }

  const hull = getConvexHull(uniquePoints);

  if (hull.length === 2) {
    const [p1, p2] = hull;
    const dLat = p2[0] - p1[0];
    const dLng = p2[1] - p1[1];
    const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.00001;
    const nLat = dLat / len;
    const nLng = dLng / len;

    const oLat = (marginMeters / 111111) * (-nLng);
    const oLng = (marginMeters / (111111 * Math.cos((p1[0] * Math.PI) / 180))) * nLat;
    const endLat = (marginMeters / 111111) * nLat;
    const endLng = (marginMeters / (111111 * Math.cos((p1[0] * Math.PI) / 180))) * nLng;

    return [
      [p1[0] + oLat - endLat, p1[1] + oLng - endLng],
      [p2[0] + oLat + endLat, p2[1] + oLng + endLng],
      [p2[0] - oLat + endLat, p2[1] - oLng + endLng],
      [p1[0] - oLat - endLat, p1[1] - oLng - endLng]
    ];
  }

  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1];
  }
  if (area < 0) {
    hull.reverse();
  }

  const n = hull.length;
  const expanded = [];

  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    const e1Lat = curr[0] - prev[0];
    const e1Lng = curr[1] - prev[1];
    const len1 = Math.sqrt(e1Lat * e1Lat + e1Lng * e1Lng) || 0.00001;
    const u1Lat = e1Lat / len1;
    const u1Lng = e1Lng / len1;

    const n1Lat = u1Lng;
    const n1Lng = -u1Lat;

    const e2Lat = next[0] - curr[0];
    const e2Lng = next[1] - curr[1];
    const len2 = Math.sqrt(e2Lat * e2Lat + e2Lng * e2Lng) || 0.00001;
    const u2Lat = e2Lat / len2;
    const u2Lng = e2Lng / len2;

    const n2Lat = u2Lng;
    const n2Lng = -u2Lat;

    let bLat = n1Lat + n2Lat;
    let bLng = n1Lng + n2Lng;
    const bLen = Math.sqrt(bLat * bLat + bLng * bLng) || 0.00001;
    bLat /= bLen;
    bLng /= bLen;

    const dot = n1Lat * bLat + n1Lng * bLng;
    const miterDist = marginMeters / Math.max(0.3, dot);

    const shiftLat = (miterDist / 111111) * bLat;
    const shiftLng = (miterDist / (111111 * Math.cos((curr[0] * Math.PI) / 180))) * bLng;

    expanded.push([curr[0] + shiftLat, curr[1] + shiftLng]);
  }

  return expanded;
}

export default function MapViewer({
  lamps = [],
  lampStats,
  lots = [],
  locations = [],
  lotPreferences,
  lotOrder = [],
  locationPreferences = [],
  allocationResults,
  parties,
  selectedLotId,
  isPartyPanelOpen = false,
  isPartySelectingLocations = false,
  onOpenEmplacaments,
  onSaveLocationPreferences,
  partyId,
  partyColor = '#4a7729',
  electionStatus = 'OPEN',
  onSelectLot,
  onSaveLotLampOrder,
  highlightedLotId,
  role,
  focusRequest,
  adminMapMode = 'VIEW',
  onChangeAdminMapMode,
  onOpenAdminTab,
  onBatchLampSuitability,
  lotDraft,
  onChangeLotDraft,
  onSaveLotDraft,
  onEditLotOnMap,
  onDeleteLot,
  locationDraft,
  onChangeLocationDraft,
  onSaveLocation,
  onDeleteLocation,
  onEditLocation,
  onMoveLocation
}) {
  const [mapType, setMapType] = useState('OSM');
  const [searchQuery, setSearchQuery] = useState('');
  const [localFocusReq, setLocalFocusReq] = useState(null);
  const [mapLampFilter, setMapLampFilter] = useState('ALL_APT');
  const [showLockedNoAptes, setShowLockedNoAptes] = useState(false);
  const [includeOtherLotsInBox, setIncludeOtherLotsInBox] = useState(false);
  const [quickStreet, setQuickStreet] = useState('');
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [isRelocatingPin, setIsRelocatingPin] = useState(false);
  const [lotBuilderNotice, setLotBuilderNotice] = useState('');
  const [locBuilderNotice, setLocBuilderNotice] = useState('');

  const triggerLocalFocus = (lat, lng) => {
    setLocalFocusReq(prev => ({ lat, lng, seq: (prev?.seq || 0) + 100000 }));
  };

  const effectiveFocusRequest = useMemo(() => {
    if (!localFocusReq) return focusRequest;
    if (!focusRequest) return localFocusReq;
    return (localFocusReq.seq || 0) > (focusRequest.seq || 0) ? localFocusReq : focusRequest;
  }, [localFocusReq, focusRequest]);

  const centerCoords = [41.7456, 1.8085];

  const isMapEditorMode = role === 'ADMIN' && adminMapMode === 'MAP_EDITOR';
  const isLocationEditorMode = role === 'ADMIN' && adminMapMode === 'LOCATION_EDITOR';
  // Only activate crosshair & map-click coordinate placement when placing a NEW location (not yet placed) or when user explicitly clicked "Moure clicant al mapa"
  const isPlacingLocationClick = Boolean(
    isLocationEditorMode &&
    locationDraft &&
    ((!locationDraft.isEditing && !locationDraft.hasCoords) || isRelocatingPin)
  );
  const shouldRenderAllLamps = isMapEditorMode;
  const isAllocated = electionStatus === 'ALLOCATED';
  const canPartyEditLamps = role === 'PARTY' && electionStatus === 'OPEN';

  const activeSelectedLot = useMemo(
    () => (selectedLotId ? lots.find(l => l.id === selectedLotId) || null : null),
    [selectedLotId, lots]
  );

  const partyById = useMemo(() => {
    const m = new Map();
    (parties || []).forEach(p => m.set(p.id, p));
    return m;
  }, [parties]);

  const lotColorById = useMemo(() => {
    const m = new Map();
    (lots || []).forEach((l, idx) => {
      m.set(l.id, l.reserved ? '#dc2626' : getLotPaletteColor(l, idx));
    });
    return m;
  }, [lots]);

  const partyLotRankById = useMemo(() => {
    const m = new Map();
    if (role === 'PARTY') {
      const ordered = buildEffectiveLotOrder(lots, lotPreferences, lotOrder);
      ordered.forEach((l, idx) => m.set(l.id, idx + 1));
    }
    return m;
  }, [role, lots, lotPreferences, lotOrder]);

  const selectedBuilderSet = useMemo(
    () => new Set(lotDraft?.lampCodes || []),
    [lotDraft?.lampCodes]
  );

  const lampByCode = useMemo(() => {
    const m = new Map();
    lamps.forEach(l => m.set(l.codi, l));
    return m;
  }, [lamps]);

  const inventoryCounts = useMemo(() => {
    let aptTotal = 0;
    let freeApt = 0;
    let selectedTotal = 0;
    let selectedFree = 0;
    const byStreet = new Map();

    lamps.forEach(l => {
      if (isLampNoApta(l)) return;
      aptTotal += 1;
      const sel = isLampSelected(l);
      const isFreeOrOwn = !l.lotId || (lotDraft?.isEditing && l.lotId === lotDraft.id);
      if (sel) selectedTotal += 1;
      if (isFreeOrOwn) {
        freeApt += 1;
        if (sel) selectedFree += 1;
      }

      const st = l.carrer || 'Sense carrer';
      if (!byStreet.has(st)) {
        byStreet.set(st, { street: st, freeApt: 0, selectedFree: 0, coords: [l.lat, l.lng] });
      }
      const stObj = byStreet.get(st);
      if (isFreeOrOwn) {
        stObj.freeApt += 1;
        if (sel) stObj.selectedFree += 1;
      }
    });

    const streets = Array.from(byStreet.values())
      .filter(s => s.freeApt > 0)
      .sort((a, b) => a.street.localeCompare(b.street, 'ca'));

    return { aptTotal, freeApt, selectedTotal, selectedFree, streets };
  }, [lamps, lotDraft?.isEditing, lotDraft?.id]);

  const builderSelectedLamps = useMemo(
    () => (lotDraft?.lampCodes || []).map(c => lampByCode.get(c)).filter(Boolean),
    [lotDraft?.lampCodes, lampByCode]
  );

  const alreadySelectedInDraft = useMemo(
    () => builderSelectedLamps.filter(l => isLampSelected(l)),
    [builderSelectedLamps]
  );

  const pendingAptaInDraft = useMemo(
    () => builderSelectedLamps.filter(l => !isLampSelected(l) && !isLampNoApta(l)),
    [builderSelectedLamps]
  );

  const builderDetectedStreet = useMemo(() => {
    if (builderSelectedLamps.length === 0) return '';
    const counts = {};
    builderSelectedLamps.forEach(l => {
      const st = l.carrer || 'Sense carrer';
      counts[st] = (counts[st] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }, [builderSelectedLamps]);

  const builderPreviewPolygon = useMemo(() => {
    if (!isMapEditorMode || builderSelectedLamps.length === 0) return [];
    return createLotAreaPolygon(builderSelectedLamps.map(l => [l.lat, l.lng]), 16);
  }, [isMapEditorMode, builderSelectedLamps]);

  const matchesActiveMapFilter = (lamp) => {
    if (isLampNoApta(lamp)) return false;
    const sel = isLampSelected(lamp);
    const inOtherLot = Boolean(lamp.lotId && (!lotDraft?.isEditing || lamp.lotId !== lotDraft.id));
    if (mapLampFilter === 'FREE_APT') return !inOtherLot;
    if (mapLampFilter === 'SELECTED_FREE') return sel && !inOtherLot;
    if (mapLampFilter === 'SELECTED_ALL') return sel;
    return true;
  };

  const toggleLampInPartyOrder = (lot, lampCode) => {
    if (!canPartyEditLamps || !onSaveLotLampOrder || !lot) return;
    if (lot.reserved) return;
    const activeSet = new Set(getActiveLotLamps(lot).map(l => String(l.codi)));
    const codeStr = String(lampCode);
    if (!activeSet.has(codeStr)) return;

    const current = extractOrderedCodes(lotPreferences?.[lot.id]).filter(c => activeSet.has(c));
    const idx = current.indexOf(codeStr);
    const next = idx !== -1
      ? current.filter(c => c !== codeStr)
      : [...current, codeStr];
    onSaveLotLampOrder(lot.id, next);
  };

  const partyOrderedLocationIds = useMemo(() => {
    if (role !== 'PARTY' || !Array.isArray(locationPreferences)) return [];
    const validIds = new Set((locations || []).map(l => l.id));
    const seen = new Set();
    return locationPreferences.filter(id => {
      if (!validIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [role, locationPreferences, locations]);

  const toggleLocationInPartyOrder = (locId) => {
    if (!canPartyEditLamps || !onSaveLocationPreferences) return;
    const idx = partyOrderedLocationIds.indexOf(locId);
    const next = idx !== -1
      ? partyOrderedLocationIds.filter(id => id !== locId)
      : [...partyOrderedLocationIds, locId];
    onSaveLocationPreferences(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();

    const foundLoc = locations?.find(
      loc => loc.name?.toLowerCase().includes(q) || loc.address?.toLowerCase().includes(q) || loc.id?.toLowerCase().includes(q)
    );
    if (foundLoc) {
      triggerLocalFocus(foundLoc.lat, foundLoc.lng);
      return;
    }

    const foundLot = lots.find(
      l => l.name?.toLowerCase().includes(q) || l.street?.toLowerCase().includes(q) || l.id?.toLowerCase().includes(q)
    );
    if (foundLot && foundLot.coords && foundLot.coords.length > 0) {
      triggerLocalFocus(foundLot.coords[0][0], foundLot.coords[0][1]);
      return;
    }

    const foundLamp = lamps.find(
      l => l.carrer?.toLowerCase().includes(q) || l.codi?.toLowerCase().includes(q)
    );
    if (foundLamp) {
      triggerLocalFocus(foundLamp.lat, foundLamp.lng);
    }
  };

  const handleFinishBox = ({ minLat, maxLat, minLng, maxLng }) => {
    setIsDrawingBox(false);
    if (!isMapEditorMode || !onChangeLotDraft || !lotDraft) return;

    const inBounds = lamps.filter(
      l => l.lat >= minLat && l.lat <= maxLat && l.lng >= minLng && l.lng <= maxLng
    );
    const candidates = inBounds.filter(l => {
      if (!matchesActiveMapFilter(l)) return false;
      const inOtherLot = Boolean(l.lotId && (!lotDraft.isEditing || l.lotId !== lotDraft.id));
      if (inOtherLot && !includeOtherLotsInBox) return false;
      return true;
    });

    if (candidates.length === 0) {
      setLotBuilderNotice('Cap farola disponible coincideix amb el rectangle i el filtre actiu.');
      return;
    }

    const nextSet = new Set(lotDraft.lampCodes || []);
    candidates.forEach(l => nextSet.add(l.codi));
    setLotBuilderNotice('');
    onChangeLotDraft({
      ...lotDraft,
      lampCodes: Array.from(nextSet)
    });
  };

  const handleAddQuickStreet = () => {
    if (!quickStreet || !onChangeLotDraft || !lotDraft) return;
    const matching = lamps.filter(l => {
      if (l.carrer !== quickStreet) return false;
      if (!matchesActiveMapFilter(l)) return false;
      const inOtherLot = Boolean(l.lotId && (!lotDraft.isEditing || l.lotId !== lotDraft.id));
      return !inOtherLot;
    });
    if (matching.length === 0) {
      setLotBuilderNotice(`Cap farola lliure a ${quickStreet} amb el filtre actual.`);
      return;
    }
    const nextSet = new Set(lotDraft.lampCodes || []);
    matching.forEach(l => nextSet.add(l.codi));
    setLotBuilderNotice('');
    onChangeLotDraft({
      ...lotDraft,
      lampCodes: Array.from(nextSet)
    });
    triggerLocalFocus(matching[0].lat, matching[0].lng);
  };

  const toggleLampInLotDraft = (lamp) => {
    if (!onChangeLotDraft || !lotDraft) return;
    if (isLampNoApta(lamp)) return;
    setLotBuilderNotice('');
    const next = new Set(lotDraft.lampCodes || []);
    if (next.has(lamp.codi)) {
      next.delete(lamp.codi);
    } else {
      next.add(lamp.codi);
    }
    onChangeLotDraft({
      ...lotDraft,
      lampCodes: Array.from(next)
    });
  };

  const handleMarkSelectionState = async (markAsSelected) => {
    if (!onBatchLampSuitability || !lotDraft) return;
    const targets = markAsSelected
      ? pendingAptaInDraft.map(l => l.codi)
      : alreadySelectedInDraft.map(l => l.codi);
    if (targets.length === 0) return;

    if (!markAsSelected) {
      const anyInLot = alreadySelectedInDraft.some(l => Boolean(l.lotId));
      if (anyInLot) {
        const okConfirm = window.confirm(
          'Algunes d\'aquestes faroles formen part d\'un lot. En desmarcar-les com a Seleccionades es retiraran automàticament del seu lot. Voleu continuar?'
        );
        if (!okConfirm) return;
      }
    }

    await onBatchLampSuitability(targets, markAsSelected);

    if (lotDraft.isEditing) {
      if (!markAsSelected && onChangeLotDraft) {
        const removedSet = new Set(targets);
        const remaining = (lotDraft.lampCodes || []).filter(c => !removedSet.has(c));
        if (remaining.length === 0) {
          onChangeLotDraft({ ...EMPTY_LOT_DRAFT });
        } else {
          onChangeLotDraft({ ...lotDraft, lampCodes: remaining });
        }
      }
      setLotBuilderNotice(
        markAsSelected
          ? `✔ ${targets.length} faroles marcades com a Seleccionades.`
          : `⚪ ${targets.length} faroles desmarcades com a Seleccionades (retirades del lot).`
      );
    } else {
      if (onChangeLotDraft) {
        onChangeLotDraft({ ...lotDraft, lampCodes: [] });
      }
      setLotBuilderNotice(
        markAsSelected
          ? `✔ ${targets.length} faroles marcades com a Seleccionades (en verd al plànol).`
          : `⚪ ${targets.length} faroles desmarcades com a Seleccionades (tornen a groc al plànol).`
      );
    }
  };

  const submitBuilderLot = async ({ promotePending = false } = {}) => {
    if (!onSaveLotDraft || !lotDraft) return;
    const targetCodes = promotePending
      ? builderSelectedLamps.map(l => l.codi)
      : alreadySelectedInDraft.map(l => l.codi);
    if (targetCodes.length === 0) return;

    const wasEditing = Boolean(lotDraft.isEditing);
    const ok = await onSaveLotDraft({
      id: lotDraft.id || undefined,
      name: lotDraft.name?.trim() || '',
      street: lotDraft.street?.trim() || builderDetectedStreet,
      lampCodes: targetCodes,
      markLampsSelected: Boolean(promotePending),
      markLampsSuitable: Boolean(promotePending),
      reserved: Boolean(lotDraft.reserved),
      reservedReason: lotDraft.reservedReason || ''
    });
    if (ok !== false) {
      setLotBuilderNotice(
        wasEditing
          ? `✔ Canvis desats al lot correctament.`
          : `✔ Lot creat amb ${targetCodes.length} faroles seleccionades! Ja podeu seleccionar el següent tram.`
      );
    }
  };

  const handleSaveBuilderLot = async (e) => {
    e.preventDefault();
    await submitBuilderLot({ promotePending: pendingAptaInDraft.length > 0 });
  };

  const findNearestStreetName = (lat, lng) => {
    let bestStreet = '';
    let bestSqDist = Infinity;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      if (!l.carrer) continue;
      const dLat = l.lat - lat;
      const dLng = l.lng - lng;
      const sq = dLat * dLat + dLng * dLng;
      if (sq < bestSqDist) {
        bestSqDist = sq;
        bestStreet = l.carrer;
      }
    }
    // Within ~90 meters (~0.00085 deg)
    return bestSqDist <= 0.00085 * 0.00085 ? bestStreet : '';
  };

  const handlePickLocationEditorCoords = ([lat, lng]) => {
    if (!onChangeLocationDraft || !locationDraft) return;
    setLocBuilderNotice('');
    setIsRelocatingPin(false);
    const nearestStreet = findNearestStreetName(lat, lng);
    const nextAddress = locationDraft.address?.trim()
      ? locationDraft.address
      : nearestStreet;
    onChangeLocationDraft({
      ...locationDraft,
      lat,
      lng,
      hasCoords: true,
      address: nextAddress
    });
  };

  const handleLocationImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onChangeLocationDraft || !locationDraft) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      onChangeLocationDraft({ ...locationDraft, imageUrl: dataUrl });
    } catch {
      setLocBuilderNotice('⚠️ No s\'ha pogut processar la imatge seleccionada.');
    }
  };

  const handleSaveMapLocation = async (e) => {
    e.preventDefault();
    if (!onSaveLocation || !locationDraft) return;
    setLocBuilderNotice('');
    const hasValidCoords = Boolean(locationDraft.isEditing || locationDraft.hasCoords);
    if (!hasValidCoords) {
      setLocBuilderNotice('⚠️ Feu clic primer sobre el punt del mapa on voleu ubicar l\'emplaçament.');
      return;
    }
    if (!locationDraft.name?.trim()) {
      setLocBuilderNotice('⚠️ Introduïu un nom per a l\'emplaçament.');
      return;
    }

    const wasEditing = Boolean(locationDraft.isEditing);
    const ok = await onSaveLocation({
      id: locationDraft.id || undefined,
      name: locationDraft.name.trim(),
      type: locationDraft.type || 'CARTELLERA',
      address: locationDraft.address?.trim() || 's/n',
      description: locationDraft.description?.trim() || '',
      capacity: Math.max(1, Number(locationDraft.capacity) || 1),
      lat: Number(locationDraft.lat),
      lng: Number(locationDraft.lng),
      imageUrl: locationDraft.imageUrl?.trim() || ''
    });

    if (ok !== false) {
      if (onChangeLocationDraft) {
        onChangeLocationDraft({ ...EMPTY_LOCATION_DRAFT });
      }
      setLocBuilderNotice(
        wasEditing
          ? '✔ Emplaçament actualitzat! Podeu clicar un altre punt o xinxeta.'
          : '✔ Emplaçament creat! Cliqueu un altre punt del mapa per afegir-ne més.'
      );
    }
  };

  const interactionBusy = isDrawingBox || isMapEditorMode || isLocationEditorMode;
  const anySidePanelOpen =
    isMapEditorMode ||
    isLocationEditorMode ||
    (role === 'PARTY' && (isPartyPanelOpen || Boolean(activeSelectedLot) || isPartySelectingLocations));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Top-Left Map Control Bar (positioned next to Leaflet zoom controls) */}
      <div className={`map-top-controls ${anySidePanelOpen ? 'with-side-panel' : ''}`}>
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="map-search-form">
          <input
            type="text"
            className="map-search-input"
            placeholder="Cercar carrer, farola o lot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#4a7729', display: 'flex' }}>
            <Search size={17} />
          </button>
        </form>

        {/* Satellite / Standard Toggle */}
        <button
          type="button"
          onClick={() => setMapType(mapType === 'OSM' ? 'SATELLITE' : 'OSM')}
          style={{
            background: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 11px',
            fontSize: '0.81rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            color: '#1e293b'
          }}
        >
          <Layers size={16} color="#4a7729" />
          <span>{mapType === 'OSM' ? 'Ortofoto Satèl·lit' : 'Mapa Topogràfic'}</span>
        </button>

        {/* Admin On-Map Quick Workspace Buttons: Faroles/Lots & Emplaçaments */}
        {role === 'ADMIN' && (
          <>
            <button
              type="button"
              onClick={() => {
                setIsDrawingBox(false);
                setLotBuilderNotice('');
                if (onChangeAdminMapMode) onChangeAdminMapMode(isMapEditorMode ? 'VIEW' : 'MAP_EDITOR');
              }}
              style={{
                background: isMapEditorMode ? '#0284c7' : 'white',
                color: isMapEditorMode ? 'white' : '#0f172a',
                border: `2px solid ${isMapEditorMode ? '#0369a1' : '#0284c7'}`,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.81rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              title="Obre l'espai unificat per seleccionar faroles aptes i agrupar-les en lots directament sobre el mapa"
            >
              <PackagePlus size={15} color={isMapEditorMode ? '#fef08a' : '#0284c7'} />
              <span>
                {isMapEditorMode
                  ? `Sortir de Faroles/Lots (${lampStats?.selected ?? inventoryCounts.selectedTotal} sel.)`
                  : `Faroles i Lots al Mapa (${lampStats?.selected ?? inventoryCounts.selectedTotal}/${lampStats?.suitable ?? inventoryCounts.aptTotal} sel. · ${lots.length} lots)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsDrawingBox(false);
                setLocBuilderNotice('');
                if (onChangeAdminMapMode) onChangeAdminMapMode(isLocationEditorMode ? 'VIEW' : 'LOCATION_EDITOR');
              }}
              style={{
                background: isLocationEditorMode ? '#4a7729' : 'white',
                color: isLocationEditorMode ? 'white' : '#0f172a',
                border: `2px solid ${isLocationEditorMode ? '#36581d' : '#4a7729'}`,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.81rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              title="Afegeix o edita emplaçaments fixos (panells, cartelleres i pancartes) fent clic directament sobre el mapa"
            >
              <MapPin size={15} color={isLocationEditorMode ? '#fef08a' : '#4a7729'} />
              <span>
                {isLocationEditorMode
                  ? `Sortir d'Emplaçaments (${locations.length})`
                  : `Emplaçaments al Mapa (${locations.length})`}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Unified Floating Panel: On-Map Streetlamp Selection & Lot Builder */}
      {isMapEditorMode && lotDraft && (
        <form
          onSubmit={handleSaveBuilderLot}
          className="map-side-panel"
          style={{
            width: '365px',
            border: `2px solid ${lotDraft.isEditing ? '#d97706' : '#0284c7'}`,
            zIndex: 1150
          }}
        >
          {/* Header */}
          <div style={{
            background: lotDraft.isEditing ? '#b45309' : '#0284c7',
            color: 'white',
            padding: '0.65rem 0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <PackagePlus size={17} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lotDraft.isEditing ? `Editant ${lotDraft.id}` : 'Faroles i Lots al Mapa'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {lotDraft.isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setLotBuilderNotice('');
                    if (onChangeLotDraft) onChangeLotDraft({ ...EMPTY_LOT_DRAFT });
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.45)',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Torna a la creació d'un nou lot"
                >
                  Nou lot
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingBox(false);
                  if (onChangeAdminMapMode) onChangeAdminMapMode('VIEW');
                }}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}
                title="Sortir del mode d'edició al mapa"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.79rem', overflowY: 'auto', minHeight: 0 }}>
            {/* Filter & Visibility Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem 0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <label style={{ fontWeight: 700, color: '#334155', fontSize: '0.74rem' }}>
                  Mostrar al plànol:
                </label>
                {inventoryCounts.selectedFree > 0 && mapLampFilter !== 'SELECTED_FREE' && (
                  <button
                    type="button"
                    onClick={() => setMapLampFilter('SELECTED_FREE')}
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      borderRadius: '999px',
                      padding: '1px 8px',
                      fontSize: '0.69rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                    title="Mostra només les faroles ja Seleccionades que encara no tenen lot"
                  >
                    Filtrar {inventoryCounts.selectedFree} sel. sense lot
                  </button>
                )}
              </div>

              <select
                value={mapLampFilter}
                onChange={(e) => setMapLampFilter(e.target.value)}
                style={{ width: '100%', padding: '0.36rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.77rem' }}
              >
                <option value="ALL_APT">Totes les faroles aptes ({inventoryCounts.aptTotal})</option>
                <option value="FREE_APT">Aptes sense lot ({inventoryCounts.freeApt})</option>
                <option value="SELECTED_FREE">✔ Seleccionades sense lot ({inventoryCounts.selectedFree})</option>
                <option value="SELECTED_ALL">✔ Totes les Seleccionades ({inventoryCounts.selectedTotal})</option>
              </select>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#475569' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showLockedNoAptes}
                    onChange={(e) => setShowLockedNoAptes(e.target.checked)}
                  />
                  <span>Veure No Aptes ({lampStats?.unsuitable ?? 434})</span>
                </label>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeOtherLotsInBox}
                    onChange={(e) => setIncludeOtherLotsInBox(e.target.checked)}
                  />
                  <span>Incloure d'altres lots al rectangle</span>
                </label>
              </div>
            </div>

            {lotBuilderNotice && (
              <div style={{
                background: lotBuilderNotice.startsWith('✔') ? '#f0fdf4' : '#fffbeb',
                color: lotBuilderNotice.startsWith('✔') ? '#15803d' : '#b45309',
                border: `1px solid ${lotBuilderNotice.startsWith('✔') ? '#86efac' : '#fde68a'}`,
                borderRadius: '6px',
                padding: '0.45rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {lotBuilderNotice}
              </div>
            )}

            {/* Selection Tools: Map Click / Rectangle / Quick Street */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem' }}>
              <div style={{ fontSize: '0.74rem', color: isDrawingBox ? '#0369a1' : '#475569', fontWeight: isDrawingBox ? 700 : 400, lineHeight: 1.3 }}>
                {isDrawingBox
                  ? '📐 Mapa fixat: prem i arrossega al mapa (o fes 2 clics) per dibuixar el rectangle (Esc per cancel·lar).'
                  : 'Clica punts al mapa (es posen en blau), traça un rectangle o clica un lot per editar-lo.'}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDrawingBox(v => !v)}
                  style={{
                    flex: 1,
                    background: isDrawingBox ? '#0369a1' : '#f0f9ff',
                    color: isDrawingBox ? 'white' : '#0369a1',
                    border: '1px solid #7dd3fc',
                    borderRadius: '7px',
                    padding: '0.4rem 0.55rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <SquareDashedMousePointer size={14} />
                  <span>{isDrawingBox ? 'Cancel·lar rectangle' : 'Traçar rectangle al mapa'}</span>
                </button>

                <button
                  type="button"
                  disabled={builderSelectedLamps.length === 0}
                  onClick={() => {
                    setLotBuilderNotice('');
                    if (onChangeLotDraft) onChangeLotDraft({ ...lotDraft, lampCodes: [] });
                  }}
                  style={{
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.4rem 0.6rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: builderSelectedLamps.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: builderSelectedLamps.length === 0 ? 0.5 : 1
                  }}
                >
                  Netejar ({builderSelectedLamps.length})
                </button>
              </div>

              {/* Quick Street Adder */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <select
                  value={quickStreet}
                  onChange={(e) => setQuickStreet(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem' }}
                >
                  <option value="">Afegir tram lliure per carrer...</option>
                  {inventoryCounts.streets.map(s => (
                    <option key={s.street} value={s.street}>
                      {s.street} ({s.selectedFree} sel. · {s.freeApt} lliures)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!quickStreet}
                  onClick={handleAddQuickStreet}
                  style={{
                    background: quickStreet ? '#eff6ff' : '#f1f5f9',
                    color: quickStreet ? '#1d4ed8' : '#94a3b8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: quickStreet ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + Carrer
                </button>
              </div>
            </div>

            {/* Active Selection Summary + Homogeneous Mark / Unmark `SELECCIONADA` Actions */}
            <div style={{
              background: builderSelectedLamps.length > 0 ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${builderSelectedLamps.length > 0 ? '#93c5fd' : '#e2e8f0'}`,
              borderRadius: '8px',
              padding: '0.55rem 0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Lightbulb size={14} color="#0284c7" />
                  <span>Punts marcats en blau: <strong style={{ color: '#0284c7' }}>{builderSelectedLamps.length}</strong></span>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.72rem', maxWidth: '145px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {builderDetectedStreet || 'Cap farola'}
                </span>
              </div>

              {builderSelectedLamps.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.73rem', fontWeight: 700, flexWrap: 'wrap' }}>
                  <span style={{ color: '#15803d' }}>✔ {alreadySelectedInDraft.length} Seleccionades</span>
                  <span>·</span>
                  <span style={{ color: pendingAptaInDraft.length > 0 ? '#b45309' : '#64748b' }}>
                    ⚪ {pendingAptaInDraft.length} No seleccionades
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button
                  type="button"
                  disabled={pendingAptaInDraft.length === 0}
                  onClick={() => handleMarkSelectionState(true)}
                  style={{
                    width: '100%',
                    background: pendingAptaInDraft.length > 0 ? '#16a34a' : '#f1f5f9',
                    color: pendingAptaInDraft.length > 0 ? 'white' : '#94a3b8',
                    border: pendingAptaInDraft.length > 0 ? 'none' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.42rem 0.55rem',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: pendingAptaInDraft.length > 0 ? 'pointer' : 'not-allowed'
                  }}
                  title="Marca com a Seleccionades les faroles que encara no ho estan (sense crear lot)"
                >
                  ✔ Marcar com a Seleccionades ({pendingAptaInDraft.length})
                </button>

                <button
                  type="button"
                  disabled={alreadySelectedInDraft.length === 0}
                  onClick={() => handleMarkSelectionState(false)}
                  style={{
                    width: '100%',
                    background: alreadySelectedInDraft.length > 0 ? '#fffbeb' : '#f1f5f9',
                    color: alreadySelectedInDraft.length > 0 ? '#b45309' : '#94a3b8',
                    border: `1px solid ${alreadySelectedInDraft.length > 0 ? '#fcd34d' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    padding: '0.42rem 0.55rem',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: alreadySelectedInDraft.length > 0 ? 'pointer' : 'not-allowed'
                  }}
                  title="Desmarca com a Seleccionades aquestes faroles (si pertanyien a un lot, se'n retiren)"
                >
                  ⚪ Desmarcar com a Seleccionades ({alreadySelectedInDraft.length})
                </button>
              </div>
            </div>

            {/* Lot Creation / Edition Section (Strictly `SELECCIONADA` streetlamps) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.6rem 0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.48rem'
            }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.77rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{lotDraft.isEditing ? `Guardar ${lotDraft.id}` : 'Agrupar en un Lot de Fanals'}</span>
                {lotDraft.isEditing && onDeleteLot && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Segur que voleu eliminar el ${lotDraft.id}? Les faroles es mantindran com a Seleccionades sense lot.`)) {
                        onDeleteLot(lotDraft.id);
                      }
                    }}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '5px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                    title="Eliminar aquest lot"
                  >
                    <Trash2 size={11} />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.72rem', marginBottom: '2px' }}>
                  Nom del lot (opcional; s'autogenera si es deixa buit)
                </label>
                <input
                  type="text"
                  placeholder={builderDetectedStreet ? `Ex. Lot - ${builderDetectedStreet}` : 'Ex. Lot 01 - Carrer Major'}
                  value={lotDraft.name || ''}
                  onChange={(e) => {
                    if (onChangeLotDraft) onChangeLotDraft({ ...lotDraft, name: e.target.value });
                  }}
                  style={{ width: '100%', padding: '0.38rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.74rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(lotDraft.reserved)}
                  onChange={(e) => {
                    if (onChangeLotDraft) onChangeLotDraft({ ...lotDraft, reserved: e.target.checked });
                  }}
                />
                <span>Reservar lot per a actes municipals / Festa Major</span>
              </label>

              {pendingAptaInDraft.length > 0 && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '0.4rem 0.55rem',
                  fontSize: '0.72rem',
                  color: '#92400e',
                  lineHeight: 1.3
                }}>
                  Un lot només el poden conformar faroles <strong>✔ Seleccionades</strong>. Hi ha <strong>{pendingAptaInDraft.length}</strong> faroles encara no seleccionades.
                </div>
              )}

              <button
                type="submit"
                disabled={builderSelectedLamps.length === 0}
                style={{
                  width: '100%',
                  background: builderSelectedLamps.length === 0
                    ? '#94a3b8'
                    : (lotDraft.isEditing ? '#b45309' : '#4a7729'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.8rem',
                  fontWeight: 800,
                  fontSize: '0.79rem',
                  cursor: builderSelectedLamps.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Check size={15} />
                <span>
                  {builderSelectedLamps.length === 0
                    ? (lotDraft.isEditing ? 'Marqueu punts per al lot' : 'Crear Lot (0 faroles)')
                    : pendingAptaInDraft.length > 0
                      ? (lotDraft.isEditing
                        ? `Marcar com a Seleccionades i Desar ${lotDraft.id} (${builderSelectedLamps.length})`
                        : `Marcar com a Seleccionades i Crear Lot (${builderSelectedLamps.length})`)
                      : (lotDraft.isEditing
                        ? `Desar ${lotDraft.id} (${alreadySelectedInDraft.length} Seleccionades)`
                        : `Crear Lot (${alreadySelectedInDraft.length} Seleccionades)`)}
                </span>
              </button>

              {pendingAptaInDraft.length > 0 && alreadySelectedInDraft.length > 0 && (
                <button
                  type="button"
                  onClick={() => submitBuilderLot({ promotePending: false })}
                  style={{
                    width: '100%',
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '7px',
                    padding: '0.38rem 0.65rem',
                    fontWeight: 700,
                    fontSize: '0.73rem',
                    cursor: 'pointer'
                  }}
                >
                  {lotDraft.isEditing
                    ? `Desar ${lotDraft.id} només amb les ${alreadySelectedInDraft.length} ja Seleccionades`
                    : `Crear Lot només amb les ${alreadySelectedInDraft.length} ja Seleccionades`}
                </button>
              )}
            </div>

            {/* Quick Links to Admin Tables */}
            {onOpenAdminTab && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => onOpenAdminTab('SUITABILITY')}
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.4rem 0.55rem',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Settings size={13} />
                  <span>Taula Faroles</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAdminTab('LOTS')}
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.4rem 0.55rem',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <PackagePlus size={13} />
                  <span>Taula Lots ({lots.length})</span>
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Floating Panel: On-Map Fixed Location (`Emplaçament`) Creator & Editor */}
      {isLocationEditorMode && locationDraft && (
        <form
          onSubmit={handleSaveMapLocation}
          className="map-side-panel"
          style={{
            width: '360px',
            border: `2px solid ${locationDraft.isEditing ? '#d97706' : '#4a7729'}`,
            zIndex: 1150
          }}
        >
          {/* Header */}
          <div style={{
            background: locationDraft.isEditing ? '#b45309' : '#4a7729',
            color: 'white',
            padding: '0.65rem 0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <MapPin size={17} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {locationDraft.isEditing ? `Editant ${locationDraft.id}` : 'Nou Emplaçament al Mapa'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {locationDraft.isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setLocBuilderNotice('');
                    setIsRelocatingPin(false);
                    if (onChangeLocationDraft) onChangeLocationDraft({ ...EMPTY_LOCATION_DRAFT });
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.45)',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Crear un nou emplaçament"
                >
                  Nou
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsRelocatingPin(false);
                  if (onChangeAdminMapMode) onChangeAdminMapMode('VIEW');
                }}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}
                title="Tancar editor d'emplaçaments"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.58rem', fontSize: '0.79rem', overflowY: 'auto', minHeight: 0 }}>
            {/* Map Coordinate Picker Status */}
            <div style={{
              background: isPlacingLocationClick ? '#eff6ff' : '#f0fdf4',
              border: `1.5px solid ${isPlacingLocationClick ? '#93c5fd' : '#86efac'}`,
              borderRadius: '8px',
              padding: '0.5rem 0.65rem',
              fontSize: '0.75rem',
              color: isPlacingLocationClick ? '#1e3a8a' : '#14532d'
            }}>
              {(locationDraft.isEditing || locationDraft.hasCoords) ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                    <span>
                      <strong>📍 Coordenades:</strong>{' '}
                      <code>{Number(locationDraft.lat).toFixed(5)}, {Number(locationDraft.lng).toFixed(5)}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRelocatingPin(v => !v)}
                      style={{
                        background: isRelocatingPin ? '#0284c7' : '#ffffff',
                        color: isRelocatingPin ? '#ffffff' : '#0369a1',
                        border: '1px solid #7dd3fc',
                        borderRadius: '5px',
                        padding: '2px 7px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Crosshair size={11} />
                      <span>{isRelocatingPin ? 'Cancel·lar' : 'Moure clicant al mapa'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '3px' }}>
                    {isRelocatingPin
                      ? '👆 Fes clic al nou punt del mapa on vols moure la xinxeta.'
                      : 'Pots arrossegar la xinxeta 📍 directament o clicar una altra 📍 per editar-la.'}
                  </div>
                </div>
              ) : (
                <div>
                  <strong>👆 Pas 1 — Fes clic al mapa</strong> al punt exacte on vols ubicar la cartellera, panell o pancarta (o clica un 📍 existent per editar-lo).
                </div>
              )}
            </div>

            {locBuilderNotice && (
              <div style={{
                background: locBuilderNotice.startsWith('✔') ? '#f0fdf4' : '#fffbeb',
                color: locBuilderNotice.startsWith('✔') ? '#15803d' : '#b45309',
                border: `1px solid ${locBuilderNotice.startsWith('✔') ? '#86efac' : '#fde68a'}`,
                borderRadius: '6px',
                padding: '0.45rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {locBuilderNotice}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                Nom de l'emplaçament *
              </label>
              <input
                type="text"
                placeholder="Ex. Cartellera Plaça Major"
                value={locationDraft.name || ''}
                onChange={(e) => {
                  if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, name: e.target.value });
                }}
                style={{ width: '100%', padding: '0.4rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '0.45rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                  Tipus de suport
                </label>
                <select
                  value={locationDraft.type || 'CARTELLERA'}
                  onChange={(e) => {
                    if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, type: e.target.value });
                  }}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }}
                >
                  <option value="CARTELLERA">Cartellera</option>
                  <option value="PANCARTA">Pancarta</option>
                  <option value="PANELL">Panell / Monòlit</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                  Capacitat
                </label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={locationDraft.capacity ?? 2}
                  onChange={(e) => {
                    if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, capacity: e.target.value });
                  }}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }}
                  title="Nombre màxim de candidatures en aquest emplaçament"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                Adreça / Ubicació (s'autocompleta amb el carrer proper)
              </label>
              <input
                type="text"
                placeholder="Ex. Plaça Major, s/n"
                value={locationDraft.address || ''}
                onChange={(e) => {
                  if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, address: e.target.value });
                }}
                style={{ width: '100%', padding: '0.4rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.79rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                Observacions / Mides (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex. 2m x 1,5m · Orientació sud"
                value={locationDraft.description || ''}
                onChange={(e) => {
                  if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, description: e.target.value });
                }}
                style={{ width: '100%', padding: '0.4rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.73rem', marginBottom: '3px' }}>
                Fotografia (URL o fitxer opcional)
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="https://... o puja foto"
                  value={locationDraft.imageUrl?.startsWith('data:') ? '(Imatge carregada)' : (locationDraft.imageUrl || '')}
                  onChange={(e) => {
                    if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, imageUrl: e.target.value });
                  }}
                  readOnly={Boolean(locationDraft.imageUrl?.startsWith('data:'))}
                  style={{ flex: 1, minWidth: 0, padding: '0.38rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.76rem' }}
                />
                <label style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.38rem 0.55rem',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  <ImageIcon size={13} />
                  <span>Foto</span>
                  <input type="file" accept="image/*" onChange={handleLocationImageSelect} style={{ display: 'none' }} />
                </label>
                {locationDraft.imageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeLocationDraft) onChangeLocationDraft({ ...locationDraft, imageUrl: '' });
                    }}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.35rem 0.45rem', cursor: 'pointer', display: 'flex' }}
                    title="Treure imatge"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.15rem' }}>
              {locationDraft.isEditing && onDeleteLocation && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Segur que voleu eliminar l'emplaçament ${locationDraft.id} (${locationDraft.name})?`)) {
                      onDeleteLocation(locationDraft.id);
                      if (onChangeLocationDraft) onChangeLocationDraft({ ...EMPTY_LOCATION_DRAFT });
                      setLocBuilderNotice('⚪ Emplaçament eliminat.');
                    }
                  }}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '0.5rem 0.65rem',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Eliminar emplaçament"
                >
                  <Trash2 size={14} />
                </button>
              )}

              <button
                type="submit"
                disabled={!(locationDraft.isEditing || locationDraft.hasCoords) || !locationDraft.name?.trim()}
                style={{
                  flex: 1,
                  background: (!(locationDraft.isEditing || locationDraft.hasCoords) || !locationDraft.name?.trim())
                    ? '#94a3b8'
                    : (locationDraft.isEditing ? '#b45309' : '#4a7729'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.52rem 0.85rem',
                  fontWeight: 800,
                  fontSize: '0.81rem',
                  cursor: (!(locationDraft.isEditing || locationDraft.hasCoords) || !locationDraft.name?.trim()) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Check size={15} />
                <span>
                  {locationDraft.isEditing
                    ? `Desar ${locationDraft.id}`
                    : (locationDraft.hasCoords ? 'Crear Emplaçament' : 'Clica primer un punt al mapa')}
                </span>
              </button>
            </div>

            {onOpenAdminTab && (
              <button
                type="button"
                onClick={() => onOpenAdminTab('LOCATIONS')}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '0.4rem 0.6rem',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Settings size={13} />
                <span>Obrir Taula d'Emplaçaments ({locations.length})</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Main Leaflet Map (preferCanvas for smooth rendering of all 1,540 streetlamps) */}
      <MapContainer
        center={centerCoords}
        zoom={15}
        preferCanvas={true}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <MapSearchController focusRequest={effectiveFocusRequest} />
        <MapActiveLotFitter activeLot={activeSelectedLot} enabled={role === 'PARTY'} />
        <MapInteractionController
          isPlacingLocationClick={isPlacingLocationClick}
          onPickLocationEditorCoords={handlePickLocationEditorCoords}
          isDrawingBox={isDrawingBox}
          onFinishBox={handleFinishBox}
          onCancelBox={() => setIsDrawingBox(false)}
        />

        {mapType === 'OSM' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {/* Live Convex Hull Preview for Working Selection */}
        {isMapEditorMode && builderPreviewPolygon.length > 0 && (
          <Polygon
            positions={builderPreviewPolygon}
            interactive={false}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.30,
              weight: 2.5,
              dashArray: '6, 4'
            }}
          />
        )}

        {/* Render Existing Streetlight Lots (each with its own distinct palette color) */}
        {lots && lots.map((lot, lotIdx) => {
          if (!lot.coords || lot.coords.length === 0) return null;
          if (isMapEditorMode && lotDraft?.isEditing && lotDraft.id === lot.id) {
            return null;
          }

          const isHighlight = highlightedLotId === lot.id;
          const isCurrentlySelectedLot = selectedLotId === lot.id;
          const activeLotCodes = new Set(
            (lot.lamps || [])
              .filter(l => (l.status ? l.status === 'SELECCIONADA' : l.suitable !== false))
              .map(l => String(l.codi))
          );
          const partyOrderedCodes = role === 'PARTY'
            ? extractOrderedCodes(lotPreferences?.[lot.id]).filter(c => activeLotCodes.has(c))
            : [];
          const numberedCount = partyOrderedCodes.length;
          const minLotQ = partyId ? Number(lot.partyMinQuotas?.[partyId] ?? lot.partyQuotas?.[partyId] ?? 0) : 0;
          const maxLotQ = partyId ? Number(lot.partyMaxQuotas?.[partyId] ?? lot.partyQuotas?.[partyId] ?? minLotQ) : 0;
          const resolvedLotQ = partyId
            ? Number(allocationResults?.resolvedLotQuotas?.[lot.id]?.[partyId] ?? lot.partyQuotas?.[partyId] ?? minLotQ)
            : 0;
          const partyLotRank = partyLotRankById.get(lot.id) || null;
          const lotLampMap = allocationResults?.lotLampAssignments?.[lot.id] || {};
          const wonByMeInLot = partyId
            ? Number(allocationResults?.lotPartyCounts?.[lot.id]?.[partyId]) || 0
            : 0;

          const distinctColor = lotColorById.get(lot.id) || getLotPaletteColor(lot, lotIdx);
          let polygonColor = distinctColor;
          let badgeBg = distinctColor;
          let badgeText = String(lot.lampCount || 0);
          let badgeBorder = '#ffffff';

          if (lot.reserved) {
            polygonColor = '#dc2626';
            badgeBg = '#dc2626';
            badgeBorder = '#7f1d1d';
            badgeText = '✖';
          } else if (lot.lampCount <= 0) {
            polygonColor = '#b45309';
            badgeBg = '#b45309';
            badgeBorder = '#78350f';
            badgeText = '⚠️';
          } else if (isAllocated) {
            badgeBg = '#334155';
            badgeText = role === 'PARTY' ? `${wonByMeInLot}/${resolvedLotQ}` : `${lot.lampCount}`;
            if (role === 'PARTY' && wonByMeInLot > 0) {
              badgeBg = partyColor || '#15803d';
            }
          } else if (role === 'PARTY') {
            const rankPrefix = partyLotRank ? `${formatOrdinalCa(partyLotRank)} · ` : '';
            const isComplete = maxLotQ > 0 ? numberedCount >= maxLotQ : numberedCount > 0;
            if (numberedCount > 0 && isComplete) {
              badgeBg = '#16a34a';
              badgeText = `${rankPrefix}✔ ${numberedCount}/${lot.lampCount}`;
            } else if (numberedCount > 0) {
              badgeBg = '#f59e0b';
              badgeText = `${rankPrefix}${numberedCount}/${lot.lampCount}`;
            } else {
              badgeBg = distinctColor;
              badgeText = `${rankPrefix}${lot.id}`;
            }
          } else if (isMapEditorMode) {
            badgeText = `${lot.id} (${lot.lampCount}) ✏️`;
          }

          const midIndex = Math.floor(lot.coords.length / 2);
          const centerPos = lot.coords[midIndex] || lot.coords[0];
          const areaPolygonCoords = createLotAreaPolygon(lot.coords, 18);

          return (
            <React.Fragment key={lot.id}>
              <Polygon
                positions={areaPolygonCoords}
                interactive={!isMapEditorMode}
                pathOptions={{
                  color: isHighlight ? '#f59e0b' : (isCurrentlySelectedLot ? '#0f172a' : polygonColor),
                  fillColor: polygonColor,
                  fillOpacity: isMapEditorMode
                    ? 0.24
                    : (isHighlight ? 0.50 : (isCurrentlySelectedLot ? 0.22 : (isAllocated ? 0.16 : 0.28))),
                  weight: isHighlight || isCurrentlySelectedLot ? 3.2 : 2.3,
                  dashArray: lot.reserved ? '6, 6' : null
                }}
                eventHandlers={{
                  click: () => {
                    if (!interactionBusy) onSelectLot(lot);
                  }
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: '0.84rem' }}>
                    <strong>{lot.id} — {lot.name}</strong><br />
                    <span>
                      Faroles seleccionades al lot: <strong>{lot.lampCount}</strong>
                    </span><br />
                    {lot.reserved ? (
                      <span style={{ color: '#dc2626', fontWeight: 'bold' }}>✖ RESERVAT ({lot.reservedReason || 'Acte municipal'})</span>
                    ) : isAllocated ? (
                      <span>
                        {role === 'PARTY'
                          ? `Adjudicats a la vostra candidatura: ${wonByMeInLot} / ${resolvedLotQ}`
                          : 'Lot repartit proporcionalment entre candidatures (clic per veure el detall)'}
                      </span>
                    ) : role === 'PARTY' ? (
                      <span>
                        {partyLotRank ? <>Importància: <strong>{formatOrdinalCa(partyLotRank)} lot</strong> · </> : null}
                        Quota: <strong>{minLotQ === maxLotQ ? minLotQ : `${minLotQ}–${maxLotQ}`}</strong> · Numerades: <strong>{numberedCount}/{lot.lampCount}</strong>
                      </span>
                    ) : (
                      <span>Fes clic per veure les quotes i faroles del lot</span>
                    )}
                  </div>
                </Tooltip>
              </Polygon>

              {/* Individual streetlamps inside the lot when full inventory layer is hidden */}
              {!shouldRenderAllLamps && lot.lamps && lot.lamps.map((lamp, lIdx) => {
                const lampIsSel = lamp.status ? lamp.status === 'SELECCIONADA' : Boolean(lamp.selected);
                const codeStr = String(lamp.codi);
                const winnerId = lotLampMap[codeStr] || allocationResults?.lampAssignments?.[codeStr] || null;
                const winnerParty = winnerId ? partyById.get(winnerId) : null;

                // Interactive numbered badge pins when a PARTY has opened this lot!
                if (role === 'PARTY' && isCurrentlySelectedLot && lampIsSel && !lot.reserved) {
                  const rankIdx = partyOrderedCodes.indexOf(codeStr);
                  const isNumbered = rankIdx !== -1;

                  if (isAllocated) {
                    return (
                      <Marker
                        key={codeStr || lIdx}
                        position={[lamp.lat, lamp.lng]}
                        icon={createActiveLampPinIcon({
                          label: winnerParty ? winnerParty.acronym.slice(0, 3) : '·',
                          bgColor: winnerParty ? winnerParty.color : '#64748b',
                          borderColor: winnerId === partyId ? '#fde047' : '#ffffff',
                          size: winnerId === partyId ? 27 : 23
                        })}
                      >
                        <Tooltip direction="top">
                          <div style={{ fontSize: '0.78rem' }}>
                            <strong>{lamp.codi}</strong> — {lamp.carrer} ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})<br />
                            {winnerParty ? (
                              <strong style={{ color: winnerParty.color }}>Adjudicada a: {winnerParty.name} ({winnerParty.acronym})</strong>
                            ) : (
                              <span>Lliure</span>
                            )}
                          </div>
                        </Tooltip>
                      </Marker>
                    );
                  }

                  return (
                    <Marker
                      key={codeStr || lIdx}
                      position={[lamp.lat, lamp.lng]}
                      icon={createActiveLampPinIcon({
                        label: isNumbered ? String(rankIdx + 1) : '+',
                        bgColor: isNumbered ? (partyColor || '#16a34a') : '#ffffff',
                        borderColor: isNumbered ? '#ffffff' : '#16a34a',
                        textColor: isNumbered ? '#ffffff' : '#15803d',
                        size: isNumbered ? 26 : 23
                      })}
                      eventHandlers={{
                        click: (e) => {
                          e.originalEvent.stopPropagation();
                          if (canPartyEditLamps) {
                            toggleLampInPartyOrder(lot, codeStr);
                          }
                        }
                      }}
                    >
                      <Tooltip direction="top">
                        <div style={{ fontSize: '0.78rem' }}>
                          <strong>{lamp.codi}</strong> — {lamp.carrer} ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})<br />
                          {isNumbered ? (
                            <strong style={{ color: '#15803d' }}>
                              Prioritat #{rankIdx + 1} {canPartyEditLamps ? '(clic per desnumerar)' : ''}
                            </strong>
                          ) : (
                            <span style={{ color: '#0369a1', fontWeight: 700 }}>
                              {canPartyEditLamps ? `Clic per assignar prioritat #${partyOrderedCodes.length + 1}` : 'Sense numerar'}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    </Marker>
                  );
                }

                // Standard CircleMarker for non-expanded lots (colored by winning party when ALLOCATED, else lot's distinct color!)
                const dotFill = isAllocated && winnerParty ? winnerParty.color : polygonColor;
                const dotBorder = isAllocated && winnerId === partyId ? '#fde047' : '#ffffff';

                return (
                  <CircleMarker
                    key={codeStr || lIdx}
                    center={[lamp.lat, lamp.lng]}
                    radius={isAllocated ? 5.2 : 4.6}
                    pathOptions={{
                      color: dotBorder,
                      fillColor: dotFill,
                      fillOpacity: 0.95,
                      weight: isAllocated && winnerId === partyId ? 2.2 : 1.6
                    }}
                    eventHandlers={{
                      click: (e) => {
                        if (interactionBusy) return;
                        e.originalEvent.stopPropagation();
                        onSelectLot(lot);
                      }
                    }}
                  >
                    {isAllocated && winnerParty && (
                      <Tooltip direction="top">
                        <div style={{ fontSize: '0.77rem' }}>
                          <strong>{lamp.codi}</strong> ({lot.id}) — <strong>{winnerParty.acronym}</strong>
                        </div>
                      </Tooltip>
                    )}
                  </CircleMarker>
                );
              })}

              {/* Center Badge of Lot: in Map Editor Mode clicking loads the lot directly for editing! */}
              {!(role === 'PARTY' && isCurrentlySelectedLot) && (
                <Marker
                  position={centerPos}
                  icon={createLotMarkerIcon({
                    badgeText,
                    bgColor: badgeBg,
                    borderColor: badgeBorder
                  })}
                  eventHandlers={{
                    click: (e) => {
                      if (isDrawingBox) return;
                      e.originalEvent.stopPropagation();
                      if (isMapEditorMode) {
                        if (onEditLotOnMap) {
                          setLotBuilderNotice('');
                          onEditLotOnMap(lot);
                        }
                      } else {
                        onSelectLot(lot);
                      }
                    }
                  }}
                >
                  {isMapEditorMode && (
                    <Tooltip direction="top">
                      <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Clic per editar {lot.id} ({lot.lampCount} faroles seleccionades)
                      </span>
                    </Tooltip>
                  )}
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {/* Render Top-Level Municipal Streetlamps Inventory (3 states: NO_APTA, APTA, SELECCIONADA) */}
        {shouldRenderAllLamps && lamps.map((lamp) => {
          const isNoApta = isLampNoApta(lamp);
          if (isNoApta) {
            if (!showLockedNoAptes) return null;
          } else {
            const isSelectedBuilder = selectedBuilderSet.has(lamp.codi);
            if (!isSelectedBuilder && !matchesActiveMapFilter(lamp)) {
              return null;
            }
          }

          const isSelected = !isNoApta && isLampSelected(lamp);
          const isSelectedBuilder = !isNoApta && selectedBuilderSet.has(lamp.codi);
          const inOtherLot = Boolean(lamp.lotId && (!lotDraft?.isEditing || lamp.lotId !== lotDraft.id));

          let radius = 5;
          let fillColor = '#fde047';
          let borderColor = '#a16207';
          let weight = 1.6;

          if (isNoApta) {
            radius = 3.2;
            fillColor = '#cbd5e1';
            borderColor = '#ef4444';
            weight = 1.2;
          } else if (isSelectedBuilder) {
            radius = 7.2;
            fillColor = '#0284c7';
            borderColor = '#fef08a';
            weight = 2.5;
          } else if (isSelected && !inOtherLot) {
            radius = 6;
            fillColor = '#16a34a';
            borderColor = '#ffffff';
            weight = 1.8;
          } else if (isSelected && inOtherLot) {
            radius = 5.8;
            fillColor = lotColorById.get(lamp.lotId) || '#0d9488';
            borderColor = '#ffffff';
            weight = 1.8;
          }

          return (
            <CircleMarker
              key={lamp.codi}
              center={[lamp.lat, lamp.lng]}
              radius={radius}
              interactive={!isDrawingBox}
              pathOptions={{
                color: borderColor,
                fillColor,
                fillOpacity: isNoApta ? 0.65 : 0.94,
                weight
              }}
              eventHandlers={{
                click: (e) => {
                  if (isDrawingBox) return;
                  e.originalEvent.stopPropagation();
                  if (isNoApta) return;
                  toggleLampInLotDraft(lamp);
                }
              }}
            >
              <Tooltip direction="top">
                <div style={{ fontSize: '0.78rem' }}>
                  <strong>{lamp.codi}</strong> — {lamp.carrer} ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})<br />
                  <span>Suport: {lamp.suport} · </span>
                  {isNoApta ? (
                    <strong style={{ color: '#dc2626' }}>
                      🔒 NO APTA (No seleccionable)
                    </strong>
                  ) : isSelected ? (
                    <strong style={{ color: '#16a34a' }}>
                      ✔ SELECCIONADA{lamp.lotId ? ` · En ${lamp.lotId}` : ' · Sense lot'}
                    </strong>
                  ) : (
                    <strong style={{ color: '#a16207' }}>
                      ⚪ NO SELECCIONADA (Apta)
                    </strong>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Draft Preview Marker when Placing a New Fixed Location on the Map */}
        {isLocationEditorMode && locationDraft && !locationDraft.isEditing && locationDraft.hasCoords && (
          <Marker
            position={[Number(locationDraft.lat), Number(locationDraft.lng)]}
            draggable={true}
            icon={createLocationMarkerIcon({ isDraftPreview: true })}
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                handlePickLocationEditorCoords([Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))]);
              }
            }}
          >
            <Tooltip direction="top" permanent>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0369a1' }}>
                📍 Nou: {locationDraft.name?.trim() || 'Emplaçament en creació'}
              </span>
            </Tooltip>
          </Marker>
        )}

        {/* Render Billboard / Location Markers */}
        {locations && locations.map((loc) => {
          const isBeingEdited = Boolean(isLocationEditorMode && locationDraft?.isEditing && locationDraft.id === loc.id);
          const markerLat = isBeingEdited ? Number(locationDraft.lat) : loc.lat;
          const markerLng = isBeingEdited ? Number(locationDraft.lng) : loc.lng;

          const partyLocRankIdx = role === 'PARTY' ? partyOrderedLocationIds.indexOf(loc.id) : -1;
          const isPartyNumberedLoc = partyLocRankIdx !== -1;
          const assignedLocPartyIds = allocationResults?.locationAssignments?.[loc.id] || [];
          const partyWonThisLoc = Boolean(partyId && assignedLocPartyIds.includes(partyId));

          let markerIcon;
          if (role === 'PARTY' && !isAllocated) {
            if (isPartyNumberedLoc) {
              markerIcon = createLocationMarkerIcon({
                rankLabel: `#${partyLocRankIdx + 1}`,
                partyColor: partyColor || '#4a7729'
              });
            } else if (isPartySelectingLocations) {
              markerIcon = createLocationMarkerIcon({ isUnnumberedInteractive: true });
            } else {
              markerIcon = createLocationMarkerIcon();
            }
          } else if (role === 'PARTY' && isAllocated && partyWonThisLoc) {
            markerIcon = createLocationMarkerIcon({
              rankLabel: '✔',
              partyColor: partyColor || '#15803d'
            });
          } else {
            markerIcon = createLocationMarkerIcon({ isBeingEdited });
          }

          return (
            <Marker
              key={loc.id}
              position={[markerLat, markerLng]}
              draggable={role === 'ADMIN' && (!interactionBusy || isLocationEditorMode)}
              icon={markerIcon}
              eventHandlers={{
                click: (e) => {
                  if (isLocationEditorMode && onEditLocation) {
                    e.originalEvent.stopPropagation();
                    setLocBuilderNotice('');
                    setIsRelocatingPin(false);
                    onEditLocation(loc);
                  } else if (role === 'PARTY') {
                    e.originalEvent.stopPropagation();
                    if (isPartySelectingLocations && canPartyEditLamps) {
                      toggleLocationInPartyOrder(loc.id);
                    } else if (onOpenEmplacaments) {
                      onOpenEmplacaments();
                    }
                  }
                },
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  const nextLat = Number(pos.lat.toFixed(6));
                  const nextLng = Number(pos.lng.toFixed(6));
                  if (isBeingEdited && onChangeLocationDraft) {
                    onChangeLocationDraft({ ...locationDraft, lat: nextLat, lng: nextLng, hasCoords: true });
                  } else if (role === 'ADMIN' && onMoveLocation) {
                    onMoveLocation(loc, nextLat, nextLng);
                  }
                }
              }}
            >
              {!isLocationEditorMode && role !== 'PARTY' && (
                <Popup minWidth={230}>
                  <div style={{ padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#ecfdf5', color: '#15803d', padding: '1px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>
                        {loc.id} · {loc.type || 'PANELL'}
                      </span>
                      <a
                        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${loc.lat},${loc.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                      >
                        <span>Street View</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '0.95rem', color: '#4a7729' }}>{loc.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 6px 0' }}>{loc.address}</p>
                    {loc.imageUrl && (
                      <img
                        src={loc.imageUrl}
                        alt={loc.name}
                        style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }}
                      />
                    )}
                    {loc.description && (
                      <p style={{ fontSize: '0.78rem', color: '#334155', margin: '0 0 4px 0' }}>{loc.description}</p>
                    )}
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      Capacitat: {loc.capacity} partit(s)
                    </p>
                    {role === 'ADMIN' && onEditLocation && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Arrossega la xinxeta per moure</span>
                        <button
                          type="button"
                          onClick={() => onEditLocation(loc)}
                          style={{
                            background: '#4a7729',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit2 size={12} />
                          <span>Editar al Mapa</span>
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
              {isLocationEditorMode && (
                <Tooltip direction="top">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    {loc.id} — {loc.name} (clic per editar)
                  </span>
                </Tooltip>
              )}
              {role === 'PARTY' && (
                <Tooltip direction="top">
                  <div style={{ fontSize: '0.77rem' }}>
                    <strong>{loc.id} — {loc.name}</strong> ({loc.type || 'PANELL'} · Cap: {loc.capacity})<br />
                    {isAllocated ? (
                      <span>
                        {partyWonThisLoc ? '✔ Adjudicat a la vostra candidatura' : 'Emplaçament adjudicat'}
                      </span>
                    ) : isPartyNumberedLoc ? (
                      <strong style={{ color: '#15803d' }}>
                        Prioritat #{partyLocRankIdx + 1} {isPartySelectingLocations && canPartyEditLamps ? '(clic per desnumerar)' : '(clic per obrir panell)'}
                      </strong>
                    ) : (
                      <span style={{ color: '#0369a1', fontWeight: 700 }}>
                        {isPartySelectingLocations && canPartyEditLamps
                          ? `Clic per assignar prioritat #${partyOrderedLocationIds.length + 1}`
                          : 'Clic per numerar emplaçaments'}
                      </span>
                    )}
                  </div>
                </Tooltip>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
