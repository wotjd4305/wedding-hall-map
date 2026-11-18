(() => {
  "use strict";

  const VENUES = window.VENUES.map((v, i) => ({ ...v, id: i }));
  const TYPES = window.VENUE_TYPES;
  const STATUSES = window.STATUSES;
  const KEY = (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_MAPS_API_KEY || "").trim();
  const CENTER = { lat: 37.47, lng: 127.0 };
  const STORE_KEY = "wedding-hall-map:v1";
  const PRICE_MAX = 15;

  // ── 저장소 (venue 이름 기준) ──────────────
  const store = (() => {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch { data = {}; }
    const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {} };
    return {
      get: (v) => data[v.name] || {},
      set(v, patch) {
        const cur = { ...(data[v.name] || {}), ...patch };
        Object.keys(cur).forEach((k) => { if (cur[k] === "" || cur[k] == null) delete cur[k]; });
        if (Object.keys(cur).length) data[v.name] = cur; else delete data[v.name];
        save();
      },
      all: () => data,
      replace(next) { data = next || {}; save(); }
    };
  })();

  const state = {
    q: "",
    region: "all",
    types: new Set(Object.keys(TYPES)),
    statuses: new Set(),      // 비어있으면 전체
    priceMax: PRICE_MAX,
    onlyMine: false,
    sort: "default",
    activeId: null,
    me: null
  };

  const $ = (s) => document.querySelector(s);
  const els = {
    list: $("#list"), count: $("#count"), checked: $("#checked"), q: $("#q"),
    regionSeg: $("#regionSeg"), typeChips: $("#typeChips"), statusChips: $("#statusChips"),
    moreToggle: $("#moreToggle"), more: $("#more"),
    price: $("#price"), priceVal: $("#priceVal"), onlyMine: $("#onlyMine"), sortSeg: $("#sortSeg"),
    exportBtn: $("#exportBtn"), importBtn: $("#importBtn"), importFile: $("#importFile"),
    panel: $("#panel"), handle: $("#sheetHandle"), badge: $("#mapBadge")
  };

  let map = null;

  // ── helpers ─────────────────────────────
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gmapsUrl = (v) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + v.area.split(" ")[0])}`;
  const naverUrl = (v) => `https://map.naver.com/p/search/${encodeURIComponent(v.name)}`;
  const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : null; };

  function meal(v) {
    const mine = num(store.get(v).meal);
    return mine != null ? { value: mine, est: false } : { value: TYPES[v.type].estMeal, est: true };
  }

  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function infoHtml(v) {
    const t = TYPES[v.type], u = store.get(v), s = STATUSES[u.status], m = meal(v);
    return `<div class="iw">
      <div class="iw-tags"><span class="tag" style="background:${t.color}">${t.label}</span>${s ? `<span class="stag" style="color:${s.color}">${s.emoji} ${s.label}</span>` : ""}</div>
      <h4>${esc(v.name)}</h4>
      <p>${esc(v.area)}${v.station ? ` · 🚇 ${esc(v.station)}` : ""}</p>
      <p>식대 ${m.value}만원${m.est ? " (추정)" : ""}${u.rent ? ` · 대관 ${esc(u.rent)}만원` : ""}</p>
      ${u.memo ? `<p class="iw-memo">📝 ${esc(u.memo)}</p>` : ""}
      <div class="links">
        <a href="${gmapsUrl(v)}" target="_blank" rel="noopener">구글지도</a>
        <a class="naver" href="${naverUrl(v)}" target="_blank" rel="noopener">네이버지도</a>
      </div>
    </div>`;
  }

  // ── 필터 & 목록 ─────────────────────────
  function filtered() {
    const q = state.q.toLowerCase();
    let arr = VENUES.filter((v) => {
      const u = store.get(v);
      if (state.region !== "all" && v.region !== state.region) return false;
      if (!state.types.has(v.type)) return false;
      if (state.statuses.size) {
        const key = u.status || "none";
        if (!state.statuses.has(key)) return false;
      }
      const m = meal(v);
      if (state.onlyMine && m.est) return false;
      if (state.priceMax < PRICE_MAX && m.value > state.priceMax) return false;
      if (q && ![v.name, v.area, v.station, v.note, TYPES[v.type].label, u.memo].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });

    if (state.me) arr = arr.map((v) => ({ ...v, _d: km(state.me, v) }));
    if (state.sort === "near" && state.me) arr.sort((a, b) => a._d - b._d);
    if (state.sort === "price") arr.sort((a, b) => meal(a).value - meal(b).value);
    return arr;
  }

  function itemHtml(v) {
    const t = TYPES[v.type], u = store.get(v), s = STATUSES[u.status], m = meal(v);
    const active = v.id === state.activeId;
    return `<li class="item ${active ? "active" : ""} ${u.status === "nope" ? "dim" : ""}" data-id="${v.id}">
      <div class="item-top">
        <span class="tag" style="background:${t.color}">${t.label}</span>
        <h3>${esc(v.name)}</h3>
        ${s ? `<span class="stag" style="color:${s.color}">${s.emoji} ${s.label}</span>` : ""}
        ${v._d != null ? `<span class="dist">${v._d < 10 ? v._d.toFixed(1) : Math.round(v._d)}km</span>` : ""}
      </div>
      <div class="meta">
        <span>📍 ${esc(v.area)}</span>
        ${v.station ? `<span>🚇 ${esc(v.station)}</span>` : ""}
        <span class="${m.est ? "est" : "mine"}">🍽 ${m.value}만원${m.est ? " 추정" : ""}</span>
      </div>
      ${v.note ? `<p class="note">${esc(v.note)}</p>` : ""}
      ${u.memo && !active ? `<p class="memo-preview">📝 ${esc(u.memo)}</p>` : ""}
      ${active ? editorHtml(v, u) : ""}
    </li>`;
  }

  function editorHtml(v, u) {
    return `<div class="editor" data-editor>
      <div class="status-row">
        ${Object.entries(STATUSES).map(([k, s]) =>
          `<button class="sbtn ${u.status === k ? "on" : ""}" data-status="${k}" style="--c:${s.color}">${s.emoji} ${s.label}</button>`).join("")}
      </div>
      <div class="fields">
        <label>식대(1인)<span><input data-field="meal" inputmode="decimal" placeholder="${TYPES[v.type].estMeal}" value="${esc(u.meal)}" />만원</span></label>
        <label>대관료<span><input data-field="rent" inputmode="decimal" placeholder="-" value="${esc(u.rent)}" />만원</span></label>
        <label>보증인원<span><input data-field="guests" inputmode="numeric" placeholder="-" value="${esc(u.guests)}" />명</span></label>
      </div>
      <textarea data-field="memo" rows="3" placeholder="메모 (투어 날짜, 주차, 밥맛, 홀 분위기…)">${esc(u.memo)}</textarea>
      <div class="links">
        <a href="${gmapsUrl(v)}" target="_blank" rel="noopener">구글지도</a>
        <a class="naver" href="${naverUrl(v)}" target="_blank" rel="noopener">네이버지도</a>
      </div>
    </div>`;
  }

  function render() {
    const arr = filtered();
    els.count.textContent = arr.length;
    els.checked.textContent = Object.values(store.all()).filter((u) => u.status && u.status !== "nope").length;
    els.list.innerHTML = arr.length ? arr.map(itemHtml).join("") : `<li class="empty">조건에 맞는 웨딩홀이 없어요</li>`;
    if (map) {
      const ids = new Set(arr.map((v) => v.id));
      VENUES.forEach((v) => map.setVisible(v.id, ids.has(v.id)));
    }
    renderStatusChips();
  }

  function rerenderItem(id) {
    const el = els.list.querySelector(`.item[data-id="${id}"]`);
    if (!el) return;
    const v = filtered().find((x) => x.id === id) || VENUES[id];
    el.outerHTML = itemHtml(v);
  }

  function select(id, { pan = true } = {}) {
    const prev = state.activeId;
    state.activeId = id;
    if (prev != null && prev !== id) rerenderItem(prev);
    rerenderItem(id);
    if (map) map.open(VENUES[id], pan);
    const el = els.list.querySelector(`.item[data-id="${id}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // 편집 후 지도/카운트만 갱신 (입력 포커스 유지)
  function afterEdit(v, { full = false } = {}) {
    if (map) map.refresh(v);
    els.checked.textContent = Object.values(store.all()).filter((u) => u.status && u.status !== "nope").length;
    if (full) { rerenderItem(v.id); renderStatusChips(); }
  }

  // ── 컨트롤 ───────────────────────────────
  function renderStatusChips() {
    const counts = {};
    VENUES.forEach((v) => { const k = store.get(v).status || "none"; counts[k] = (counts[k] || 0) + 1; });
    const entries = [...Object.entries(STATUSES), ["none", { label: "미분류", emoji: "○", color: "#9A928C" }]];
    els.statusChips.innerHTML = entries.map(([k, s]) =>
      `<button class="chip ${state.statuses.has(k) ? "on" : ""}" data-status="${k}" style="color:${s.color}"><span class="e">${s.emoji}</span><span style="color:var(--ink)">${s.label}</span><small>${counts[k] || 0}</small></button>`
    ).join("");
  }

  function updatePriceLabel() {
    els.priceVal.textContent = state.priceMax >= PRICE_MAX ? "전체" : `${state.priceMax}만원 이하`;
  }

  function buildControls() {
    els.typeChips.innerHTML = Object.entries(TYPES).map(([k, t]) =>
      `<button class="chip on" data-type="${k}" style="color:${t.color}"><i style="background:${t.color}"></i><span style="color:var(--ink)">${t.label}</span></button>`
    ).join("");

    els.typeChips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const k = b.dataset.type, all = Object.keys(TYPES);
      if (state.types.size === all.length) state.types = new Set([k]);
      else if (state.types.has(k)) { state.types.delete(k); if (!state.types.size) state.types = new Set(all); }
      else state.types.add(k);
      els.typeChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", state.types.has(c.dataset.type)));
      render(); map && map.fit(filtered());
    });

    els.statusChips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const k = b.dataset.status;
      state.statuses.has(k) ? state.statuses.delete(k) : state.statuses.add(k);
      render(); map && map.fit(filtered());
    });

    els.regionSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.region = b.dataset.region;
      els.regionSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      render(); map && map.fit(filtered());
    });

    els.moreToggle.addEventListener("click", () => {
      els.more.hidden = !els.more.hidden;
      els.moreToggle.classList.toggle("open", !els.more.hidden);
    });

    els.price.addEventListener("input", () => { state.priceMax = parseFloat(els.price.value); updatePriceLabel(); render(); });
    els.onlyMine.addEventListener("change", () => { state.onlyMine = els.onlyMine.checked; render(); });

    els.sortSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const sort = b.dataset.sort;
      const apply = () => {
        state.sort = sort;
        els.sortSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      };
      if (sort === "near" && !state.me) locate(apply); else apply();
    });

    let t;
    els.q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = els.q.value.trim(); render(); }, 150);
    });

    // 목록 클릭: 카드 선택 / 편집기 내부 동작
    els.list.addEventListener("click", (e) => {
      const li = e.target.closest(".item"); if (!li) return;
      const id = +li.dataset.id, v = VENUES[id];
      const sb = e.target.closest(".sbtn");
      if (sb) {
        const k = sb.dataset.status;
        store.set(v, { status: store.get(v).status === k ? "" : k });
        afterEdit(v, { full: true });
        return;
      }
      if (e.target.closest("[data-editor]")) return; // 입력칸/링크 클릭은 무시
      if (state.activeId === id) { state.activeId = null; rerenderItem(id); return; }
      select(id);
    });

    // 입력은 디바운스 저장
    const saveT = {};
    els.list.addEventListener("input", (e) => {
      const f = e.target.dataset.field; if (!f) return;
      const id = +e.target.closest(".item").dataset.id, v = VENUES[id], key = id + ":" + f, val = e.target.value.trim();
      clearTimeout(saveT[key]);
      saveT[key] = setTimeout(() => { store.set(v, { [f]: val }); afterEdit(v); }, 300);
    });

    // 백업
    els.exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(store.all(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `웨딩홀-체크-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    els.importBtn.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", async () => {
      const f = els.importFile.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (typeof data !== "object" || Array.isArray(data)) throw 0;
        const merge = confirm("기존 체크·메모에 합칠까요?\n[확인] 합치기  [취소] 덮어쓰기");
        store.replace(merge ? { ...store.all(), ...data } : data);
        VENUES.forEach((v) => map && map.refresh(v));
        render(); showBadge("가져오기 완료");
      } catch { alert("올바른 백업 파일이 아니에요."); }
      els.importFile.value = "";
    });

    // 모바일 바텀시트
    const order = ["collapsed", "", "expanded"];
    els.handle.addEventListener("click", () => {
      const cur = els.panel.classList.contains("expanded") ? "expanded" : els.panel.classList.contains("collapsed") ? "collapsed" : "";
      setSheet(order[(order.indexOf(cur) + 1) % order.length]);
    });

    updatePriceLabel();
  }

  function locate(done) {
    if (!navigator.geolocation) return alert("이 브라우저는 위치 기능을 지원하지 않아요.");
    showBadge("위치 확인 중…");
    navigator.geolocation.getCurrentPosition((p) => {
      state.me = { lat: p.coords.latitude, lng: p.coords.longitude };
      map && map.setMe(state.me);
      done && done();
    }, () => alert("위치 권한을 허용해 주세요."), { enableHighAccuracy: true, timeout: 8000 });
  }

  function setSheet(s) {
    els.panel.classList.remove("expanded", "collapsed");
    if (s) els.panel.classList.add(s);
  }

  // ── 지도 ────────────────────────────────
  function pinSvg(v) {
    const color = TYPES[v.type].color, s = STATUSES[store.get(v).status];
    const inner = s
      ? `<circle cx="15" cy="15" r="9" fill="#fff"/><text x="15" y="19.5" font-size="12" text-anchor="middle" fill="${s.color}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${s.emoji}</text>`
      : `<circle cx="15" cy="15" r="5" fill="#fff"/>`;
    const big = s && store.get(v).status !== "nope";
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-12.6 13-23A13 13 0 0 0 2 16c0 10.4 13 23 13 23z" fill="${color}" stroke="#fff" stroke-width="2"/>${inner}</svg>`, scale: big ? 1.2 : 1, opacity: store.get(v).status === "nope" ? 0.4 : 1, z: big ? 10 : 1 };
  }

  function googleAdapter() {
    const g = window.google.maps;
    const m = new g.Map(document.getElementById("map"), {
      center: CENTER, zoom: 10, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      clickableIcons: false, gestureHandling: "greedy",
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit.station", stylers: [{ visibility: "simplified" }] },
        { elementType: "geometry", stylers: [{ saturation: -30 }] }
      ]
    });
    const iw = new g.InfoWindow();
    const markers = {};
    let meMarker = null, openId = null;

    const icon = (v) => {
      const p = pinSvg(v);
      return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(p.svg), scaledSize: new g.Size(30 * p.scale, 40 * p.scale), anchor: new g.Point(15 * p.scale, 39 * p.scale) };
    };

    VENUES.forEach((v) => {
      const p = pinSvg(v);
      const mk = new g.Marker({ position: { lat: v.lat, lng: v.lng }, map: m, title: v.name, icon: icon(v), opacity: p.opacity, zIndex: p.z });
      mk.addListener("click", () => { select(v.id, { pan: false }); if (window.innerWidth <= 768) setSheet(""); });
      markers[v.id] = mk;
    });
    iw.addListener("closeclick", () => { openId = null; });

    return {
      setVisible: (id, on) => markers[id].setMap(on ? m : null),
      refresh: (v) => {
        const p = pinSvg(v), mk = markers[v.id];
        mk.setIcon(icon(v)); mk.setOpacity(p.opacity); mk.setZIndex(p.z);
        if (openId === v.id) iw.setContent(infoHtml(v));
      },
      open: (v, pan) => {
        openId = v.id;
        iw.setContent(infoHtml(v)); iw.open({ map: m, anchor: markers[v.id] });
        if (pan) { m.panTo({ lat: v.lat, lng: v.lng }); if (m.getZoom() < 14) m.setZoom(14); }
      },
      fit: (arr) => {
        if (!arr.length) return;
        const b = new g.LatLngBounds(); arr.forEach((v) => b.extend({ lat: v.lat, lng: v.lng }));
        m.fitBounds(b, 60); if (arr.length === 1) m.setZoom(14);
      },
      setMe: (p) => {
        if (meMarker) meMarker.setMap(null);
        if (!p) return;
        meMarker = new g.Marker({ position: p, map: m, zIndex: 999, icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: "#2F80ED", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } });
        m.panTo(p); m.setZoom(12);
      }
    };
  }

  function leafletAdapter() {
    const L = window.L;
    const m = L.map("map").setView([CENTER.lat, CENTER.lng], 10);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(m);
    const markers = {};
    let meMarker = null;

    const icon = (v) => {
      const p = pinSvg(v);
      return L.divIcon({ className: "pin", html: p.svg.replace('width="30" height="40"', `width="${30 * p.scale}" height="${40 * p.scale}"`), iconSize: [30 * p.scale, 40 * p.scale], iconAnchor: [15 * p.scale, 39 * p.scale], popupAnchor: [0, -34 * p.scale] });
    };

    VENUES.forEach((v) => {
      const p = pinSvg(v);
      const mk = L.marker([v.lat, v.lng], { icon: icon(v), title: v.name, opacity: p.opacity, zIndexOffset: p.z * 100 }).addTo(m).bindPopup(() => infoHtml(v));
      mk.on("click", () => { select(v.id, { pan: false }); if (window.innerWidth <= 768) setSheet(""); });
      markers[v.id] = mk;
    });

    return {
      setVisible: (id, on) => { on ? markers[id].addTo(m) : markers[id].remove(); },
      refresh: (v) => {
        const p = pinSvg(v), mk = markers[v.id];
        mk.setIcon(icon(v)); mk.setOpacity(p.opacity); mk.setZIndexOffset(p.z * 100);
        if (mk.isPopupOpen()) mk.setPopupContent(infoHtml(v));
      },
      open: (v, pan) => {
        if (pan) m.setView([v.lat, v.lng], Math.max(m.getZoom(), 14));
        markers[v.id].openPopup();
      },
      fit: (arr) => {
        if (!arr.length) return;
        m.fitBounds(L.latLngBounds(arr.map((v) => [v.lat, v.lng])), { padding: [50, 50], maxZoom: 14 });
      },
      setMe: (p) => {
        if (meMarker) { meMarker.remove(); meMarker = null; }
        if (!p) return;
        meMarker = L.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2F80ED", fillOpacity: 1 }).addTo(m);
        m.setView([p.lat, p.lng], 12);
      }
    };
  }

  // ── 부팅 ────────────────────────────────
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
  }

  let badgeT;
  function showBadge(text) {
    els.badge.textContent = text; els.badge.hidden = false;
    clearTimeout(badgeT); badgeT = setTimeout(() => { els.badge.hidden = true; }, 5000);
  }

  async function bootLeaflet(reason) {
    loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    try { await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"); }
    catch { showBadge("지도를 불러오지 못했어요 (네트워크 확인)"); return; }
    map = leafletAdapter();
    render(); map.fit(filtered());
    if (reason) showBadge(reason);
  }

  function bootGoogle() {
    window.__initGoogle = () => { map = googleAdapter(); render(); map.fit(filtered()); };
    window.gm_authFailure = () => { document.getElementById("map").innerHTML = ""; bootLeaflet("구글지도 키 인증 실패 → 기본 지도로 표시 중"); };
    loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&callback=__initGoogle&language=ko&region=KR&loading=async`)
      .catch(() => bootLeaflet("구글지도 로드 실패 → 기본 지도로 표시 중"));
  }

  buildControls();
  render();
  if (KEY) bootGoogle();
  else bootLeaflet("config.js에 구글지도 API 키를 넣으면 구글지도로 바뀌어요");
})();
