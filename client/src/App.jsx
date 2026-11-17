import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import Header from './components/Header';
import MapViewer from './components/MapViewer';
import LoginModal from './components/LoginModal';
import { EMPTY_LOCATION_DRAFT, EMPTY_LOT_DRAFT } from './adminDrafts';
import {
  apiFetch,
  fetchDbState,
  loadStoredSession,
  saveStoredSession,
  clearStoredSession,
  setUnauthorizedHandler
} from './api';

const PartySelectionPanel = lazy(() => import('./components/PartySelectionPanel'));
const LotSelectionModal = lazy(() => import('./components/LotSelectionModal'));
const InfoModal = lazy(() => import('./components/InfoModal'));
const RestorePastModal = lazy(() => import('./components/RestorePastModal'));
const AllocationAnimationModal = lazy(() => import('./components/AllocationAnimationModal'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  const initialSession = loadStoredSession();
  const [user, setUser] = useState(initialSession?.user || null);
  const [role, setRole] = useState(initialSession?.role || null);
  const [dbData, setDbData] = useState(null);

  // Modal & Party Panel States
  const [showLogin, setShowLogin] = useState(!initialSession);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [partyActiveTab, setPartyActiveTab] = useState('LOTS'); // 'LOTS' | 'LOCATIONS'
  const [isPartyPanelMinimized, setIsPartyPanelMinimized] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showRestorePast, setShowRestorePast] = useState(false);
  const [showAllocationAnim, setShowAllocationAnim] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState('SUITABILITY');
  const [highlightedLotId, setHighlightedLotId] = useState(null);

  // Interactive Admin Map & Draft States
  const [adminMapMode, setAdminMapMode] = useState('VIEW'); // 'VIEW' | 'MAP_EDITOR' | 'LOCATION_EDITOR'
  const [locationDraft, setLocationDraft] = useState({ ...EMPTY_LOCATION_DRAFT });
  const [lotDraft, setLotDraft] = useState({ ...EMPTY_LOT_DRAFT });
  const [focusMapRequest, setFocusMapRequest] = useState(null);
  const pendingWritesRef = useRef(0);

  const requestMapFocus = useCallback((lat, lng) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return;
    setFocusMapRequest(prev => ({ lat, lng, seq: (prev?.seq || 0) + 1 }));
  }, []);

  const fetchDbData = useCallback(async ({ force = false } = {}) => {
    if (!force && pendingWritesRef.current > 0) return;
    try {
      const { notModified, data } = await fetchDbState({ force });
      if (!notModified && data && pendingWritesRef.current === 0) {
        setDbData(data);
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setRole(null);
      setAdminMapMode('VIEW');
      setShowLogin(true);
    });
  }, []);

  useEffect(() => {
    fetchDbData({ force: true });

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDbData({ force: false });
      }
    }, 8000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchDbData({ force: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchDbData]);

  // Auth Handlers
  const applyLoginSuccess = async (data) => {
    saveStoredSession({ token: data.token, user: data.user, role: data.role });
    setUser(data.user);
    setRole(data.role);
    setSelectedLotId(null);
    setPartyActiveTab('LOTS');
    setIsPartyPanelMinimized(false);
    setAdminMapMode('VIEW');
    setShowLogin(false);
    await fetchDbData({ force: true });
  };

  const handleLogin = async (username, password, callback) => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        await applyLoginSuccess(data);
      } else {
        callback(data.message || 'Error d\'identificació');
      }
    } catch {
      callback('Error de connexió amb el servidor.');
    }
  };

  const handleDemoLogin = async (targetId, callback) => {
    try {
      const res = await apiFetch('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ targetId })
      });
      const data = await res.json();
      if (data.success) {
        await applyLoginSuccess(data);
      } else {
        callback(data.message || 'Error en l\'accés de prova');
      }
    } catch {
      callback('Error de connexió amb el servidor.');
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    setUser(null);
    setRole(null);
    setSelectedLotId(null);
    setPartyActiveTab('LOTS');
    setIsPartyPanelMinimized(false);
    setShowAdmin(false);
    setShowRestorePast(false);
    setAdminMapMode('VIEW');
    setLotDraft({ ...EMPTY_LOT_DRAFT });
    setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
    setShowLogin(true);
    fetchDbData({ force: true });
  };

  // Party Preference Handlers (Per-Lot Streetlamp Numbering 1..N)
  const handleSaveLotLampOrder = async (lotId, orderedLampCodes) => {
    if (!user || role !== 'PARTY') return;
    const nextCodes = Array.isArray(orderedLampCodes) ? orderedLampCodes : [];

    // Optimistic local state update for responsive map pin clicking
    setDbData(prev => {
      if (!prev) return prev;
      const prevPartyPrefs = { ...(prev.lotPreferences?.[user.id] || {}) };
      if (nextCodes.length === 0) {
        delete prevPartyPrefs[lotId];
      } else {
        prevPartyPrefs[lotId] = { orderedLampCodes: nextCodes };
      }
      return {
        ...prev,
        lotPreferences: {
          ...(prev.lotPreferences || {}),
          [user.id]: prevPartyPrefs
        }
      };
    });

    pendingWritesRef.current += 1;
    try {
      await apiFetch('/preferences/lot-lamps', {
        method: 'POST',
        body: JSON.stringify({ lotId, orderedLampCodes: nextCodes })
      });
    } catch (err) {
      console.error('Error saving lot lamp priority order:', err);
    } finally {
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) {
        fetchDbData({ force: true });
      }
    }
  };

  const handleSaveLotOrder = async (orderedLotIds) => {
    if (!user || role !== 'PARTY') return;
    const nextIds = Array.isArray(orderedLotIds) ? orderedLotIds : [];

    setDbData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        lotOrderPreferences: {
          ...(prev.lotOrderPreferences || {}),
          [user.id]: nextIds
        }
      };
    });

    pendingWritesRef.current += 1;
    try {
      await apiFetch('/preferences/lot-order', {
        method: 'POST',
        body: JSON.stringify({ lotIds: nextIds })
      });
    } catch (err) {
      console.error('Error saving lot importance order:', err);
    } finally {
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) {
        fetchDbData({ force: true });
      }
    }
  };

  const handleSaveLocationPreferences = async (locationIds) => {
    if (!user || role !== 'PARTY') return;
    const nextLocIds = Array.isArray(locationIds) ? locationIds : [];

    setDbData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        locationPreferences: {
          ...(prev.locationPreferences || {}),
          [user.id]: nextLocIds
        }
      };
    });

    pendingWritesRef.current += 1;
    try {
      await apiFetch('/preferences/location', {
        method: 'POST',
        body: JSON.stringify({ locationIds: nextLocIds })
      });
    } catch (err) {
      console.error('Error saving location preference:', err);
    } finally {
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) {
        fetchDbData({ force: true });
      }
    }
  };

  const handleRestorePastPreferences = async (historicalElectionId) => {
    if (!user || role !== 'PARTY') return;
    try {
      await apiFetch('/preferences/restore-past', {
        method: 'POST',
        body: JSON.stringify({ historicalElectionId })
      });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error restoring past preferences:', err);
    }
  };

  const handleResetOwnPreferences = async () => {
    if (!user || role !== 'PARTY') return;
    try {
      await apiFetch('/preferences/reset', { method: 'POST' });
      await fetchDbData({ force: true });
    } catch (err) {
      console.error('Error resetting party own preferences:', err);
    }
  };

  // Admin Election Status & Allocation Handlers
  const handleChangeElectionStatus = async (status) => {
    try {
      await apiFetch('/admin/status', {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error updating election status:', err);
    }
  };

  const handleRunAllocation = async (assignUnselectedRandomly) => {
    try {
      const res = await apiFetch('/admin/allocate', {
        method: 'POST',
        body: JSON.stringify({ assignUnselectedRandomly })
      });
      const data = await res.json();
      if (data.success) {
        await fetchDbData({ force: true });
        setShowAdmin(false);
        setShowAllocationAnim(true);
      }
    } catch (err) {
      console.error('Error running allocation:', err);
    }
  };

  const handleResetAllocation = async () => {
    try {
      const res = await apiFetch('/admin/reset', { method: 'POST' });
      if (res.ok) {
        await fetchDbData({ force: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error resetting allocation:', err);
      return false;
    }
  };

  const handleResetPartyPreferences = async (partyId = null) => {
    try {
      const res = await apiFetch('/admin/preferences/reset', {
        method: 'POST',
        body: JSON.stringify({
          partyId: partyId || undefined,
          resetAllocation: true
        })
      });
      if (res.ok) {
        await fetchDbData({ force: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error resetting party preferences:', err);
      return false;
    }
  };

  // Admin Lamp Selection Handlers (`APTA` <-> `SELECCIONADA` for `Columna` streetlamps)
  const handleToggleLampSuitability = async (lotId, lampId, selectedValue, reason) => {
    try {
      const flag = Boolean(selectedValue);
      await apiFetch('/admin/lamp/suitable', {
        method: 'POST',
        body: JSON.stringify({ lotId, lampId, selected: flag, suitable: flag, unsuitableReason: reason })
      });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error updating lamp selection:', err);
    }
  };

  const handleBatchLampSuitability = async (lampIds, selectedValue, reason) => {
    if (!Array.isArray(lampIds) || lampIds.length === 0) return;
    try {
      const flag = Boolean(selectedValue);
      await apiFetch('/admin/lamp/suitable', {
        method: 'POST',
        body: JSON.stringify({ lampIds, selected: flag, suitable: flag, unsuitableReason: reason })
      });
      await fetchDbData({ force: true });
    } catch (err) {
      console.error('Error updating batch lamp selection:', err);
    }
  };

  const handleBulkSuitability = async (street, selectedValue, unsuitableReason) => {
    try {
      const flag = Boolean(selectedValue);
      await apiFetch('/admin/bulk-suitability', {
        method: 'POST',
        body: JSON.stringify({ street, selected: flag, suitable: flag, unsuitableReason })
      });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error bulk selection update:', err);
    }
  };

  // Admin Lamp Aptitude Handlers (`NO_APTA` <-> `APTA`)
  const handleChangeLampAptitude = async (lampIdsOrSingle, aptaValue, unsuitableReason = '') => {
    const lampIds = Array.isArray(lampIdsOrSingle) ? lampIdsOrSingle : [lampIdsOrSingle];
    if (lampIds.length === 0) return;
    try {
      await apiFetch('/admin/lamp/aptitude', {
        method: 'POST',
        body: JSON.stringify({
          lampIds,
          apta: Boolean(aptaValue),
          unsuitableReason
        })
      });
      await fetchDbData({ force: true });
    } catch (err) {
      console.error('Error updating lamp aptitude:', err);
    }
  };

  const handleResetDefaultAptitude = async () => {
    try {
      await apiFetch('/admin/lamp/aptitude', {
        method: 'POST',
        body: JSON.stringify({ resetDefault: true })
      });
      await fetchDbData({ force: true });
    } catch (err) {
      console.error('Error resetting default lamp aptitude:', err);
    }
  };

  // Admin Manual Lot CRUD Handlers
  const handleToggleLotFlag = async (lotId, flagName, value) => {
    try {
      await apiFetch('/admin/lot', {
        method: 'POST',
        body: JSON.stringify({ lotId, [flagName]: value })
      });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error updating lot flag:', err);
    }
  };

  const handleSaveLot = async (lotPayload) => {
    try {
      const res = await apiFetch('/admin/lots', {
        method: 'POST',
        body: JSON.stringify(lotPayload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error || 'No s\'ha pogut desar el lot.');
        return false;
      }
      setLotDraft({ ...EMPTY_LOT_DRAFT });
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error saving lot:', err);
      return false;
    }
  };

  const handleDeleteLot = async (lotId) => {
    try {
      await apiFetch(`/admin/lots/${encodeURIComponent(lotId)}`, {
        method: 'DELETE'
      });
      if (lotDraft.isEditing && lotDraft.id === lotId) {
        setLotDraft({ ...EMPTY_LOT_DRAFT });
      }
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error deleting lot:', err);
    }
  };

  const handleClearAllLots = async () => {
    try {
      await apiFetch('/admin/lots', {
        method: 'DELETE'
      });
      setLotDraft({ ...EMPTY_LOT_DRAFT });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error clearing lots:', err);
    }
  };

  const handleEditLotOnMap = (lot) => {
    const codes = Array.isArray(lot.lampCodes) && lot.lampCodes.length > 0
      ? lot.lampCodes
      : (lot.lamps || []).map(l => l.codi);
    setLotDraft({
      id: lot.id,
      isEditing: true,
      name: lot.name || '',
      street: lot.street || '',
      lampCodes: codes,
      markLampsSuitable: true,
      reserved: Boolean(lot.reserved),
      reservedReason: lot.reservedReason || ''
    });
    setSelectedLotId(null);
    setShowAdmin(false);
    setAdminMapMode('MAP_EDITOR');
  };

  // Admin Fixed Locations (Emplaçaments) CRUD Handlers
  const handleSaveLocation = async (locPayload) => {
    try {
      const res = await apiFetch('/admin/locations', {
        method: 'POST',
        body: JSON.stringify(locPayload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error || 'No s\'ha pogut desar l\'emplaçament.');
        return false;
      }
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error saving location:', err);
      return false;
    }
  };

  const handleDeleteLocation = async (locId) => {
    try {
      await apiFetch(`/admin/locations/${encodeURIComponent(locId)}`, {
        method: 'DELETE'
      });
      if (locationDraft.isEditing && locationDraft.id === locId) {
        setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
      }
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error deleting location:', err);
    }
  };

  const handleClearAllLocations = async () => {
    try {
      await apiFetch('/admin/locations', {
        method: 'DELETE'
      });
      setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
      fetchDbData({ force: true });
    } catch (err) {
      console.error('Error clearing locations:', err);
    }
  };

  const handleMoveLocationOnMap = async (loc, nextLat, nextLng) => {
    await handleSaveLocation({
      ...loc,
      lat: nextLat,
      lng: nextLng
    });
  };

  const handleEditLocationFromMap = (loc) => {
    setLocationDraft({
      id: loc.id,
      isEditing: true,
      hasCoords: true,
      name: loc.name || '',
      type: loc.type || 'CARTELLERA',
      address: loc.address || '',
      description: loc.description || '',
      capacity: loc.capacity || 1,
      lat: loc.lat,
      lng: loc.lng,
      imageUrl: loc.imageUrl || ''
    });
    setSelectedLotId(null);
    setShowAdmin(false);
    setAdminMapMode('LOCATION_EDITOR');
  };

  // Admin Political Parties & Quotas CRUD Handlers
  const handleSaveParty = async (partyPayload) => {
    try {
      const res = await apiFetch('/admin/parties', {
        method: 'POST',
        body: JSON.stringify(partyPayload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || 'No s\'ha pogut desar la candidatura.' };
      }
      await fetchDbData({ force: true });
      return { ok: true, party: data.party };
    } catch (err) {
      console.error('Error saving party:', err);
      return { ok: false, error: 'Error de connexió desant la candidatura.' };
    }
  };

  const handleDeleteParty = async (partyId) => {
    try {
      const res = await apiFetch(`/admin/parties/${encodeURIComponent(partyId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'No s\'ha pogut eliminar la candidatura.');
        return false;
      }
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error deleting party:', err);
      return false;
    }
  };

  const handleRecalcPartyQuotas = async (payload) => {
    try {
      const res = await apiFetch('/admin/parties/recalc-quotas', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'No s\'han pogut recalcular les quotes.');
        return false;
      }
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error recalculating party quotas:', err);
      return false;
    }
  };

  const handleSaveElectionInfo = async (payload) => {
    try {
      const res = await apiFetch('/admin/election-info', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'No s\'ha pogut actualitzar la informació de la convocatòria.');
        return false;
      }
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error saving election info:', err);
      return false;
    }
  };

  // Admin Election History / Snapshots Handlers
  const handleArchiveHistory = async (payload) => {
    try {
      const res = await apiFetch('/admin/history/archive', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || 'No s\'ha pogut arxivar la convocatòria.' };
      }
      await fetchDbData({ force: true });
      return { ok: true, snapshotId: data.snapshotId };
    } catch (err) {
      console.error('Error archiving election history:', err);
      return { ok: false, error: 'Error de connexió arxivant la convocatòria.' };
    }
  };

  const handleRestoreHistory = async (snapshotId, options = {}) => {
    try {
      const res = await apiFetch(`/admin/history/${encodeURIComponent(snapshotId)}/restore`, {
        method: 'POST',
        body: JSON.stringify(options)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || 'No s\'ha pogut recuperar la convocatòria històrica.' };
      }
      setLotDraft({ ...EMPTY_LOT_DRAFT });
      setSelectedLotId(null);
      await fetchDbData({ force: true });
      return { ok: true };
    } catch (err) {
      console.error('Error restoring election history:', err);
      return { ok: false, error: 'Error de connexió recuperant la convocatòria.' };
    }
  };

  const handleDeleteHistory = async (snapshotId) => {
    try {
      const res = await apiFetch(`/admin/history/${encodeURIComponent(snapshotId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'No s\'ha pogut eliminar el registre històric.');
        return false;
      }
      await fetchDbData({ force: true });
      return true;
    } catch (err) {
      console.error('Error deleting election history:', err);
      return false;
    }
  };

  // Current Party details
  const partyObj = dbData?.parties?.find(p => p.id === user?.id);
  const userLotPrefs = user && role === 'PARTY' ? (dbData?.lotPreferences?.[user.id] || {}) : {};
  const userLotOrder = user && role === 'PARTY' ? (dbData?.lotOrderPreferences?.[user.id] || []) : [];
  const userLocPrefs = user && role === 'PARTY' ? (dbData?.locationPreferences?.[user.id] || []) : [];

  const partyLampsAssigned = dbData?.allocationResults?.partyAssignedLamps?.[user?.id] || 0;
  const partyLampsQuota = partyObj?.allocatedStreetlampsQuota || 0;
  const partyLocsAssigned = dbData?.allocationResults?.partyAssignedLocations?.[user?.id] || 0;
  const partyLocsQuota = partyObj?.allocatedLocationsQuota || 0;

  const selectedLot = selectedLotId ? dbData?.lots?.find(l => l.id === selectedLotId) : null;
  const electionStatus = dbData?.electionInfo?.status || 'OPEN';
  const isSelectionOpen = electionStatus === 'OPEN';

  return (
    <div className="app-shell">
      {/* Top Header */}
      <Header
        user={user}
        role={role}
        electionInfo={dbData?.electionInfo}
        onOpenInfo={() => setShowInfo(true)}
        onOpenAdmin={() => setShowAdmin(true)}
        onLogout={handleLogout}
        partyLampsAssigned={partyLampsAssigned}
        partyLampsQuota={partyLampsQuota}
        partyLocsAssigned={partyLocsAssigned}
        partyLocsQuota={partyLocsQuota}
      />

      {/* Main Interactive Map Layout */}
      <div className="map-layout">
        <MapViewer
          lamps={dbData?.lamps || []}
          lampStats={dbData?.lampStats}
          lots={dbData?.lots || []}
          locations={dbData?.locations || []}
          lotPreferences={userLotPrefs}
          lotOrder={userLotOrder}
          locationPreferences={userLocPrefs}
          allocationResults={dbData?.allocationResults}
          parties={dbData?.parties || []}
          onSelectLot={(lot) => {
            if (role === 'PARTY') {
              setPartyActiveTab('LOTS');
              setIsPartyPanelMinimized(false);
            }
            setSelectedLotId(lot.id);
          }}
          selectedLotId={selectedLotId}
          isPartyPanelOpen={role === 'PARTY' && !isPartyPanelMinimized}
          isPartySelectingLocations={role === 'PARTY' && partyActiveTab === 'LOCATIONS'}
          onOpenEmplacaments={() => {
            setSelectedLotId(null);
            setPartyActiveTab('LOCATIONS');
            setIsPartyPanelMinimized(false);
          }}
          onSaveLocationPreferences={handleSaveLocationPreferences}
          highlightedLotId={highlightedLotId}
          role={role}
          partyId={user?.id}
          partyColor={partyObj?.color || user?.color}
          electionStatus={electionStatus}
          onSaveLotLampOrder={handleSaveLotLampOrder}
          focusRequest={focusMapRequest}
          adminMapMode={adminMapMode}
          onChangeAdminMapMode={(nextMode) => {
            if (nextMode === 'MAP_EDITOR' && !lotDraft.isEditing && lotDraft.lampCodes.length === 0) {
              setLotDraft({ ...EMPTY_LOT_DRAFT });
            }
            if (nextMode === 'LOCATION_EDITOR' && !locationDraft.isEditing) {
              setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
            }
            if (nextMode === 'VIEW') {
              if (lotDraft.isEditing) setLotDraft({ ...EMPTY_LOT_DRAFT });
              if (locationDraft.isEditing) setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
            }
            setAdminMapMode(nextMode);
          }}
          onOpenAdminTab={(tabName) => {
            setAdminInitialTab(tabName);
            setShowAdmin(true);
          }}
          onBatchLampSuitability={handleBatchLampSuitability}
          lotDraft={lotDraft}
          onChangeLotDraft={setLotDraft}
          onSaveLotDraft={handleSaveLot}
          onEditLotOnMap={handleEditLotOnMap}
          onDeleteLot={handleDeleteLot}
          locationDraft={locationDraft}
          onChangeLocationDraft={setLocationDraft}
          onSaveLocation={handleSaveLocation}
          onDeleteLocation={handleDeleteLocation}
          onEditLocation={handleEditLocationFromMap}
          onMoveLocation={handleMoveLocationOnMap}
        />

        <Suspense fallback={null}>
          {/* Guided Unified Selection Workspace for Political Parties */}
          {role === 'PARTY' && user && (
            <PartySelectionPanel
              lots={dbData?.lots || []}
              locations={dbData?.locations || []}
              parties={dbData?.parties || []}
              partyId={user.id}
              partyAcronym={partyObj?.acronym || user.acronym || user.id}
              partyColor={partyObj?.color || user.color}
              partyQuota={partyLampsQuota}
              partyLocsQuota={partyLocsQuota}
              electionStatus={electionStatus}
              isSelectionOpen={isSelectionOpen}
              activeTab={partyActiveTab}
              onChangeTab={setPartyActiveTab}
              selectedLotId={selectedLotId}
              onSelectLotId={setSelectedLotId}
              isMinimized={isPartyPanelMinimized}
              onChangeMinimized={setIsPartyPanelMinimized}
              lotPreferences={userLotPrefs}
              lotOrder={userLotOrder}
              locationPreferences={userLocPrefs}
              allocationResults={dbData?.allocationResults}
              onSaveLotOrder={handleSaveLotOrder}
              onSaveLotLampOrder={handleSaveLotLampOrder}
              onSaveLocationPreferences={handleSaveLocationPreferences}
              onFocusLot={(lot) => {
                if (lot.coords && lot.coords.length > 0) {
                  requestMapFocus(lot.coords[0][0], lot.coords[0][1]);
                }
              }}
              onFocusLamp={(lamp) => requestMapFocus(lamp.lat, lamp.lng)}
              onFocusLocation={(loc) => requestMapFocus(loc.lat, loc.lng)}
              onHighlightLot={setHighlightedLotId}
              onOpenRestorePast={() => setShowRestorePast(true)}
              onResetOwnPreferences={handleResetOwnPreferences}
            />
          )}

          {/* Lot Inspection Modal for ADMIN / ANON */}
          {role !== 'PARTY' && selectedLot && (
            <LotSelectionModal
              lot={selectedLot}
              role={role}
              electionStatus={electionStatus}
              allocationResults={dbData?.allocationResults}
              parties={dbData?.parties || []}
              onToggleLampSuitability={handleToggleLampSuitability}
              onEditLotOnMap={handleEditLotOnMap}
              onDeleteLot={handleDeleteLot}
              onClose={() => setSelectedLotId(null)}
            />
          )}
        </Suspense>
      </div>

      {/* Modals */}
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onDemoLogin={handleDemoLogin}
          demoLoginEnabled={Boolean(dbData?.demoLoginEnabled)}
          parties={dbData?.parties || []}
        />
      )}

      <Suspense fallback={null}>
        {showInfo && (
          <InfoModal
            parties={dbData?.parties || []}
            allocationResults={dbData?.allocationResults}
            electionInfo={dbData?.electionInfo}
            onClose={() => setShowInfo(false)}
          />
        )}

        {showRestorePast && (
          <RestorePastModal
            historicalElections={dbData?.historicalPreferences}
            isSelectionOpen={isSelectionOpen}
            onRestore={handleRestorePastPreferences}
            onClose={() => setShowRestorePast(false)}
          />
        )}

        {showAllocationAnim && (
          <AllocationAnimationModal
            allocationResults={dbData?.allocationResults}
            onClose={() => {
              setShowAllocationAnim(false);
              setHighlightedLotId(null);
            }}
            onHighlightLot={(lotId) => setHighlightedLotId(lotId)}
          />
        )}

        {showAdmin && (
          <AdminPanel
            electionInfo={dbData?.electionInfo}
            parties={dbData?.parties || []}
            lamps={dbData?.lamps || []}
            lots={dbData?.lots || []}
            locations={dbData?.locations || []}
            lotPreferences={dbData?.lotPreferences || {}}
            lotOrderPreferences={dbData?.lotOrderPreferences || {}}
            locationPreferences={dbData?.locationPreferences || {}}
            allocationResults={dbData?.allocationResults}
            initialTab={adminInitialTab}
            lotDraft={lotDraft}
            onChangeLotDraft={setLotDraft}
            onSaveLot={handleSaveLot}
            onDeleteLot={handleDeleteLot}
            onClearAllLots={handleClearAllLots}
            onStartMapSuitabilityMode={() => {
              setShowAdmin(false);
              setAdminMapMode('MAP_EDITOR');
            }}
            onStartMapLotBuilder={(existingDraft) => {
              if (!existingDraft) {
                setLotDraft({ ...EMPTY_LOT_DRAFT });
              }
              setShowAdmin(false);
              setAdminMapMode('MAP_EDITOR');
            }}
            onFocusLampOnMap={(lamp) => {
              requestMapFocus(lamp.lat, lamp.lng);
              setShowAdmin(false);
              setAdminMapMode('MAP_EDITOR');
            }}
            onFocusLotOnMap={(lot) => {
              if (lot.coords && lot.coords.length > 0) {
                requestMapFocus(lot.coords[0][0], lot.coords[0][1]);
              }
              setShowAdmin(false);
              setAdminMapMode('VIEW');
            }}
            locationDraft={locationDraft}
            onChangeLocationDraft={setLocationDraft}
            onStartMapLocationEditor={(existingLocDraft) => {
              if (!existingLocDraft) {
                setLocationDraft({ ...EMPTY_LOCATION_DRAFT });
              }
              setShowAdmin(false);
              setAdminMapMode('LOCATION_EDITOR');
            }}
            onFocusLocationOnMap={(loc) => {
              requestMapFocus(loc.lat, loc.lng);
              setShowAdmin(false);
            }}
            onSaveLocation={handleSaveLocation}
            onDeleteLocation={handleDeleteLocation}
            onClearAllLocations={handleClearAllLocations}
            onSaveParty={handleSaveParty}
            onDeleteParty={handleDeleteParty}
            onRecalcPartyQuotas={handleRecalcPartyQuotas}
            onSaveElectionInfo={handleSaveElectionInfo}
            historicalElections={dbData?.historicalPreferences || {}}
            onArchiveHistory={handleArchiveHistory}
            onRestoreHistory={handleRestoreHistory}
            onDeleteHistory={handleDeleteHistory}
            onChangeElectionStatus={handleChangeElectionStatus}
            onRunAllocation={handleRunAllocation}
            onResetAllocation={handleResetAllocation}
            onResetPartyPreferences={handleResetPartyPreferences}
            onToggleLotFlag={handleToggleLotFlag}
            onToggleLampSuitability={handleToggleLampSuitability}
            onBatchLampSuitability={handleBatchLampSuitability}
            onBulkSuitability={handleBulkSuitability}
            onChangeLampAptitude={handleChangeLampAptitude}
            onResetDefaultAptitude={handleResetDefaultAptitude}
            onClose={() => setShowAdmin(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
