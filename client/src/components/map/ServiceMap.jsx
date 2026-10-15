import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Info,
  Loader2,
  AlertCircle,
  Compass,
  Calendar,
  Clock,
  User,
  Wrench,
  Check
} from 'lucide-react';
import { getCityDisplayName } from '../../data/cities';

// Canonical City Center Coordinates in Maharashtra
export const CITY_COORDINATES = {
  'sangli': [16.8524, 74.5815],
  'chhatrapati-sambhajinagar': [19.8762, 75.3433],
  'mumbai': [19.0760, 72.8777],
  'pune': [18.5204, 73.8567],
  'nagpur': [21.1458, 79.0882]
};

/**
 * ServiceMap Component — Leaflet & OpenStreetMap Integration
 * 
 * Supports:
 * 1. Provider discovery markers with verified coordinates
 * 2. Authorized customer/provider booking service location markers
 * 3. Interactive location picker (click to place/drag marker) for providers
 * 4. Geolocation "Find Near Me" button
 * 5. Direct Google Maps navigation directions links
 * 6. Responsive container with automatic size invalidation
 */
export default function ServiceMap({
  providers = [],
  bookings = [],
  selectedCity = 'sangli',
  category = 'all',
  height = '480px',
  interactive = true,
  editable = false,
  currentLocation = null,
  onLocationChange = null,
  focusLocation = null,
  emptyTitle = null,
  emptyMessage = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const editableMarkerRef = useRef(null);

  const [userCoords, setUserCoords] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const cityName = getCityDisplayName(selectedCity);
  const defaultCenter = CITY_COORDINATES[selectedCity] || [16.8524, 74.5815];

  // Strictly filter providers that have real, valid coordinates
  const validProviders = providers.filter((p) => {
    const loc = p.location || p.providerDetails?.location;
    if (!loc) return false;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  });

  // Strictly filter bookings that have real, valid coordinates
  const validBookings = bookings.filter((b) => {
    const loc = b.location;
    if (!loc) return false;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const initialCenter = focusLocation || (
        currentLocation?.latitude && currentLocation?.longitude
          ? [Number(currentLocation.latitude), Number(currentLocation.longitude)]
          : defaultCenter
      );

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        scrollWheelZoom: interactive,
        attributionControl: false
      });

      // Free OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      L.control.attribution({ position: 'bottomright' }).addTo(map);

      const markersLayer = L.featureGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
      setMapReady(true);

      // Force tile refresh
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } catch (err) {
      console.warn('Leaflet initialization warning:', err.message);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [selectedCity]);

  // Click-to-place pin handler for Editable mode (e.g. Provider setting their shop/base)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      if (!editable) return;
      const { lat, lng } = e.latlng;
      if (onLocationChange) {
        onLocationChange({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6))
        });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapReady, editable, onLocationChange]);

  // Render Markers (Providers, Bookings, Editable Pin)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !mapReady) return;

    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers();
    let boundsCount = 0;

    // 1. Render Editable Marker if in editable mode or currentLocation is present
    if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
      const cLat = Number(currentLocation.latitude);
      const cLng = Number(currentLocation.longitude);

      if (!isNaN(cLat) && !isNaN(cLng) && cLat >= -90 && cLat <= 90 && cLng >= -180 && cLng <= 180) {
        const pinIcon = L.divIcon({
          className: 'custom-leaflet-marker-editable',
          html: `
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background-color: #ea580c;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(234, 88, 12, 0.4);
              border: 3px solid #ffffff;
              cursor: ${editable ? 'grab' : 'pointer'};
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20]
        });

        const pinMarker = L.marker([cLat, cLng], {
          icon: pinIcon,
          draggable: Boolean(editable)
        });

        if (editable) {
          pinMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            if (onLocationChange) {
              onLocationChange({
                latitude: Number(pos.lat.toFixed(6)),
                longitude: Number(pos.lng.toFixed(6))
              });
            }
          });
        }

        const pinPopup = `
          <div style="font-family: inherit; min-width: 180px; padding: 4px;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #ea580c; margin-bottom: 2px;">
              📍 Your Business Location
            </div>
            <div style="font-size: 0.8rem; color: #334155; margin-bottom: 4px;">
              ${currentLocation.address || 'Coordinates set'}
            </div>
            <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">
              ${cLat.toFixed(4)}, ${cLng.toFixed(4)}
            </div>
            ${editable ? '<div style="font-size: 0.72rem; color: #16a34a; margin-top: 4px; font-weight: 600;">✓ Drag pin or click map to reposition</div>' : ''}
          </div>
        `;

        pinMarker.bindPopup(pinPopup);
        markersLayer.addLayer(pinMarker);
        editableMarkerRef.current = pinMarker;
        boundsCount++;
      }
    }

    // 2. Render Provider Markers (Emerald / Green for Available, Slate / Gray for Offline)
    validProviders.forEach((p) => {
      const loc = p.location || p.providerDetails?.location;
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      const isAvail = p.isAvailable !== false && p.providerDetails?.isAvailable !== false;
      const markerColor = isAvail ? '#16a34a' : '#64748b';

      const providerIcon = L.divIcon({
        className: 'custom-leaflet-marker-provider',
        html: `
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: ${markerColor};
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: providerIcon });

      const popupContent = `
        <div style="font-family: inherit; min-width: 200px; padding: 4px;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 2px;">
            ${p.name}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
            <span style="font-size: 0.82rem; color: #166534; font-weight: 600;">
              ${p.title || p.category || 'Service Specialist'}
            </span>
            <span style="
              font-size: 0.72rem; 
              font-weight: 600; 
              padding: 2px 6px; 
              border-radius: 4px; 
              background-color: ${isAvail ? '#dcfce7' : '#f1f5f9'}; 
              color: ${isAvail ? '#166534' : '#64748b'};
            ">
              ${isAvail ? '● Available' : '● Offline'}
            </span>
          </div>
          ${loc.address ? `<div style="font-size: 0.78rem; color: #475569; margin-bottom: 6px;">📍 ${loc.address}</div>` : ''}
          ${
            p.startingPrice
              ? `<div style="font-size: 0.8rem; color: #334155; margin-bottom: 8px;">
                  Starting visit: <strong>₹${p.startingPrice}</strong>
                </div>`
              : ''
          }
          <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
            <a 
              href="/provider/${p.id || p._id}" 
              style="
                display: inline-block;
                background-color: #16a34a;
                color: #ffffff;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 0.78rem;
                font-weight: 600;
                text-decoration: none;
              "
            >
              View Profile
            </a>
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
              target="_blank" 
              rel="noopener noreferrer"
              style="
                display: inline-block;
                background-color: #f1f5f9;
                color: #334155;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.78rem;
                font-weight: 600;
                text-decoration: none;
              "
            >
              Directions ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersLayer.addLayer(marker);
      boundsCount++;
    });

    // 3. Render Booking Markers (Indigo / Blue)
    validBookings.forEach((b) => {
      const lat = Number(b.location.latitude);
      const lng = Number(b.location.longitude);

      const bookingIcon = L.divIcon({
        className: 'custom-leaflet-marker-booking',
        html: `
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: #4f46e5;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(79, 70, 229, 0.4);
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: bookingIcon });

      const statusBadgeColor = b.status === 'accepted' ? '#15803d' : b.status === 'completed' ? '#0284c7' : '#d97706';
      const statusBg = b.status === 'accepted' ? '#f0fdf4' : b.status === 'completed' ? '#f0f9ff' : '#fefce8';

      const popupContent = `
        <div style="font-family: inherit; min-width: 220px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a;">
              ${b.serviceName || 'Service Appointment'}
            </span>
            <span style="font-size: 0.72rem; font-weight: 700; color: ${statusBadgeColor}; background-color: ${statusBg}; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${b.status}
            </span>
          </div>
          <div style="font-size: 0.8rem; color: #475569; margin-bottom: 4px;">
            📅 ${b.bookingDate} at ${b.bookingTime}
          </div>
          <div style="font-size: 0.8rem; color: #334155; margin-bottom: 6px;">
            📍 ${b.serviceAddress || ''}
          </div>
          ${b.customer?.name ? `<div style="font-size: 0.78rem; color: #64748b; margin-bottom: 4px;">👤 Customer: <strong>${b.customer.name}</strong></div>` : ''}
          ${b.provider?.name ? `<div style="font-size: 0.78rem; color: #64748b; margin-bottom: 6px;">🔧 Provider: <strong>${b.provider.name}</strong></div>` : ''}
          <div style="margin-top: 8px;">
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
              target="_blank" 
              rel="noopener noreferrer"
              style="
                display: inline-block;
                background-color: #4f46e5;
                color: #ffffff;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 0.78rem;
                font-weight: 600;
                text-decoration: none;
              "
            >
              Get Directions ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersLayer.addLayer(marker);
      boundsCount++;
    });

    // Auto fit bounds or set view
    if (focusLocation && focusLocation.length === 2) {
      mapInstanceRef.current.setView(focusLocation, 14);
    } else if (boundsCount > 0) {
      try {
        const bounds = markersLayer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      } catch {
        mapInstanceRef.current.setView(defaultCenter, 12);
      }
    } else {
      mapInstanceRef.current.setView(defaultCenter, 12);
    }
  }, [
    validProviders,
    validBookings,
    mapReady,
    currentLocation?.latitude,
    currentLocation?.longitude,
    editable,
    focusLocation
  ]);

  // User Geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setUserCoords([userLat, userLng]);
        setGeoLoading(false);

        if (mapInstanceRef.current) {
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }

          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div style="
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background-color: #2563eb;
                border: 3px solid #ffffff;
                box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.3);
              "></div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          const uMarker = L.marker([userLat, userLng], { icon: userIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup('<strong>Your Current Position</strong>')
            .openPopup();

          userMarkerRef.current = uMarker;
          mapInstanceRef.current.setView([userLat, userLng], 14);

          // If editable mode is active, trigger callback to place base pin
          if (editable && onLocationChange) {
            onLocationChange({
              latitude: Number(userLat.toFixed(6)),
              longitude: Number(userLng.toFixed(6))
            });
          }
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission was denied. You can select your city or click on the map.');
        } else {
          setGeoError('Unable to retrieve location. Please use city selection.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const hasAnyMarkers = validProviders.length > 0 || validBookings.length > 0 || (currentLocation?.latitude && currentLocation?.longitude);

  return (
    <div
      className="service-map-wrapper card"
      style={{
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      {/* Top Map Action Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}
      >
        {/* City Info Badge */}
        <div
          style={{
            pointerEvents: 'auto',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--color-text-title)'
          }}
        >
          <Compass size={15} style={{ color: 'var(--primary-600)' }} />
          <span>{cityName} Territory</span>
          {editable ? (
            <span style={{
              fontSize: '0.72rem',
              backgroundColor: '#ffedd5',
              color: '#c2410c',
              padding: '0.1rem 0.45rem',
              borderRadius: '9999px',
              marginLeft: '4px'
            }}>
              Click Map to Place Pin
            </span>
          ) : (
            <span style={{
              fontSize: '0.72rem',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              padding: '0.1rem 0.45rem',
              borderRadius: '9999px',
              marginLeft: '4px'
            }}>
              {validProviders.length + validBookings.length} on Map
            </span>
          )}
        </div>

        {/* User Geolocation Button */}
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={geoLoading}
          style={{
            pointerEvents: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 'var(--radius-full)',
            padding: '0.45rem 0.85rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#1e293b',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={editable ? 'Set business location to my current GPS coordinates' : 'Center map on your current GPS location'}
        >
          {geoLoading ? (
            <Loader2 size={14} className="animate-spin" style={{ color: '#2563eb' }} />
          ) : (
            <Navigation size={14} style={{ color: '#2563eb' }} />
          )}
          <span>{geoLoading ? 'Detecting...' : editable ? 'Use GPS Location' : 'Find Near Me'}</span>
        </button>
      </div>

      {/* Geolocation Notice / Error */}
      {geoError && (
        <div
          style={{
            position: 'absolute',
            top: '55px',
            right: '12px',
            zIndex: 1000,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}
        >
          <AlertCircle size={14} />
          <span>{geoError}</span>
        </div>
      )}

      {/* Map DOM Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height,
          backgroundColor: '#e2e8f0'
        }}
      />

      {/* Informative Fallback Banner when NO markers exist */}
      {!hasAnyMarkers && !editable && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '50%',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <MapPin size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
              {emptyTitle || `Area-Based Service Coverage in ${cityName}`}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              {emptyMessage || `Service technicians in ${cityName} operate across municipal localities and doorstep service zones rather than fixed public store coordinates.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
