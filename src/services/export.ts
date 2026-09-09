import { toPng } from 'html-to-image';
import type maplibregl from 'maplibre-gl';
import type { Itinerary, ResolvedLeg } from '@/types/itinerary';
import { groupByDay, stopSchedule } from '@/lib/itinerary';
import {
  formatDateLong,
  formatDuration,
  formatMiles,
  formatMinutesAsTime,
} from '@/lib/time';

/**
 * Export strategy
 * ---------------
 * The map is a WebGL canvas (created with preserveDrawingBuffer so its pixels can
 * be read back) and the markers/labels/leg labels are DOM elements layered on top
 * of it inside the same container. html-to-image serializes that container —
 * canvas pixels included — into a single PNG, so the export contains exactly what
 * the user sees: basemap, routes, flight arcs, numbered markers, labels and
 * attribution. PDF export wraps the same PNG with jsPDF and appends a text
 * itinerary page.
 */

export interface ExportOptions {
  /** Device pixel ratio for the raster. 2 gives crisp print-quality output. */
  pixelRatio?: number;
}

/** Wait for the map to finish loading tiles and rendering. */
export function waitForMapIdle(map: maplibregl.Map, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (map.loaded() && map.areTilesLoaded() && !map.isMoving()) {
      map.triggerRepaint();
    }
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      map.off('idle', done);
      resolve();
    }
    map.once('idle', done);
    map.triggerRepaint();
  });
}

function shouldInclude(node: HTMLElement): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.dataset?.exportExclude !== undefined) return false;
  if (node.classList?.contains('maplibregl-ctrl-top-right')) return false;
  return true;
}

export async function renderMapToPng(
  container: HTMLElement,
  map: maplibregl.Map,
  options: ExportOptions = {},
): Promise<string> {
  await waitForMapIdle(map);
  container.dataset.exporting = 'true';
  const pixelRatio = options.pixelRatio ?? 2;
  try {
    const opts = {
      pixelRatio,
      cacheBust: true,
      filter: shouldInclude,
      backgroundColor: '#e9eef3',
      style: { transform: 'none' },
    };
    try {
      return await toPng(container, opts);
    } catch {
      // Cross-origin font inlining can fail; fall back to system fonts.
      return await toPng(container, { ...opts, skipFonts: true });
    }
  } finally {
    delete container.dataset.exporting;
  }
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'itinerary';
}

export async function exportPng(container: HTMLElement, map: maplibregl.Map, itinerary: Itinerary) {
  const png = await renderMapToPng(container, map);
  downloadDataUrl(png, `${safeFilename(itinerary.title)}-map.png`);
}

export async function exportPdf(
  container: HTMLElement,
  map: maplibregl.Map,
  itinerary: Itinerary,
  legs: ResolvedLeg[],
) {
  const { jsPDF } = await import('jspdf');
  const png = await renderMapToPng(container, map);

  const img = new Image();
  img.src = png;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not decode exported map image'));
  });

  const landscape = img.width >= img.height;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;

  // Page 1: title + map
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(itinerary.title, margin, margin + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (itinerary.subtitle) doc.text(itinerary.subtitle, margin, margin + 22);
  doc.setTextColor(0);

  const top = margin + 34;
  const availW = pageW - margin * 2;
  const availH = pageH - top - margin;
  const scale = Math.min(availW / img.width, availH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  doc.addImage(png, 'PNG', margin + (availW - drawW) / 2, top, drawW, drawH, undefined, 'FAST');

  // Page 2+: itinerary
  doc.addPage();
  let y = margin + 6;
  const lineH = 13;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin + 6;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Itinerary', margin, y);
  y += lineH * 1.8;

  const legByFrom = new Map(legs.map((l) => [l.from.id, l]));
  for (const day of groupByDay(itinerary)) {
    ensureSpace(lineH * 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 64, 175);
    doc.text(`DAY ${day.dayIndex + 1} · ${formatDateLong(day.date).toUpperCase()}`, margin, y);
    doc.setTextColor(0);
    y += lineH * 1.4;

    for (const stop of day.stops) {
      ensureSpace(lineH * 4);
      const s = stopSchedule(stop);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(`${stop.order}. ${stop.name}`, margin, y);
      y += lineH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(90);
      const times = [
        s.arrivalMinutes !== undefined ? `Arrive ${formatMinutesAsTime(s.arrivalMinutes)}` : '',
        s.departureMinutes !== undefined ? `Depart ${formatMinutesAsTime(s.departureMinutes)}` : '',
        s.durationMinutes !== undefined ? `On site ${formatDuration(s.durationMinutes)}` : '',
      ]
        .filter(Boolean)
        .join('   ·   ');
      if (times) {
        doc.text(times, margin + 14, y);
        y += lineH;
      }
      if (stop.address) {
        doc.text(stop.address, margin + 14, y);
        y += lineH;
      }
      doc.setTextColor(0);

      const leg = legByFrom.get(stop.id);
      if (leg) {
        ensureSpace(lineH * 2);
        doc.setFontSize(9);
        doc.setTextColor(120);
        const parts =
          leg.mode === 'flight'
            ? [
                `Flight${leg.leg.flightNumber ? ` ${leg.leg.flightNumber}` : ''}`,
                leg.leg.departureAirport && leg.leg.arrivalAirport
                  ? `${leg.leg.departureAirport} → ${leg.leg.arrivalAirport}`
                  : '',
                formatDuration(leg.durationMinutes),
              ]
            : [
                leg.source === 'fallback' ? 'Drive (route unavailable, straight-line)' : 'Drive',
                formatMiles(leg.distanceMiles),
                formatDuration(leg.durationMinutes),
              ];
        doc.text(`↓  ${parts.filter(Boolean).join(' · ')}`, margin + 14, y + 2);
        doc.setTextColor(0);
        y += lineH * 1.5;
      } else {
        y += lineH * 0.5;
      }
    }
    y += lineH * 0.6;
  }

  doc.save(`${safeFilename(itinerary.title)}-itinerary.pdf`);
}
