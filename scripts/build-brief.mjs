// Builds a self-contained, shareable HTML "trip brief": the exported map image
// plus the itinerary. Usage:
//   OUT=dir node scripts/build-brief.mjs   (expects dir/map-export.png and dir/legs.json from render-map.mjs)
import fs from 'node:fs';
import { build } from 'esbuild';

const out = process.env.OUT || '.';
const bundled = await build({ entryPoints: ['src/data/sampleItineraries.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64');
const { kpmgRollout: it } = await import(dataUrl);
const legs = JSON.parse(fs.readFileSync(`${out}/legs.json`, 'utf8'));
const png = fs.readFileSync(`${out}/map-export.png`).toString('base64');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fmtDate = (iso) => { const [y,m,d] = iso.split('-').map(Number); const dt = new Date(y, m-1, d); return `${DAYS[dt.getDay()]} · ${MONTHS[m-1]} ${d}`; };
const t12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`; };
const dur = (mins) => mins >= 60 ? `${Math.floor(mins/60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} min`;
const schedule = (s) => {
  const a = s.arrivalTime, d = s.departureTime;
  const mins = a && d ? ((h) => h)((() => { const [ah, am] = a.split(':').map(Number); const [dh, dm] = d.split(':').map(Number); return (dh*60+dm) - (ah*60+am); })()) : undefined;
  return { a: t12(a), d: t12(d), onSite: mins ? dur(mins) : '' };
};
const TYPE = { job: 'Site', office: 'Office', airport: 'Airport', hotel: 'Hotel', warehouse: 'Warehouse', restaurant: 'Restaurant', personal: 'Personal', other: 'Stop' };

const stops = [...it.stops].sort((a, b) => a.order - b.order);
const days = [...new Set(stops.map((s) => s.date))].sort().map((date, i) => ({ date, i, stops: stops.filter((s) => s.date === date) }));
const legByFrom = new Map(stops.slice(0, -1).map((s, i) => [s.id, legs[i]]));
const driveMin = legs.filter((l) => l.mode === 'drive').reduce((a, l) => a + (Number((l.text.match(/(\d+) min/) || [])[1]) || 0) + (Number((l.text.match(/(\d+)h/) || [])[1]) || 0) * 60, 0);
const flightMin = (it.legs || []).reduce((a, l) => a + (l.durationMinutes || 0), 0);
const miles = legs.filter((l) => l.mode === 'drive').reduce((a, l) => a + (Number((l.text.match(/([\d.]+) mi/) || [])[1]) || 0), 0);

const legRow = (leg) => {
  if (!leg) return '';
  const flight = leg.mode === 'flight';
  const text = flight ? leg.text.replace(/^Flight\s*/, '') : leg.text.replace(/^Drive · /, '');
  return `<div class="leg ${flight ? 'leg--flight' : ''}"><span class="leg__rail" aria-hidden="true"></span><span class="leg__body"><span class="leg__mode">${flight ? 'Flight' : 'Drive'}</span><span class="leg__text">${esc(text)}</span></span></div>`;
};

const dayBlocks = days.map((day) => `
  <section class="day">
    <header class="day__head"><span class="day__n">Day ${day.i + 1}</span><h3>${esc(fmtDate(day.date))}</h3><span class="day__range">Stops ${day.stops[0].order}${day.stops.length > 1 ? `–${day.stops.at(-1).order}` : ''}</span></header>
    <ol class="stops">
      ${day.stops.map((s) => { const sc = schedule(s); return `
      <li class="stop">
        <span class="stop__num">${s.order}</span>
        <div class="stop__body">
          <div class="stop__name">${esc(s.name)}<span class="stop__type stop__type--${s.type || 'other'}">${TYPE[s.type || 'other']}</span></div>
          ${(sc.a || sc.d) ? `<div class="stop__time">${sc.a && sc.d ? `${sc.a} – ${sc.d}` : sc.a ? `Arrive ${sc.a}` : `Depart ${sc.d}`}${sc.onSite ? ` <span class="stop__onsite">· on site ${sc.onSite}</span>` : ''}</div>` : ''}
          ${s.notes ? `<div class="stop__note">${esc(s.notes)}</div>` : ''}
          ${s.address ? `<div class="stop__addr">${esc(s.address)}</div>` : ''}
        </div>
      </li>${legRow(legByFrom.get(s.id))}`; }).join('')}
    </ol>
  </section>`).join('');

const html = `<title>KPMG West Rollout</title>
<meta name="description" content="Site rollout itinerary map: Seattle, San Francisco, Tempe, Los Angeles, Denver.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --ground:#f2f4f1;--surface:#ffffff;--ink:#14213a;--ink-2:#3b4a66;--muted:#66728a;--hair:#d8dde5;--hair-2:#e9edf2;
  --drive:#2457d6;--drive-soft:#e4ebfb;--flight:#cf2a55;--flight-soft:#fbe4ea;--badge:#14213a;--badge-ink:#ffffff;
  --site:#0f766e;--site-soft:#d7f3ee;--office:#2457d6;--office-soft:#e4ebfb;--airport:#cf2a55;--airport-soft:#fbe4ea;
  --shadow:0 1px 2px rgba(20,33,58,.06),0 8px 24px rgba(20,33,58,.08);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --ground:#0f141c;--surface:#171e29;--ink:#e8ecf2;--ink-2:#c3cbd8;--muted:#8f9bb0;--hair:#2a3441;--hair-2:#222b37;
  --drive:#6d93ff;--drive-soft:#1b2a4d;--flight:#ff6b8a;--flight-soft:#4a1b2a;--badge:#e8ecf2;--badge-ink:#0f141c;
  --site:#4fd1c0;--site-soft:#123a36;--office:#6d93ff;--office-soft:#1b2a4d;--airport:#ff6b8a;--airport-soft:#4a1b2a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}}
:root[data-theme="dark"]{
  --ground:#0f141c;--surface:#171e29;--ink:#e8ecf2;--ink-2:#c3cbd8;--muted:#8f9bb0;--hair:#2a3441;--hair-2:#222b37;
  --drive:#6d93ff;--drive-soft:#1b2a4d;--flight:#ff6b8a;--flight-soft:#4a1b2a;--badge:#e8ecf2;--badge-ink:#0f141c;
  --site:#4fd1c0;--site-soft:#123a36;--office:#6d93ff;--office-soft:#1b2a4d;--airport:#ff6b8a;--airport-soft:#4a1b2a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1240px;margin:0 auto;padding:28px 24px 64px}
.brief{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px 32px;padding-bottom:20px;border-bottom:1px solid var(--hair)}
.brief h1{margin:0;font-size:clamp(24px,3.2vw,34px);font-weight:700;letter-spacing:-.02em;line-height:1.1;text-wrap:balance}
.brief__eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.brief__route{margin-top:6px;color:var(--ink-2);font-size:15px}
.stats{display:flex;flex-wrap:wrap;margin-left:auto;border:1px solid var(--hair);border-radius:10px;background:var(--surface);overflow:hidden}
.stat{padding:10px 16px;border-left:1px solid var(--hair);min-width:110px;flex:1 0 auto}
.stat:first-child{border-left:0}
.stat__v{font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1}
.stat__k{font-size:11.5px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:3px}
.map{margin-top:24px}
.map__frame{position:relative;background:var(--surface);border:1px solid var(--hair);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}
.map__frame img{display:block;width:100%;height:auto}
.map__bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding:10px 14px;border-top:1px solid var(--hair);font-size:12.5px;color:var(--muted)}
.key{display:inline-flex;align-items:center;gap:7px}
.key__sw{width:22px;border-top:3px solid var(--drive);border-radius:2px}
.key__sw--flight{border-top-style:dashed;border-color:var(--flight)}
.key__badge{width:16px;height:16px;border-radius:50%;background:var(--badge);color:var(--badge-ink);font-size:9px;font-weight:700;display:inline-grid;place-items:center}
.map__bar button{margin-left:auto;font:inherit;font-weight:600;font-size:12.5px;color:var(--ink);background:var(--surface);border:1px solid var(--hair);border-radius:8px;padding:6px 12px;cursor:pointer}
.map__bar button:hover{border-color:var(--muted)}
.map__bar button:focus-visible,.viewer__close:focus-visible{outline:2px solid var(--drive);outline-offset:2px}
.viewer{position:fixed;inset:0;background:rgba(10,14,22,.92);z-index:50;overflow:auto;padding:56px 24px 24px}
.viewer img{display:block;margin:0 auto;max-width:none;width:min(2840px,180vw);height:auto;border-radius:6px}
.viewer__close{position:fixed;top:14px;right:16px;font:inherit;font-weight:600;background:#fff;color:#14213a;border:0;border-radius:8px;padding:8px 14px;cursor:pointer}
.viewer__hint{position:fixed;top:22px;left:24px;color:#cbd3e1;font-size:13px}
.sched{margin-top:36px}
.sched__head{display:flex;align-items:baseline;gap:14px;margin-bottom:14px}
.sched__head h2{margin:0;font-size:20px;letter-spacing:-.01em}
.sched__head span{color:var(--muted);font-size:13px}
.days{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;align-items:start}
.day{background:var(--surface);border:1px solid var(--hair);border-radius:12px;overflow:hidden}
.day__head{display:flex;align-items:baseline;gap:10px;padding:12px 16px;border-bottom:1px solid var(--hair-2);background:var(--surface)}
.day__n{font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--drive);font-weight:600}
.day__head h3{margin:0;font-size:14.5px;font-weight:600;color:var(--ink)}
.day__range{margin-left:auto;font-size:12px;color:var(--muted);white-space:nowrap}
.stops{list-style:none;margin:0;padding:6px 0 10px}
.stop{display:grid;grid-template-columns:32px 1fr;gap:0 12px;padding:10px 16px}
.stop__num{width:28px;height:28px;border-radius:50%;background:var(--badge);color:var(--badge-ink);font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:13px;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.stop__name{font-weight:600;font-size:14.5px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;line-height:1.3}
.stop__type{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:1px 7px;border-radius:999px;background:var(--hair-2);color:var(--ink-2)}
.stop__type--job{background:var(--site-soft);color:var(--site)}
.stop__type--office{background:var(--office-soft);color:var(--office)}
.stop__type--airport{background:var(--airport-soft);color:var(--airport)}
.stop__time{font-family:'IBM Plex Mono',monospace;font-size:13px;margin-top:3px;font-variant-numeric:tabular-nums;color:var(--ink)}
.stop__onsite{color:var(--muted)}
.stop__note{font-size:13px;color:var(--ink-2);margin-top:2px}
.stop__addr{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--muted);margin-top:3px}
.leg{display:grid;grid-template-columns:32px 1fr;gap:0 12px;padding:0 16px}
.leg__rail{justify-self:center;width:0;height:100%;min-height:30px;border-left:2px solid var(--drive);position:relative}
.leg__rail::after{content:"";position:absolute;bottom:0;left:-5px;border:4px solid transparent;border-top:6px solid var(--drive)}
.leg--flight .leg__rail{border-left-style:dashed;border-color:var(--flight)}
.leg--flight .leg__rail::after{border-top-color:var(--flight)}
.leg__body{align-self:center;display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;padding:4px 10px;margin:2px 0;border-radius:8px;background:var(--drive-soft);color:var(--drive);font-size:12.5px;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.leg--flight .leg__body{background:var(--flight-soft);color:var(--flight)}
.leg__mode{font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.foot{margin-top:36px;padding-top:16px;border-top:1px solid var(--hair);font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 24px}
@media (max-width:720px){.wrap{padding:18px 14px 48px}.stats{margin-left:0;width:100%}.viewer{padding:56px 10px 10px}}
@media (prefers-reduced-motion: no-preference){.map__bar button,.stop,.leg{transition:background .15s}}
</style>
<div class="wrap">
  <header class="brief">
    <div>
      <div class="brief__eyebrow">Field itinerary · Sep 21 – Oct 6, 2026</div>
      <h1>KPMG West Rollout</h1>
      <div class="brief__route">Seattle → San Francisco → Tempe → Los Angeles → Denver</div>
    </div>
    <div class="stats" aria-label="Trip totals">
      <div class="stat"><div class="stat__v">${stops.length}</div><div class="stat__k">Stops</div></div>
      <div class="stat"><div class="stat__v">${days.length}</div><div class="stat__k">Days</div></div>
      <div class="stat"><div class="stat__v">${dur(driveMin)}</div><div class="stat__k">Driving · ${Math.round(miles)} mi</div></div>
      <div class="stat"><div class="stat__v">${dur(flightMin)}</div><div class="stat__k">Flying · ${legs.filter(l=>l.mode==='flight').length} legs</div></div>
    </div>
  </header>

  <section class="map" aria-label="Itinerary map">
    <div class="map__frame">
      <img id="mapimg" src="data:image/png;base64,${png}" alt="Map of the rollout itinerary with numbered stops, road routes and flight arcs from Seattle to Denver" width="2840" height="2080">
      <div class="map__bar">
        <span class="key"><span class="key__badge">1</span>Stop · visit order</span>
        <span class="key"><span class="key__sw"></span>Driving route (routed road geometry)</span>
        <span class="key"><span class="key__sw key__sw--flight"></span>Flight</span>
        <button type="button" id="openviewer">View full size</button>
      </div>
    </div>
  </section>

  <section class="sched" aria-label="Schedule">
    <div class="sched__head"><h2>Schedule</h2><span>Drive times and distances are road-routed estimates; flight times as booked.</span></div>
    <div class="days">${dayBlocks}</div>
  </section>

  <footer class="foot">
    <span>Coordinates geocoded from the street addresses.</span>
    <span>Map © OpenFreeMap · OpenMapTiles · OpenStreetMap contributors. Routing via OSRM.</span>
    <span>Denver flight not yet booked — any time before Oct 6.</span>
  </footer>
</div>
<div class="viewer" id="viewer" hidden role="dialog" aria-label="Full-size map">
  <span class="viewer__hint">Scroll to pan · Esc to close</span>
  <button type="button" class="viewer__close" id="closeviewer">Close</button>
  <img id="viewerimg" alt="">
</div>
<script>
(function(){
  var v=document.getElementById('viewer'),o=document.getElementById('openviewer'),c=document.getElementById('closeviewer'),img=document.getElementById('mapimg');
  function open(){document.getElementById('viewerimg').src=img.src;v.hidden=false;document.body.style.overflow='hidden';c.focus();}
  function close(){v.hidden=true;document.body.style.overflow='';o.focus();}
  o.addEventListener('click',open);img.addEventListener('click',open);img.style.cursor='zoom-in';
  c.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!v.hidden)close();});
})();
</script>
`;
fs.writeFileSync(`${out}/kpmg-west-rollout.html`, html);
console.log('wrote', `${out}/kpmg-west-rollout.html`, Math.round(html.length / 1024), 'KB');
