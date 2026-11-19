(() => {
  "use strict";

  const VENUES = window.VENUES.map((v, i) => ({ ...v, id: i, _lat0: v.lat, _lng0: v.lng }));
  const TYPES = window.VENUE_TYPES;
  const STATUSES = window.STATUSES;
  const CFG = window.APP_CONFIG || {};
  const KEY = (CFG.GOOGLE_MAPS_API_KEY || "").trim();
  const FB = CFG.FIREBASE_CONFIG;
  const CENTER = { lat: 37.47, lng: 127.0 };
  const STORE_KEY = "wedding-hall-map:v1";
  const GEO_KEY = "wedding-hall-map:geo";
  const MAX = { price: 20, rent: 2500 };
  const REGIONS = [...new Set(VENUES.map((v) => v.region))];

  // ── 저장소: 체크·메모 (venue 이름 기준) ────
  const store = (() => {
    let data = {};
    let remote = null;
    const listeners = [];
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch { data = {}; }
    const saveLocal = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {} };
    const clean = (o) => { Object.keys(o).forEach((k) => { if (o[k] === "" || o[k] == null) delete o[k]; }); return o; };

    return {
      get: (v) => data[v.name] || {},
      all: () => data,
      isShared: () => !!remote,
      onChange: (cb) => listeners.push(cb),
      set(v, patch) {
        const cur = clean({ ...(data[v.name] || {}), ...patch });
        if (Object.keys(cur).length) data[v.name] = cur; else delete data[v.name];
        if (remote) remote.write(v.name, patch); else saveLocal();
      },
      replace(next, merge) {
        next = next || {};
        if (remote) {
          if (!merge) Object.keys(data).forEach((name) => { if (!next[name]) remote.remove(name); });
          Object.entries(next).forEach(([name, u]) => remote.write(name, { status: "", meal: "", rent: "", guests: "", flower: "", parking: "", memo: "", bookables: "", phone: "", ...u }));
        } else {
          data = merge ? { ...data, ...next } : next;
          saveLocal();
        }
      },
      attach(api) {
        const localBefore = data;
        let first = true;
        remote = api;
        api.subscribe((next) => {
          if (first) {
            first = false;
            if (!Object.keys(next).length && Object.keys(localBefore).length) {
              Object.entries(localBefore).forEach(([name, u]) => api.write(name, u));
              data = { ...localBefore };
              listeners.forEach((cb) => cb());
              return;
            }
          }
          data = next;
          listeners.forEach((cb) => cb());
        });
      }
    };
  })();

  // ── 저장소: 위치 보정 캐시 (공유 DB 있으면 거기, 없으면 브라우저) ──
  const geo = {
    backend: null,
    async all() {
      if (this.backend) { try { return await this.backend.all(); } catch (e) { console.warn(e); } }
      try { return JSON.parse(localStorage.getItem(GEO_KEY) || "{}"); } catch { return {}; }
    },
    set(name, val) {
      if (this.backend) this.backend.set(name, val);
      try { const d = JSON.parse(localStorage.getItem(GEO_KEY) || "{}"); d[name] = val; localStorage.setItem(GEO_KEY, JSON.stringify(d)); } catch {}
    }
  };

  // ── 사진 (공유 DB: photoMeta=썸네일, photoData=원본) ──
  const photos = {
    backend: null,
    byVenue: {},
    listeners: [],
    of: (v) => photos.byVenue[v.name] || [],
    set(list) {
      const by = {};
      list.forEach((p) => { (by[p.venue] = by[p.venue] || []).push(p); });
      Object.values(by).forEach((a) => a.sort((x, y) => x.t - y.t));
      photos.byVenue = by;
      photos.listeners.forEach((cb) => cb());
    }
  };

  function loadImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 읽을 수 없어요")); };
      img.src = url;
    });
  }
  function shrink(img, max, quality, limit) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = quality, out = c.toDataURL("image/jpeg", q);
    while (limit && out.length > limit && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
    return out;
  }

  async function uploadPhotos(v, files) {
    if (!photos.backend) { alert("사진은 공유 모드(Firebase 연결)에서만 올릴 수 있어요."); return; }
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    for (let i = 0; i < list.length; i++) {
      showBadge(`사진 올리는 중… ${i + 1}/${list.length}`);
      try {
        const img = await loadImage(list[i]);
        const thumb = shrink(img, 240, 0.6, 30000);
        const full = shrink(img, 1280, 0.72, 900000);
        await photos.backend.add(v.name, thumb, full);
      } catch (e) { console.error(e); showBadge("사진 업로드 실패 — 규칙/용량을 확인해 주세요"); return; }
    }
    showBadge(`사진 ${list.length}장 올렸어요`);
  }

  // 라이트박스
  async function openPhoto(v, id) {
    const list = photos.of(v);
    let idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const box = document.createElement("div");
    box.className = "lightbox";
    document.body.appendChild(box);
    const show = async () => {
      const p = list[idx];
      box.innerHTML = `<div class="lb-inner">
        <img src="${p.thumb}" alt="" />
        <div class="lb-bar">
          <span>${esc(v.name)} · ${idx + 1}/${list.length}${p.by ? ` · ${esc(p.by)}` : ""}</span>
          <span class="lb-btns">
            ${list.length > 1 ? `<button data-lb="prev">‹</button><button data-lb="next">›</button>` : ""}
            <button data-lb="del">삭제</button><button data-lb="close">닫기</button>
          </span>
        </div></div>`;
      try { const full = await photos.backend.getFull(p.id); if (full && list[idx] === p) box.querySelector("img").src = full; } catch (e) { console.warn(e); }
    };
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") { idx = (idx + 1) % list.length; show(); } if (e.key === "ArrowLeft") { idx = (idx - 1 + list.length) % list.length; show(); } };
    document.addEventListener("keydown", onKey);
    box.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-lb]");
      if (!a) { if (e.target === box) close(); return; }
      const act = a.dataset.lb;
      if (act === "close") close();
      if (act === "next") { idx = (idx + 1) % list.length; show(); }
      if (act === "prev") { idx = (idx - 1 + list.length) % list.length; show(); }
      if (act === "del" && confirm("이 사진을 삭제할까요? 같이 보는 사람한테서도 지워져요.")) {
        await photos.backend.remove(list[idx].id); close();
      }
    });
    show();
  }

  const state = {
    q: "",
    region: "all",
    types: new Set(Object.keys(TYPES)),
    statuses: new Set(),
    priceMax: MAX.price,
    rentMax: MAX.rent,
    guests: 0,
    parkMin: 0,
    bookableMax: "",
    onlyBookable: false,
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
    price: $("#price"), priceVal: $("#priceVal"), rent: $("#rent"), rentVal: $("#rentVal"),
    guests: $("#guests"), guestVal: $("#guestVal"), park: $("#park"), parkVal: $("#parkVal"),
    bookableFilter: $("#bookableFilter"), bookableVal: $("#bookableVal"), bookableFilterClear: $("#bookableFilterClear"), onlyBookable: $("#onlyBookable"),
    onlyMine: $("#onlyMine"), sortSeg: $("#sortSeg"),
    exportBtn: $("#exportBtn"), importBtn: $("#importBtn"), importFile: $("#importFile"),
    panel: $("#panel"), handle: $("#sheetHandle"), badge: $("#mapBadge")
  };

  let map = null;

  // ── helpers ─────────────────────────────
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const regionWord = (v) => (v.region === "서울" ? "서울" : v.region === "경기" ? "경기도" : v.region + "광역시");
  const gmapsUrl = (v) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + regionWord(v) + " " + v.area)}`;
  const naverUrl = (v) => `https://map.naver.com/p/search/${encodeURIComponent(v.name)}`;
  const imgUrl = (v) => `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(v.name + " 웨딩홀")}`;
  const linksHtml = (v) => `<div class="links">
        ${phone(v) ? `<a class="call" href="tel:${phone(v).replace(/[^\d+]/g, "")}">📞 ${esc(phone(v))}</a>` : ""}
        <a href="${gmapsUrl(v)}" target="_blank" rel="noopener">구글지도</a>
        <a class="naver" href="${naverUrl(v)}" target="_blank" rel="noopener">네이버지도</a>
        <a class="img" href="${imgUrl(v)}" target="_blank" rel="noopener">사진 검색</a>
      </div>`;
  const num = (x) => { const n = parseFloat(String(x ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  const n2 = (x) => String(Math.round(x * 100) / 100);
  function parseRange(x) {
    const parts = String(x ?? "").replace(/[,만원\s]/g, "").split(/[~\-–]/).filter(Boolean).map(Number);
    if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null;
    return { lo: Math.min(...parts), hi: Math.max(...parts) };
  }
  const rangeText = (a) => (a ? (a[0] === a[1] ? n2(a[0]) : `${n2(a[0])}~${n2(a[1])}`) : "");
  const guar = (v) => num(store.get(v).guests) ?? v.guar ?? null;

  // 식대/대관료: 내 견적 > 표기가 > 공시가
  function meal(v) {
    const mine = parseRange(store.get(v).meal);
    if (mine) return { ...mine, src: "mine" };
    if (v.meal) return { lo: v.meal[0], hi: v.meal[1], src: "ad" };
    if (v.mealOff) return { lo: v.mealOff[0], hi: v.mealOff[1], src: "off" };
    return null;
  }
  function hallRent(v) {
    const mine = parseRange(store.get(v).rent);
    if (mine) return { ...mine, src: "mine" };
    if (v.rent) return { lo: v.rent[0], hi: v.rent[1], src: "ad" };
    return null;
  }
  const flower = (v) => num(store.get(v).flower);
  const parking = (v) => num(store.get(v).parking);
  const phone = (v) => (store.get(v).phone || "").trim() || null;
  // 예약 가능 월: 월·성수기/비수기·식대를 행 단위로 직접 입력 (내가 전화로 확인한 값)
  const rawBookRows = (v) => store.get(v).bookables || [];
  const bookRows = (v) => rawBookRows(v).filter((r) => r && r.month);
  const earliestBookMonth = (v) => bookRows(v).map((r) => r.month).sort()[0] || null;
  const bookLine = (r) => `📅 ${r.month.replace("-", ".")} ${r.season === "off" ? "비수기" : "성수기"}${r.meal ? ` 식대 ${esc(r.meal)}만` : ""}`;
  // 필터·정렬에 쓰는 대관료 = 대관료 + 꽃값(입력했을 때)
  function rent(v) {
    const r = hallRent(v), f = flower(v);
    if (!r) return f != null ? { lo: f, hi: f, src: "mine" } : null;
    return f != null ? { lo: r.lo + f, hi: r.hi + f, src: "mine" } : r;
  }
  // 예상 총액(최소) = 대관 + 꽃 + 식대 × 보증인원
  function total(v) {
    const r = hallRent(v), m = meal(v), g = guar(v);
    if (!r || !m || !g) return null;
    const f = flower(v);
    return { lo: Math.round(r.lo + (f || 0) + m.lo * g), noFlower: f == null, g };
  }
  const won = (x) => x >= 10000 ? `${n2(x / 10000)}억` : `${x.toLocaleString()}만`;
  const range = (r, unit = "만") => {
    if (!r) return "-";
    if (r.hi === 0) return "0원";
    const lo = r.lo === 0 ? "0원" : n2(r.lo) + unit;
    return r.lo === r.hi ? lo : `${lo}~${n2(r.hi)}${unit}`;
  };

  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function priceLines(v) {
    const m = meal(v), r = hallRent(v), f = flower(v), pk = parking(v), t = total(v);
    const mTxt = m ? `${range(m)}${m.src === "mine" ? " ✎" : m.src === "off" ? " (공시가)" : ""}` : "-";
    const rTxt = r ? `${range(r)}${r.src === "mine" ? " ✎" : ""}` : "-";
    const fTxt = f == null ? "꽃 ?" : f === 0 ? "꽃 포함" : `꽃 ${n2(f)}만`;
    const tTxt = t ? `예상 ${won(t.lo)}~${t.noFlower ? " +꽃" : ""} (보증 ${t.g}명 기준)` : "";
    const pTxt = pk != null ? `🚗 주차 ${pk}대` : "";
    const bLines = bookRows(v).slice().sort((a, b) => a.month.localeCompare(b.month)).map(bookLine);
    return { m, r, mTxt, rTxt, fTxt, tTxt, pTxt, bLines, f };
  }

  function infoHtml(v) {
    const t = TYPES[v.type], u = store.get(v), s = STATUSES[u.status], p = priceLines(v);
    return `<div class="iw">
      <div class="iw-tags"><span class="tag" style="background:${t.color}">${t.label}</span>${s ? `<span class="stag" style="color:${s.color}">${s.emoji} ${s.label}</span>` : ""}</div>
      ${photos.of(v).length ? `<img class="iw-img" src="${photos.of(v)[0].thumb}" alt="" />` : ""}
      <h4>${esc(v.name)}</h4>
      <p>${esc(v.addr || `${v.region} ${v.area}`)}${v.approx ? ` <span class="approx">위치 대략</span>` : ""}</p>
      <p>🍽 식대 ${esc(p.mTxt)}</p>
      <p>🏛 대관 ${esc(p.rTxt)} · 💐 ${esc(p.fTxt)}${p.pTxt ? ` · ${esc(p.pTxt)}` : ""}</p>
      ${p.tTxt ? `<p><b>💰 ${esc(p.tTxt)}</b></p>` : ""}
      ${v.cap || guar(v) ? `<p>👥 수용 ${v.cap ?? "-"} · 보증 ${guar(v) ?? "-"}명${num(store.get(v).guests) != null ? " ✎" : ""}</p>` : ""}
      ${p.bLines.length ? `<p class="mine">${p.bLines.join("<br>")}</p>` : ""}
      ${v.note ? `<p>${esc(v.note)}</p>` : ""}
      ${u.memo ? `<p class="iw-memo">📝 ${esc(u.memo)}</p>` : ""}
      ${linksHtml(v)}
    </div>`;
  }

  // ── 필터 & 목록 ─────────────────────────
  function filtered() {
    const q = state.q.toLowerCase();
    let arr = VENUES.filter((v) => {
      const u = store.get(v);
      if (state.region !== "all" && v.region !== state.region) return false;
      if (!state.types.has(v.type)) return false;
      if (state.statuses.size && !state.statuses.has(u.status || "none")) return false;
      const m = meal(v), r = rent(v);
      if (state.onlyMine && ["meal", "rent", "flower", "parking"].every((k) => num(u[k]) == null) && !bookRows(v).length) return false;
      if (state.priceMax < MAX.price && (!m || m.lo > state.priceMax)) return false;
      if (state.rentMax < MAX.rent && (!r || r.lo > state.rentMax)) return false;
      if (state.guests > 0 && !(v.cap >= state.guests)) return false;
      if (state.parkMin > 0 && !(parking(v) >= state.parkMin)) return false;
      if (state.onlyBookable && !bookRows(v).length) return false;
      if (state.bookableMax) { const bm = earliestBookMonth(v); if (!bm || bm > state.bookableMax) return false; }
      if (q && ![v.name, v.area, v.region, v.addr, v.note, TYPES[v.type].label, u.memo].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });

    if (state.me) arr = arr.map((v) => ({ ...v, _d: km(state.me, v) }));
    const big = 1e9;
    if (state.sort === "near" && state.me) arr.sort((a, b) => a._d - b._d);
    if (state.sort === "price") arr.sort((a, b) => (meal(a)?.lo ?? big) - (meal(b)?.lo ?? big));
    if (state.sort === "rent") arr.sort((a, b) => (rent(a)?.lo ?? big) - (rent(b)?.lo ?? big));
    return arr;
  }

  function itemHtml(v) {
    const t = TYPES[v.type], u = store.get(v), s = STATUSES[u.status], p = priceLines(v);
    const active = v.id === state.activeId;
    const gq = guar(v), gMine = num(u.guests) != null;
    const phs = photos.of(v);
    const warn = state.guests > 0 && gq && state.guests < gq ? ` <b class="warn">보증 ${gq}명 미만</b>` : "";
    return `<li class="item ${active ? "active" : ""} ${u.status === "nope" ? "dim" : ""}" data-id="${v.id}">
      <div class="item-top">
        <span class="tag" style="background:${t.color}">${t.label}</span>
        <h3>${esc(v.name)}</h3>
        ${s ? `<span class="stag" style="color:${s.color}">${s.emoji} ${s.label}</span>` : ""}
        ${v._d != null ? `<span class="dist">${v._d < 10 ? v._d.toFixed(1) : Math.round(v._d)}km</span>` : ""}
        ${phs.length && !active ? `<span class="thumb"><img src="${phs[0].thumb}" alt="" />${phs.length > 1 ? `<b>${phs.length}</b>` : ""}</span>` : ""}
      </div>
      <div class="meta">
        <span>📍 ${esc(v.region === "서울" ? v.area : `${v.region} ${v.area}`)}</span>
        ${v.cap || gq ? `<span>👥 수용 ${v.cap ?? "-"} · <span class="${gMine ? "mine" : ""}">보증 ${gq ?? "-"}${gMine ? " ✎" : ""}</span>${warn}</span>` : ""}
      </div>
      <div class="meta">
        <span class="${p.m?.src === "mine" ? "mine" : ""}">🍽 ${esc(p.mTxt)}</span>
        <span class="${p.r?.src === "mine" ? "mine" : ""}">🏛 대관 ${esc(p.rTxt)}</span>
        <span class="${p.f != null ? "mine" : "est"}">💐 ${esc(p.fTxt)}</span>
        ${p.pTxt ? `<span class="mine">${esc(p.pTxt)}</span>` : ""}
      </div>
      ${p.tTxt ? `<div class="total">💰 ${esc(p.tTxt)}</div>` : ""}
      ${p.bLines.length && !active ? `<p class="memo-preview">${p.bLines.join("<br>")}</p>` : ""}
      ${v.note ? `<p class="note">${esc(v.note)}</p>` : ""}
      ${u.memo && !active ? `<p class="memo-preview">📝 ${esc(u.memo)}</p>` : ""}
      ${u.by && !active && (u.memo || u.status) ? `<p class="by">✎ ${esc(u.by)}</p>` : ""}
      ${active ? editorHtml(v, u) : ""}
    </li>`;
  }

  function bookRowsHtml(v) {
    const rows = rawBookRows(v);
    return `<div class="bk" data-bk>
      <div class="row-label">예약 가능 월 <button type="button" class="bk-add" data-bk-add>＋ 추가</button></div>
      ${rows.length ? rows.map((r, i) => `<div class="bk-row" data-bk-row="${i}">
        <input type="month" data-bk-k="month" value="${esc(r.month)}" />
        <div class="seg bk-season">
          <button type="button" class="${r.season === "off" ? "" : "on"}" data-bk-k="season" data-bk-v="peak">성수기</button>
          <button type="button" class="${r.season === "off" ? "on" : ""}" data-bk-k="season" data-bk-v="off">비수기</button>
        </div>
        <span class="bk-meal"><input data-bk-k="meal" inputmode="decimal" placeholder="식대" value="${esc(r.meal)}" />만</span>
        <button type="button" class="bk-del" data-bk-del>✕</button>
      </div>`).join("") : `<p class="hint">업체에 전화로 확인한 예약 가능 월·성수기 여부·식대를 적어두면, 위쪽 필터로 그 달까지 가능한 곳만 걸러볼 수 있어요.</p>`}
    </div>`;
  }

  function editorHtml(v, u) {
    const ph = (a) => rangeText(a) || "-";
    return `<div class="editor" data-editor>
      <div class="status-row">
        ${Object.entries(STATUSES).map(([k, s]) =>
          `<button class="sbtn ${u.status === k ? "on" : ""}" data-status="${k}" style="--c:${s.color}">${s.emoji} ${s.label}</button>`).join("")}
      </div>
      <div class="fields">
        <label>식대 (1인)<span><input data-field="meal" placeholder="${ph(v.meal || v.mealOff)}" value="${esc(u.meal)}" />만원</span></label>
        <label>대관료<span><input data-field="rent" placeholder="${ph(v.rent)}" value="${esc(u.rent)}" />만원</span></label>
        <label>보증인원<span><input data-field="guests" inputmode="numeric" placeholder="${v.guar ?? "-"}" value="${esc(u.guests)}" />명</span></label>
        <label>꽃값 (포함이면 0)<span><input data-field="flower" inputmode="decimal" placeholder="?" value="${esc(u.flower)}" />만원</span></label>
        <label>주차<span><input data-field="parking" inputmode="numeric" placeholder="?" value="${esc(u.parking)}" />대</span></label>
        <label>전화번호<span><input data-field="phone" type="tel" placeholder="02-1234-5678" value="${esc(u.phone)}" /></span></label>
      </div>
      <p class="hint">회색 글씨 = 원래 데이터. 고치면 같이 보는 사람한테도 반영되고, 지우면 원래 값으로 돌아가요. 범위는 <b>9.5~11</b>처럼.${v.mealOff ? ` 참가격 공시 식대 ${range({ lo: v.mealOff[0], hi: v.mealOff[1] })}.` : ""}</p>
      ${bookRowsHtml(v)}
      <div class="photos">
        ${photos.of(v).map((p) => `<img class="ph" data-photo="${p.id}" src="${p.thumb}" alt="" />`).join("")}
        <label class="ph-add">＋ 사진<input type="file" accept="image/*" multiple hidden data-photo-input /></label>
      </div>
      <textarea data-field="memo" rows="3" placeholder="메모 (투어 날짜, 주차, 밥맛, 홀 분위기…)">${esc(u.memo)}</textarea>
      ${u.by ? `<p class="hint">마지막 수정: ${esc(u.by)}</p>` : ""}
      ${linksHtml(v)}
    </div>`;
  }

  const LIST_LIMIT = 150;
  let listLimit = LIST_LIMIT;

  function render() {
    const arr = filtered();
    els.count.textContent = arr.length;
    updateChecked();
    const shown = arr.slice(0, listLimit);
    if (state.activeId != null && !shown.some((v) => v.id === state.activeId)) {
      const a = arr.find((v) => v.id === state.activeId); if (a) shown.unshift(a);
    }
    els.list.innerHTML = arr.length
      ? shown.map(itemHtml).join("") + (arr.length > shown.length ? `<li class="more-items"><button id="moreItems">${arr.length - shown.length}곳 더 보기</button></li>` : "")
      : `<li class="empty">조건에 맞는 웨딩홀이 없어요</li>`;
    if (map) {
      const ids = new Set(arr.map((v) => v.id));
      VENUES.forEach((v) => map.setVisible(v.id, ids.has(v.id)));
    }
    renderStatusChips();
  }

  function rerenderItem(id) {
    const el = els.list.querySelector(`.item[data-id="${id}"]`);
    if (!el) return false;
    const v = state.me ? { ...VENUES[id], _d: km(state.me, VENUES[id]) } : VENUES[id];
    el.outerHTML = itemHtml(v);
    return true;
  }

  // 입력 중에도 카드 위쪽 숫자(식대·대관·보증·총액)는 바로 갱신
  function refreshMeta(id) {
    const el = els.list.querySelector(`.item[data-id="${id}"]`); if (!el) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = itemHtml(state.me ? { ...VENUES[id], _d: km(state.me, VENUES[id]) } : VENUES[id]);
    const fresh = tmp.firstElementChild;
    el.querySelectorAll(":scope > .meta, :scope > .total").forEach((n) => n.remove());
    const anchor = el.querySelector(":scope > .item-top");
    [...fresh.querySelectorAll(":scope > .meta, :scope > .total")].reverse().forEach((n) => anchor.after(n));
  }

  function select(id, { pan = true } = {}) {
    const prev = state.activeId;
    state.activeId = id;
    if (prev != null && prev !== id) rerenderItem(prev);
    if (!rerenderItem(id)) render();
    if (map) map.open(VENUES[id], pan);
    const el = els.list.querySelector(`.item[data-id="${id}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const updateChecked = () => {
    els.checked.textContent = Object.values(store.all()).filter((u) => u.status && u.status !== "nope").length;
  };

  function afterEdit(v, { full = false } = {}) {
    if (map) map.refresh(v);
    updateChecked();
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

  function updateRangeLabels() {
    els.priceVal.textContent = state.priceMax >= MAX.price ? "전체" : `${state.priceMax}만원 이하`;
    els.rentVal.textContent = state.rentMax >= MAX.rent ? "전체" : `${state.rentMax}만원 이하`;
    els.guestVal.textContent = state.guests ? `${state.guests}명 이상 수용` : "전체";
    els.parkVal.textContent = state.parkMin ? `${state.parkMin}대 이상 (입력한 곳만)` : "전체";
    els.bookableVal.textContent = state.bookableMax ? `${state.bookableMax}까지 가능한 곳만` : "전체";
  }

  const refit = () => { listLimit = LIST_LIMIT; render(); map && map.fit(filtered()); };

  function buildControls() {
    els.regionSeg.innerHTML = [`<button class="on" data-region="all">전체</button>`, ...REGIONS.map((r) => `<button data-region="${r}">${r}</button>`)].join("");

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
      refit();
    });

    els.statusChips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const k = b.dataset.status;
      state.statuses.has(k) ? state.statuses.delete(k) : state.statuses.add(k);
      refit();
    });

    els.regionSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.region = b.dataset.region;
      els.regionSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      refit();
    });

    els.moreToggle.addEventListener("click", () => {
      els.more.hidden = !els.more.hidden;
      els.moreToggle.classList.toggle("open", !els.more.hidden);
    });

    let rt;
    const onRange = () => {
      state.priceMax = parseFloat(els.price.value);
      state.rentMax = parseFloat(els.rent.value);
      state.guests = parseInt(els.guests.value, 10);
      state.parkMin = parseInt(els.park.value, 10);
      updateRangeLabels();
      clearTimeout(rt); rt = setTimeout(() => { listLimit = LIST_LIMIT; render(); }, 80);
    };
    [els.price, els.rent, els.guests, els.park].forEach((el) => el.addEventListener("input", onRange));
    els.onlyMine.addEventListener("change", () => { state.onlyMine = els.onlyMine.checked; refit(); });
    els.onlyBookable.addEventListener("change", () => { state.onlyBookable = els.onlyBookable.checked; refit(); });

    els.bookableFilter.addEventListener("change", () => {
      state.bookableMax = els.bookableFilter.value;
      updateRangeLabels();
      listLimit = LIST_LIMIT; render();
    });
    els.bookableFilterClear.addEventListener("click", () => {
      els.bookableFilter.value = ""; state.bookableMax = "";
      updateRangeLabels();
      listLimit = LIST_LIMIT; render();
    });

    els.sortSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const sort = b.dataset.sort;
      const apply = () => {
        state.sort = sort;
        els.sortSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        listLimit = LIST_LIMIT; render();
      };
      if (sort === "near" && !state.me) locate(apply); else apply();
    });

    let t;
    els.q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = els.q.value.trim(); refit(); }, 200);
    });

    els.list.addEventListener("click", (e) => {
      if (e.target.closest("#moreItems")) { listLimit += LIST_LIMIT * 2; render(); return; }
      const li = e.target.closest(".item"); if (!li) return;
      const id = +li.dataset.id, v = VENUES[id];
      const sb = e.target.closest(".sbtn");
      if (sb) {
        const k = sb.dataset.status;
        store.set(v, { status: store.get(v).status === k ? "" : k });
        afterEdit(v, { full: true });
        return;
      }
      const ph = e.target.closest("[data-photo]");
      if (ph) { openPhoto(v, ph.dataset.photo); return; }
      if (e.target.closest("[data-bk-add]")) {
        const rows = rawBookRows(v).slice();
        rows.push({ month: "", season: "peak", meal: "" });
        store.set(v, { bookables: rows });
        afterEdit(v, { full: true });
        return;
      }
      const bkDel = e.target.closest("[data-bk-del]");
      if (bkDel) {
        const idx = +bkDel.closest("[data-bk-row]").dataset.bkRow;
        const rows = rawBookRows(v).slice();
        rows.splice(idx, 1);
        store.set(v, { bookables: rows.length ? rows : null });
        afterEdit(v, { full: true });
        return;
      }
      const bkSeason = e.target.closest('[data-bk-k="season"]');
      if (bkSeason) {
        const idx = +bkSeason.closest("[data-bk-row]").dataset.bkRow;
        const rows = rawBookRows(v).slice();
        rows[idx] = { ...rows[idx], season: bkSeason.dataset.bkV };
        store.set(v, { bookables: rows });
        afterEdit(v, { full: true });
        return;
      }
      if (e.target.closest("[data-editor]")) return;
      if (state.activeId === id) { state.activeId = null; rerenderItem(id); return; }
      select(id);
    });

    els.list.addEventListener("change", (e) => {
      if (!e.target.matches("[data-photo-input]")) return;
      const id = +e.target.closest(".item").dataset.id;
      uploadPhotos(VENUES[id], e.target.files).finally(() => { e.target.value = ""; });
    });

    const saveT = {};
    els.list.addEventListener("input", (e) => {
      const f = e.target.dataset.field;
      if (f) {
        const id = +e.target.closest(".item").dataset.id, v = VENUES[id], key = id + ":" + f, val = e.target.value.trim();
        clearTimeout(saveT[key]);
        saveT[key] = setTimeout(() => { store.set(v, { [f]: val }); afterEdit(v); refreshMeta(id); }, 300);
        return;
      }
      const bk = e.target.dataset.bkK;
      if (bk === "month" || bk === "meal") {
        const id = +e.target.closest(".item").dataset.id, v = VENUES[id];
        const idx = +e.target.closest("[data-bk-row]").dataset.bkRow;
        const key = id + ":bk:" + idx + ":" + bk, val = e.target.value.trim();
        clearTimeout(saveT[key]);
        saveT[key] = setTimeout(() => {
          const rows = rawBookRows(v).slice();
          rows[idx] = { ...rows[idx], [bk]: val };
          store.set(v, { bookables: rows });
          afterEdit(v);
          refreshMeta(id);
        }, 300);
      }
    });

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
        store.replace(data, merge);
        VENUES.forEach((v) => map && map.refresh(v));
        render(); showBadge("가져오기 완료");
      } catch { alert("올바른 백업 파일이 아니에요."); }
      els.importFile.value = "";
    });

    const order = ["collapsed", "", "expanded"];
    els.handle.addEventListener("click", () => {
      const cur = els.panel.classList.contains("expanded") ? "expanded" : els.panel.classList.contains("collapsed") ? "collapsed" : "";
      setSheet(order[(order.indexOf(cur) + 1) % order.length]);
    });

    updateRangeLabels();
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
    const color = TYPES[v.type].color, st = store.get(v).status, s = STATUSES[st];
    const inner = s
      ? `<circle cx="15" cy="15" r="9" fill="#fff"/><text x="15" y="19.5" font-size="12" text-anchor="middle" fill="${s.color}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${s.emoji}</text>`
      : `<circle cx="15" cy="15" r="5" fill="#fff"/>`;
    const big = s && st !== "nope";
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-12.6 13-23A13 13 0 0 0 2 16c0 10.4 13 23 13 23z" fill="${color}" stroke="#fff" stroke-width="2" ${v.approx ? 'stroke-dasharray="3 2"' : ""}/>${inner}</svg>`,
      scale: big ? 1.2 : 0.85, opacity: st === "nope" ? 0.4 : 1, z: big ? 10 : 1
    };
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
      const mk = new g.Marker({ position: { lat: v.lat, lng: v.lng }, map: m, title: v.name, icon: icon(v), opacity: p.opacity, zIndex: p.z, optimized: true });
      mk.addListener("click", () => { select(v.id, { pan: false }); if (window.innerWidth <= 768) setSheet(""); });
      markers[v.id] = mk;
    });
    iw.addListener("closeclick", () => { openId = null; });

    return {
      kind: "google",
      setVisible: (id, on) => { const mk = markers[id]; if ((mk.getMap() != null) !== on) mk.setMap(on ? m : null); },
      refresh: (v) => {
        const p = pinSvg(v), mk = markers[v.id];
        mk.setIcon(icon(v)); mk.setOpacity(p.opacity); mk.setZIndex(p.z);
        if (openId === v.id) iw.setContent(infoHtml(v));
      },
      move: (v) => { markers[v.id].setPosition({ lat: v.lat, lng: v.lng }); },
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
    const m = L.map("map", { preferCanvas: true }).setView([CENTER.lat, CENTER.lng], 10);
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
      kind: "leaflet",
      setVisible: (id, on) => { const mk = markers[id]; if (m.hasLayer(mk) !== on) on ? mk.addTo(m) : mk.remove(); },
      refresh: (v) => {
        const p = pinSvg(v), mk = markers[v.id];
        mk.setIcon(icon(v)); mk.setOpacity(p.opacity); mk.setZIndexOffset(p.z * 100);
        if (mk.isPopupOpen()) mk.setPopupContent(infoHtml(v));
      },
      move: (v) => { markers[v.id].setLatLng([v.lat, v.lng]); },
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

  // ── 위치 보정: 캐시 적용 → (구글지도일 때) 장소검색으로 나머지 보정 ──
  function applyGeo(v, g) {
    if (!g || typeof g.lat !== "number" || typeof g.lng !== "number") return false;
    if (km({ lat: v._lat0, lng: v._lng0 }, g) > 30) return false;
    v.lat = g.lat; v.lng = g.lng; v.approx = false;
    if (g.addr) v.addr = g.addr;
    if (map) map.move(v);
    return true;
  }

  async function refineLocations() {
    const cache = await geo.all();
    VENUES.forEach((v) => { if (cache[v.name]) applyGeo(v, cache[v.name]); });
    if (!map || map.kind !== "google" || !CFG.AUTO_GEOCODE) return;

    const todo = VENUES.filter((v) => v.approx && !cache[v.name]);
    if (!todo.length) return;
    let Place;
    try { ({ Place } = await google.maps.importLibrary("places")); } catch (e) { console.warn(e); return; }

    let done = 0, ok = 0;
    for (const v of todo) {
      try {
        const { places } = await Place.searchByText({
          textQuery: `${v.name.replace(/\(.*?\)|_.*$/g, " ").trim()} ${regionWord(v)} ${v.area}`,
          fields: ["location", "formattedAddress"],
          locationBias: { center: { lat: v._lat0, lng: v._lng0 }, radius: 20000 },
          maxResultCount: 1, language: "ko", region: "kr"
        });
        const p = places && places[0];
        if (p && p.location) {
          const g = { lat: +p.location.lat().toFixed(6), lng: +p.location.lng().toFixed(6), addr: (p.formattedAddress || "").replace(/^대한민국\s*/, "").slice(0, 200) };
          if (applyGeo(v, g)) { geo.set(v.name, g); ok++; }
        }
      } catch (e) {
        console.warn("장소검색 실패", v.name, e);
        if (String(e).match(/PERMISSION|not authorized|API_NOT|ApiNotActivated|REQUEST_DENIED/i) || done === 0) {
          showBadge("정확한 위치 보정은 'Places API (New)' 사용 설정이 필요해요");
          return;
        }
      }
      done++;
      if (done % 10 === 0 || done === todo.length) showBadge(`웨딩홀 위치 보정 중… ${done}/${todo.length}`);
      await new Promise((r) => setTimeout(r, 120));
    }
    showBadge(`위치 보정 완료 (${ok}곳)`);
    render();
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

  let fbReady = Promise.resolve();

  async function onMapReady() {
    render(); map.fit(filtered());
    await fbReady.catch(() => {});
    refineLocations();
  }

  async function bootLeaflet(reason) {
    loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    try { await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"); }
    catch { showBadge("지도를 불러오지 못했어요 (네트워크 확인)"); return; }
    map = leafletAdapter();
    if (reason) showBadge(reason);
    onMapReady();
  }

  function bootGoogle() {
    window.__initGoogle = () => { map = googleAdapter(); onMapReady(); };
    window.gm_authFailure = () => { document.getElementById("map").innerHTML = ""; map = null; bootLeaflet("구글지도 키 인증 실패 → 기본 지도로 표시 중"); };
    loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&callback=__initGoogle&language=ko&region=KR&loading=async`)
      .catch(() => bootLeaflet("구글지도 로드 실패 → 기본 지도로 표시 중"));
  }

  // ── 실시간 공유 (Firebase) ──────────────
  function getRoom() {
    const m = location.hash.match(/r=([A-Za-z0-9_-]{16,64})/);
    let room = m && m[1];
    try {
      if (room) localStorage.setItem(STORE_KEY + ":room", room);
      else room = localStorage.getItem(STORE_KEY + ":room");
    } catch {}
    if (!room) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      room = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      try { localStorage.setItem(STORE_KEY + ":room", room); } catch {}
    }
    if (!m) history.replaceState(null, "", `${location.pathname}${location.search}#r=${room}`);
    return room;
  }

  async function connectFirebase(cfg) {
    const V = "10.12.2";
    const [{ initializeApp }, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    const db = fs.getFirestore(initializeApp(cfg));
    const room = getRoom();
    const col = fs.collection(db, "rooms", room, "venues");
    const ref = (name) => fs.doc(col, encodeURIComponent(name));
    const onErr = (e) => { console.error(e); showBadge("저장 실패 — Firebase 설정/규칙을 확인해 주세요"); };

    geo.backend = {
      async all() {
        const snap = await fs.getDocs(fs.collection(db, "geo"));
        const out = {}; snap.forEach((d) => { out[decodeURIComponent(d.id)] = d.data(); }); return out;
      },
      set(name, val) { fs.setDoc(fs.doc(db, "geo", encodeURIComponent(name)), val).catch((e) => console.warn("geo 저장 실패", e)); }
    };

    const metaCol = fs.collection(db, "rooms", room, "photoMeta");
    const dataCol = fs.collection(db, "rooms", room, "photoData");
    photos.backend = {
      async add(venue, thumb, full) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await fs.setDoc(fs.doc(dataCol, id), { data: full });
        await fs.setDoc(fs.doc(metaCol, id), { venue, thumb, by: me.name, createdAt: fs.serverTimestamp() });
      },
      async remove(id) {
        await fs.deleteDoc(fs.doc(metaCol, id));
        await fs.deleteDoc(fs.doc(dataCol, id)).catch(() => {});
      },
      async getFull(id) { const d = await fs.getDoc(fs.doc(dataCol, id)); return d.exists() ? d.data().data : null; }
    };
    fs.onSnapshot(metaCol, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const x = d.data();
        list.push({ id: d.id, venue: x.venue, thumb: x.thumb, by: x.by, t: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now() });
      });
      photos.set(list);
    }, (e) => console.warn("photo snapshot", e));

    // 접속자 표시: 30초마다 하트비트, 75초 넘게 소식 없으면 나간 걸로 봄
    const presCol = fs.collection(db, "rooms", room, "presence");
    const beat = () => fs.setDoc(fs.doc(presCol, me.id), { name: me.name, lastSeen: fs.serverTimestamp() }).catch((e) => console.warn(e));
    presence.beat = beat;
    beat(); setInterval(beat, 30000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") beat(); });
    window.addEventListener("pagehide", () => { fs.deleteDoc(fs.doc(presCol, me.id)).catch(() => {}); });
    fs.onSnapshot(presCol, (snap) => {
      presence.people = [];
      snap.forEach((d) => {
        const x = d.data();
        const t = x.lastSeen && x.lastSeen.toMillis ? x.lastSeen.toMillis() : Date.now();
        presence.people.push({ id: d.id, name: x.name || "게스트", t });
      });
      renderPresence();
    });
    setInterval(renderPresence, 15000);

    store.attach({
      write(name, patch) {
        const body = { updatedAt: fs.serverTimestamp(), updatedBy: me.name };
        Object.entries(patch).forEach(([k, val]) => { body[k] = (val === "" || val == null) ? fs.deleteField() : val; });
        fs.setDoc(ref(name), body, { merge: true }).catch(onErr);
      },
      remove(name) { fs.deleteDoc(ref(name)).catch(onErr); },
      subscribe(cb) {
        fs.onSnapshot(col, (snap) => {
          const next = {};
          snap.forEach((d) => {
            const x = { ...d.data() };
            const by = x.updatedBy; delete x.updatedAt; delete x.updatedBy;
            if (Object.keys(x).length) next[decodeURIComponent(d.id)] = by ? { ...x, by } : x;
          });
          cb(next);
        }, onErr);
      }
    });
  }

  let pendingRender = false;
  const editing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest("[data-editor]")); };
  store.onChange(() => {
    if (map) VENUES.forEach((v) => map.refresh(v));
    updateChecked();
    if (editing()) { pendingRender = true; return; }
    render();
  });
  photos.listeners.push(() => {
    if (state.activeId != null && map) map.refresh(VENUES[state.activeId]);
    if (editing()) { pendingRender = true; return; }
    render();
  });
  els.list.addEventListener("focusout", () => {
    if (!pendingRender) return;
    setTimeout(() => { if (!editing()) { pendingRender = false; render(); } }, 250);
  });

  // ── 나 / 접속자 ─────────────────────────
  const me = (() => {
    let id, name;
    try { id = localStorage.getItem(STORE_KEY + ":cid"); name = localStorage.getItem(STORE_KEY + ":name"); } catch {}
    if (!id) { id = Math.random().toString(36).slice(2, 12); try { localStorage.setItem(STORE_KEY + ":cid", id); } catch {} }
    return { id, name: name || "게스트-" + id.slice(0, 3), named: !!name };
  })();
  const presence = { people: [], beat: null };

  function renderPresence() {
    const el = $("#presence");
    if (!store.isShared()) { el.hidden = true; return; }
    const now = Date.now();
    const active = presence.people.filter((p) => now - p.t < 75000 || p.id === me.id);
    if (!active.some((p) => p.id === me.id)) active.push({ id: me.id, name: me.name });
    active.sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name)));
    $("#syncState").textContent = `🟢 ${active.length}명 보는 중`;
    el.hidden = false;
    el.innerHTML = active.map((p) => p.id === me.id
      ? `<button class="who me" id="renameBtn" title="눌러서 이름 바꾸기">${esc(p.name)} (나) ✎</button>`
      : `<span class="who">${esc(p.name)}</span>`).join("");
  }

  function rename() {
    const n = (prompt("같이 보는 사람한테 보일 이름", me.named ? me.name : "") || "").trim().slice(0, 20);
    if (!n) return;
    me.name = n; me.named = true;
    try { localStorage.setItem(STORE_KEY + ":name", n); } catch {}
    presence.beat && presence.beat();
    renderPresence();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#renameBtn")) rename(); });

  function setSyncUI() {
    const shared = store.isShared();
    $("#syncState").textContent = shared ? "🟢 함께 보는 중" : "이 기기에만 저장";
    $("#shareBtn").hidden = !shared;
    renderPresence();
    if (shared && !me.named) setTimeout(() => showBadge("위쪽 내 이름을 눌러서 이름을 정해 주세요 ✎"), 1500);
  }
  $("#shareBtn").addEventListener("click", async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); showBadge("링크 복사됨 — 이 링크를 가진 사람은 같이 보고 수정할 수 있어요"); }
    catch { prompt("이 링크를 공유하세요", url); }
  });

  buildControls();
  render();
  setSyncUI();
  if (FB && FB.apiKey && FB.projectId) {
    fbReady = connectFirebase(FB).then(setSyncUI).catch((e) => { console.error(e); showBadge("공유 저장소 연결 실패 — 이 기기에만 저장돼요"); });
  }
  if (KEY) bootGoogle();
  else bootLeaflet("config.js에 구글지도 API 키를 넣으면 구글지도로 바뀌어요");
})();
