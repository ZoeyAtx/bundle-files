/* Universal Shoptet bundle engine v6.2 — configure products and boxes in HTML only. */
(() => {
  'use strict';
  if (window.__zbBundleV6) return;
  window.__zbBundleV6 = true;

  const D = document;
  const $ = (s, root = D) => root.querySelector(s);
  const $$ = (s, root = D) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, fallback = 0) => v === '' || v == null ? fallback : Number(v);
  const split = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const KEY = 'zbBundlesV6';
  const OWN_KEY = 'zbBundlesV6OwnNote';
  const BEGIN = '--- DÁRKOVÉ BALÍČKY ---';
  const END = '--- KONEC DÁRKOVÝCH BALÍČKŮ ---';
  const DEBUG = false; // Set true for storefront diagnostics.
  const log = (...args) => { if (DEBUG) console.log('[ZB v6.2]', ...args); };
  const dl = k => { try { return typeof getShoptetDataLayer === 'function' ? getShoptetDataLayer(k) : null; } catch { return null; } };
  const api = () => window.shoptet?.cartShared;
  const getRecords = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(r => r && r.id && Array.isArray(r.items) && r.box?.code) : []; } catch { return []; } };
  const saveRecords = a => localStorage.setItem(KEY, JSON.stringify(a));
  const clearRecords = () => { localStorage.removeItem(KEY); localStorage.removeItem(OWN_KEY); };
  const money = (n, currency = 'CZK', locale = 'cs-CZ') => {
    if (!Number.isFinite(n)) return 'Cena nedostupná';
    try { return new Intl.NumberFormat(locale, {style:'currency', currency, maximumFractionDigits:2}).format(n); }
    catch { return `${n.toLocaleString('cs-CZ')} ${currency}`; }
  };
  const qty = x => Math.max(0, num(x?.quantity ?? x?.amount, 0));
  const code = x => String(x?.code ?? x?.sku ?? '');
  const sumBy = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const configuredUrl = url => {
    if (!url || /PLACEHOLDER|TODO|BOX_URL|DOPLNIT/i.test(url)) return false;
    try { const u = new URL(url, location.href); return u.origin === location.origin && /^https?:$/.test(u.protocol); }
    catch { return false; }
  };
  const stripAccents = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priceFromText = s => {
    const text = String(s || '').replace(/\u00a0/g, ' ').trim();
    // Read one price only: a cart cell can contain both an old and a new price.
    const match = text.match(/-?\d[\d .,]*/);
    if (!match) return null;
    const value = match[0].replace(/\s/g, '');
    const comma = value.lastIndexOf(','), dot = value.lastIndexOf('.');
    const normalized = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };
  const partList = r => [{code:r.box.code, name:r.box.name, q:1, price:r.box.price}, ...r.items];
  const groupedParts = r => {
    const map = new Map();
    for (const p of partList(r)) {
      const old = map.get(p.code);
      if (old) old.q += p.q;
      else map.set(p.code, {...p});
    }
    return [...map.values()];
  };
  const needs = records => {
    const map = new Map();
    for (const r of records) for (const p of groupedParts(r)) map.set(p.code, (map.get(p.code) || 0) + p.q);
    return map;
  };

  // Shoptet data layer is authoritative for cart quantities; cart HTML is a fallback.
  function cartLines() {
    const data = dl('cart');
    if (Array.isArray(data)) return data.map(x => ({
      code:code(x), q:qty(x), itemId:x.itemId ?? x.item_id ?? null,
      priceId:x.priceId ?? x.price_id ?? null,
      unitPrice:Number.isFinite(Number(x.priceWithVat)) ? Number(x.priceWithVat) : null
    })).filter(x => x.code);
    return $$('.removeable[data-micro-sku]').map(row => ({
      code:row.dataset.microSku, q:num($('input.amount[name="amount"]', row)?.value, 0),
      itemId:$('input[name="itemId"]', row)?.value || null,
      priceId:$('input[name="priceId"]', row)?.value || null,
      unitPrice:priceFromText($('.p-price', row)?.textContent)
    }));
  }
  const cartCount = c => sumBy(cartLines().filter(x => x.code === c), x => x.q);
  const hasCartData = () => Array.isArray(dl('cart')) || !!$('.removeable[data-micro-sku]');
  const readIdsFromDom = (c, line) => {
    const row = $$('.removeable[data-micro-sku]').find(x => x.dataset.microSku === c);
    return {
      itemId:line.itemId || (row ? $('input[name="itemId"]', row)?.value : null) || null,
      priceId:line.priceId || (row ? $('input[name="priceId"]', row)?.value : null) || null
    };
  };
  async function waitForCount(c, expected, timeout = 8500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (hasCartData() && cartCount(c) === expected) return;
      await sleep(170);
    }
    throw new Error(`Cart did not confirm ${c}: expected ${expected}, got ${cartCount(c)}`);
  }
  async function addCart(c, amount) {
    if (!api()?.addToCart) throw new Error('Shoptet addToCart is unavailable');
    const before = cartCount(c);
    api().addToCart({productCode:c, amount}, true);
    await waitForCount(c, before + amount);
  }
  async function subtractCart(c, amount) {
    if (amount <= 0) return;
    const before = cartCount(c);
    if (before < amount) throw new Error(`Insufficient quantity in cart: ${c}`);
    const lines = cartLines().filter(x => x.code === c && x.q > 0);
    let remaining = amount;
    for (const line of lines) {
      if (!remaining) break;
      const take = Math.min(line.q, remaining);
      const ids = readIdsFromDom(c, line);
      if (!ids.itemId) throw new Error(`Missing Shoptet itemId for ${c}`);
      const next = line.q - take;
      if (next === 0) {
        if (!api()?.removeFromCart) throw new Error('Shoptet removeFromCart is unavailable');
        api().removeFromCart({itemId:ids.itemId});
      } else {
        if (!ids.priceId || !api()?.updateQuantityInCart) throw new Error(`Missing Shoptet quantity update capability for ${c}`);
        api().updateQuantityInCart({itemId:ids.itemId, priceId:ids.priceId, amount:next});
      }
      remaining -= take;
      await waitForCount(c, before - (amount - remaining));
    }
    if (remaining) throw new Error(`Could not subtract full quantity for ${c}`);
  }
  async function rollbackTo(snapshot) {
    let complete = true;
    for (const [c, original] of snapshot) {
      const extra = cartCount(c) - original;
      if (extra > 0) {
        try { await subtractCart(c, extra); }
        catch (e) { console.error('[ZB] Rollback failed', c, e); complete = false; }
      }
    }
    return complete;
  }
  function reconcileRecords() {
    let records = getRecords();
    if (!hasCartData()) return records;
    const actual = new Map(cartLines().map(x => [x.code, cartCount(x.code)]));
    const valid = [];
    const used = new Map();
    for (const r of records) {
      const parts = groupedParts(r);
      const fits = parts.every(p => (used.get(p.code) || 0) + p.q <= (actual.get(p.code) || 0));
      if (fits) {
        valid.push(r);
        parts.forEach(p => used.set(p.code, (used.get(p.code) || 0) + p.q));
      } else log('Untracked incomplete bundle', r.id);
    }
    if (valid.length !== records.length) { saveRecords(valid); records = valid; }
    return records;
  }

  // Order note: preserve customer text outside the generated section.
  function noteRegex() {
    return /(?:\n\s*)?--- DÁRKOVÉ BALÍČKY ---[\s\S]*?--- KONEC DÁRKOVÝCH BALÍČKŮ ---(?:\s*\n)?/g;
  }
  function noteText(records) {
    return records.map((r, i) => `Balíček ${i+1}: ${r.type}\nKrabice: ${r.box.name} [${r.box.code}] (${r.size}/${r.box.capacity})\n${r.items.map(x => `${x.q}× ${x.name} [${x.code}]`).join('\n')}`).join('\n\n');
  }
  function syncNote() {
    const t = $('#remark');
    if (!t) return;
    const records = reconcileRecords();
    const found = t.value.includes(BEGIN) && t.value.includes(END);
    let own;
    if (found) {
      own = t.value.replace(noteRegex(), '\n').trim();
      localStorage.setItem(OWN_KEY, own);
    } else if (records.length) {
      // When markers have been deleted, the previous independent customer text is safer
      // than treating damaged generated content as a new customer note.
      const saved = localStorage.getItem(OWN_KEY);
      own = saved !== null ? saved : t.value.trim();
      localStorage.setItem(OWN_KEY, own);
    } else {
      own = t.value.trim();
    }
    const generated = records.length ? `${BEGIN}\n${noteText(records)}\n${END}` : '';
    const result = [own, generated].filter(Boolean).join('\n\n');
    if (t.value !== result) {
      t.value = result;
      t.dispatchEvent(new Event('input', {bubbles:true}));
      t.dispatchEvent(new Event('change', {bubbles:true}));
    }
    const ch = $('#add-note');
    if (records.length && ch && !ch.checked) ch.click();
    if (!records.length) localStorage.removeItem(OWN_KEY);
  }
  function initNote() {
    if (dl('pageType') === 'thankYou' || /\/dekujeme\/?(?:\?|$)/i.test(location.pathname)) { clearRecords(); return; }
    if (hasCartData() && cartLines().length === 0) clearRecords();
    syncNote();
    D.addEventListener('submit', e => { if (e.target?.closest?.('#order-form, form')) syncNote(); }, true);
    D.addEventListener('focusout', e => { if (e.target?.matches?.('#remark')) syncNote(); }, true);
    D.addEventListener('change', e => { if (e.target?.matches?.('#add-note')) queueMicrotask(syncNote); }, true);
  }

  // Cart/checkout presentation: underlying Shoptet rows and totals remain untouched.
  function actualPrice(c, domRow, line, fallback) {
    const raw = domRow && (
      $('.p-price .price-final, .p-price .price', domRow)?.textContent ||
      $('.p-price', domRow)?.textContent ||
      $('.p-total', domRow)?.textContent ||
      $('.cart-item-price', domRow)?.textContent
    );
    const fromDom = priceFromText(raw);
    if (fromDom !== null) {
      const isTotal = !$('.p-price', domRow) && !!($('.p-total', domRow) || $('.cart-item-price', domRow));
      return isTotal && line?.q ? fromDom / line.q : fromDom;
    }
    return Number.isFinite(line?.unitPrice) ? line.unitPrice : fallback;
  }
  const listHtml = r => partList(r).map(p => `<li>${p.q}× ${esc(p.name)}</li>`).join('');
  function makeMainRow(r, total) {
    const tr = D.createElement('tr');
    tr.className = 'zb-virtual zb-cart-bundle';
    tr.innerHTML = `<td class="cart-p-image"></td><td class="p-name"><strong>Balíček: ${esc(r.type)}</strong><ul>${listHtml(r)}</ul></td><td class="p-availability">Balíček</td><td class="p-quantity">1 balíček</td><td class="p-price"></td><td class="p-total"><strong>${money(total,r.currency,r.locale)}</strong><button type="button" class="zb-remove" data-zb-remove="${esc(r.id)}">Odebrat balíček</button></td>`;
    return tr;
  }
  function makeMainExtra(c, name, amount, unit, currency, locale) {
    const tr = D.createElement('tr');
    tr.className = 'zb-virtual zb-cart-extra';
    tr.innerHTML = `<td class="cart-p-image"></td><td class="p-name"><strong>${esc(name)}</strong><small>Samostatně mimo balíčky</small></td><td class="p-availability"></td><td class="p-quantity"><button type="button" data-zb-extra="${esc(c)}" data-change="-1" aria-label="Snížit množství">−</button> ${amount} ks <button type="button" data-zb-extra="${esc(c)}" data-change="1" aria-label="Zvýšit množství">+</button></td><td class="p-price">${money(unit,currency,locale)}</td><td class="p-total">${money(unit*amount,currency,locale)}</td>`;
    return tr;
  }
  function makeRecapRow(r, total) {
    const div = D.createElement('div');
    div.className = 'cart-item zb-virtual zb-recap-bundle';
    const canRemove = groupedParts(r).every(p => cartLines().some(line => line.code === p.code && !!readIdsFromDom(p.code, line).itemId));
    div.innerHTML = `<div class="cart-item-name"><strong>Balíček: ${esc(r.type)}</strong><ul>${listHtml(r)}</ul></div><div class="cart-item-amount">1×</div><div class="cart-item-price">${money(total,r.currency,r.locale)}</div>${canRemove ? `<button type="button" class="zb-remove" data-zb-remove="${esc(r.id)}">Odebrat</button>` : '<a class="zb-edit-link" href="/kosik/">Upravit v košíku</a>'}`;
    return div;
  }
  function makeRecapExtra(name, amount, total, currency, locale) {
    const div = D.createElement('div');
    div.className = 'cart-item zb-virtual zb-recap-extra';
    div.innerHTML = `<div class="cart-item-name">${esc(name)} <small>(samostatně)</small></div><div class="cart-item-amount">${amount}×</div><div class="cart-item-price">${money(total,currency,locale)}</div>`;
    return div;
  }
  function renderGroupContainer(rows, records, isMain) {
    if (!rows.length || !records.length) return;
    const byCode = new Map();
    for (const row of rows) {
      const c = row.dataset.microSku;
      if (!byCode.has(c)) byCode.set(c, row);
    }
    const needed = needs(records);
    if ([...needed.keys()].some(c => !byCode.has(c))) return; // don't hide partial order summaries
    const lines = cartLines();
    const counts = new Map(lines.map(x => [x.code, cartCount(x.code)]));
    const units = new Map();
    for (const [c, row] of byCode) {
      const line = lines.find(x => x.code === c);
      const rec = records.find(r => partList(r).some(p => p.code === c));
      const fallback = rec ? partList(rec).find(p => p.code === c)?.price ?? null : null;
      units.set(c, actualPrice(c, row, line, fallback));
    }
    const anchor = rows[0];
    for (const r of records) {
      const total = sumBy(partList(r), p => (units.get(p.code) ?? p.price ?? 0) * p.q);
      anchor.before(isMain ? makeMainRow(r,total) : makeRecapRow(r,total));
    }
    for (const [c, bundled] of needed) {
      const remaining = (counts.get(c) || 0) - bundled;
      if (remaining > 0) {
        const row = byCode.get(c);
        const name = $('.p-name', row)?.textContent.trim() || $('.cart-item-name', row)?.textContent.trim() || c;
        const unit = units.get(c) ?? 0;
        const base = records[0];
        anchor.before(isMain ? makeMainExtra(c,name,remaining,unit,base.currency,base.locale) : makeRecapExtra(name,remaining,remaining*unit,base.currency,base.locale));
      }
    }
    for (const row of rows) if (needed.has(row.dataset.microSku)) row.classList.add('zb-hidden-original');
  }
  let renderPending = false, renderSignature = '';
  function renderGroups() {
    const records = reconcileRecords();
    const main = $$('.removeable[data-micro-sku]');
    const recaps = $$('.order-summary-top .cart-items .cart-item[data-micro-sku]');
    const signature = JSON.stringify({
      ids:records.map(r => r.id),
      cart:cartLines().map(x => [x.code,x.q,x.itemId]),
      main:main.map(x => x.dataset.microSku), recap:recaps.map(x => x.dataset.microSku)
    });
    if (signature === renderSignature && (records.length === 0 || !!$('.zb-virtual'))) return;
    renderSignature = signature;
    $$('.zb-virtual').forEach(el => el.remove());
    $$('.zb-hidden-original').forEach(el => el.classList.remove('zb-hidden-original'));
    if (!records.length) return;
    renderGroupContainer(main, records, true);
    const parents = [...new Set(recaps.map(el => el.parentElement))];
    for (const parent of parents) renderGroupContainer(recaps.filter(el => el.parentElement === parent), records, false);
  }
  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    setTimeout(() => { renderPending = false; renderGroups(); syncNote(); }, 120);
  }
  let removing = false;
  async function removeBundle(id) {
    if (removing) return;
    const records = reconcileRecords();
    const target = records.find(r => r.id === id);
    if (!target) return;
    const parts = groupedParts(target);
    if (parts.some(p => cartCount(p.code) < p.q)) {
      alert('Obsah košíku se změnil. Obnovte stránku a zkuste to znovu.');
      scheduleRender();
      return;
    }
    removing = true;
    try {
      for (const p of parts) await subtractCart(p.code, p.q);
      saveRecords(records.filter(r => r.id !== id));
      syncNote();
      renderSignature = '';
      scheduleRender();
      if (!$('.removeable[data-micro-sku]')) location.reload(); // refresh checkout totals
    } catch (e) {
      console.error('[ZB] Remove bundle failed:',e);
      reconcileRecords();
      scheduleRender();
      alert('Balíček se nepodařilo kompletně odebrat. Zkontrolujte košík.');
    } finally { removing = false; }
  }
  function initCartUI() {
    D.addEventListener('click', async e => {
      const remove = e.target.closest('[data-zb-remove]');
      if (remove) { e.preventDefault(); await removeBundle(remove.dataset.zbRemove); return; }
      const extra = e.target.closest('[data-zb-extra]');
      if (!extra || removing) return;
      e.preventDefault();
      const c = extra.dataset.zbExtra, change = num(extra.dataset.change);
      const bundled = needs(getRecords()).get(c) || 0;
      if (change < 0 && cartCount(c) <= bundled) return;
      removing = true;
      try {
        if (change < 0) await subtractCart(c,1);
        else await addCart(c,1);
        renderSignature = '';
        scheduleRender();
      } catch (err) { console.error('[ZB] Standalone quantity change failed:',err); alert('Nepodařilo se změnit množství.'); }
      finally { removing = false; }
    });
    D.addEventListener('ShoptetCartUpdated', () => { renderSignature=''; scheduleRender(); });
    D.addEventListener('ShoptetDataLayerUpdated', scheduleRender);
    D.addEventListener('ShoptetDOMContentChanged', scheduleRender);
    new MutationObserver(scheduleRender).observe(D.body, {childList:true,subtree:true});
    scheduleRender();
  }

  // Product page loading, stock and price checks.
  async function pool(list, max, work) {
    let index = 0;
    await Promise.all(Array.from({length:Math.min(max,list.length)}, async () => {
      while (index < list.length) await work(list[index++]);
    }));
  }
  async function loadProduct(item) {
    item.out = true;
    item.error = '';
    item.stockExact = null;
    item.stockMin = null;
    item.stockText = '';
    if (!item.code || /TODO|PLACEHOLDER/i.test(item.code) || !configuredUrl(item.url)) {
      item.error = 'Nedokončená konfigurace';
      return;
    }
    try {
      const response = await fetch(item.url, {cache:'no-store', credentials:'same-origin'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const content = selector => $(selector, html)?.getAttribute('content') || '';
      item.name = item.name || $('h1',html)?.textContent.trim() || content('meta[property="og:title"]') || item.code;
      item.image = item.image || content('meta[property="og:image"]');
      const rawPrice = content('meta[property="product:price:amount"]') ||
        content('meta[itemprop="price"]') || $('[itemprop="price"]',html)?.getAttribute('content') ||
        $('.p-final-price-wrapper .price-final',html)?.textContent || $('.price-final',html)?.textContent;
      const parsedPrice = priceFromText(rawPrice);
      if (parsedPrice !== null) item.price = parsedPrice;
      if (!Number.isFinite(item.price)) { item.error='Nelze zjistit cenu'; return; }
      const av = ($('.availability-label',html)?.textContent || $('.availability-value',html)?.textContent || '').replace(/\s+/g,' ').trim();
      const amount = ($('.availability-amount',html)?.textContent || '').replace(/\s+/g,' ').trim();
      const normalized = stripAccents(av);
      const button = $('button[data-testid="buttonAddToCart"], button.add-to-cart-button, .add-to-cart-button',html);
      const input = $('input.amount[name="amount"]',html);
      if (/vyprod|neni skladem|nedostup|out of stock|unavailable/.test(normalized) || button?.disabled) {
        item.stockExact=0; item.stockMin=0; item.stockText='Vyprodáno'; return;
      }
      const threshold = (av + ' ' + amount).match(/>\s*(\d+)/);
      const exact = amount.match(/(\d+)/);
      if (threshold) { item.stockMin=num(threshold[1])+1; item.stockText=`> ${threshold[1]} ks`; }
      else if (exact) { item.stockExact=num(exact[1]); item.stockMin=item.stockExact; item.stockText=`${item.stockExact} ks`; }
      else if (input?.dataset.max && num(input.dataset.max)>0) { item.stockExact=num(input.dataset.max); item.stockMin=item.stockExact; item.stockText=`${item.stockExact} ks`; }
      else if (/skladem|in stock|na sklade|na objednavku/.test(normalized) || button) item.stockText='Skladem';
      if (!item.stockText) { item.error='Nelze ověřit sklad'; return; }
      item.out = item.stockExact === 0;
    } catch (err) { item.error='Nepodařilo se načíst produkt'; log('Fetch error',item.url,err); }
  }
  const available = e => !!e && !e.out && !e.error && Number.isFinite(e.price) && (e.stockExact === null || cartCount(e.code) < e.stockExact);
  const remaining = e => e.stockExact === null ? Infinity : Math.max(0, e.stockExact - cartCount(e.code));

  async function initSelector() {
    const m = $('.bundle_menu'), source = $('.bundle-source-list');
    if (!m || !source || $('#zb')) return;
    const typeEls = $$('.bundle-type');
    const types = typeEls.length ? typeEls.map(e => ({
      id:e.dataset.id || e.dataset.name, name:e.dataset.name || e.dataset.id,
      enabled:!['false','0','no','off'].includes(String(e.dataset.enabled || 'true').toLowerCase()),
      disabledText:e.dataset.disabledText || 'Tento balíček je momentálně nedostupný.',
      min:e.dataset.min == null ? null : num(e.dataset.min), max:e.dataset.max == null ? null : num(e.dataset.max)
    })) : [{id:'all',name:m.dataset.bundleName || 'Balíček',enabled:true,min:null,max:null}];
    // Every bundle config provides its own physical box SKU and product URL.
    const boxes = $$('.bundle-box').map(e => ({
      code:(e.dataset.code || '').trim(),
      url:e.dataset.url || '',
      name:e.dataset.name || 'Krabice', capacity:num(e.dataset.capacity),
      types:split(e.dataset.types), price:e.dataset.price == null ? null : num(e.dataset.price),
      priority:num(e.dataset.priority), out:true, error:'', stockExact:null
    })).filter(e => e.capacity > 0).sort((a,b) => a.capacity-b.capacity || a.priority-b.priority);
    const rules = $$('.bundle-rule').map(e => ({type:e.dataset.type || '', group:e.dataset.group || '', name:e.dataset.label || e.dataset.group || '',min:num(e.dataset.min),max:num(e.dataset.max,99)}));
    const combos = $$('.bundle-combination').map(e => ({type:e.dataset.type || '', name:e.dataset.label || '', items:$$('.bundle-combination-item',e).map(x => ({group:x.dataset.group || '', q:num(x.dataset.qty)})).filter(x => x.group && x.q >= 0)})).filter(x => x.items.length);
    const products = $$('li',source).map((e,i) => ({
      index:i, code:(e.dataset.code || '').trim(), url:e.dataset.url || $('a',e)?.href || '',
      name:e.dataset.name || e.textContent.trim(), image:e.dataset.image || '',
      group:e.dataset.group || 'x', types:split(e.dataset.types), size:Math.max(.01,num(e.dataset.size,1)),
      price:e.dataset.price == null ? null : num(e.dataset.price), q:0, out:true, error:'', stockExact:null
    })).filter(e => e.code || e.url);
    if (!products.length) return;
    let current = types[0].id, busy = false;
    const locale = m.dataset.locale || 'cs-CZ', currency = m.dataset.currency || 'CZK';
    const activeType = () => types.find(t => t.id === current);
    const visible = (p, t = current) => !p.types.length || p.types.includes(t);
    const typeBoxes = (t = current) => boxes.filter(b => !b.types.length || b.types.includes(t));
    const typeRules = (t = current) => rules.filter(r => !r.type || r.type === t);
    const typeCombos = (t = current) => combos.filter(c => !c.type || c.type === t);
    const groupCount = group => sumBy(products.filter(p => p.group === group), p => p.q);
    const count = () => sumBy(products,p => p.q);
    const size = () => sumBy(products,p => p.q*p.size);
    const groups = (t = current) => [...new Set(products.filter(p => visible(p,t)).map(p => p.group))];
    const comboCount = (combo, group) => combo.items.find(x => x.group === group)?.q || 0;
    const comboMatch = c => groups().every(g => groupCount(g) === comboCount(c,g));
    function limits(t = current) {
      const ty=types.find(x => x.id===t), cc=typeCombos(t), rr=typeRules(t);
      let min, max;
      if (cc.length) { const totals=cc.map(c => sumBy(c.items,x=>x.q)); min=Math.min(...totals);max=Math.max(...totals); }
      else if (rr.length) { min=sumBy(rr,x=>x.min);max=sumBy(rr,x=>x.max >= 99 ? 0 : x.max); if (!max) max=99; }
      else { min=1;max=99; }
      return [ty?.min ?? (m.dataset.min == null ? min : num(m.dataset.min)), ty?.max ?? (m.dataset.max == null ? max : num(m.dataset.max))];
    }
    function minSizeForGroup(t, group, required) {
      if (required === 0) return 0;
      const candidates=products.filter(p => visible(p,t) && p.group === group && available(p)).sort((a,b)=>a.size-b.size);
      let needed=required, total=0;
      for (const p of candidates) {
        const take=Math.min(needed,remaining(p));
        if (!Number.isFinite(take)) return total + needed*p.size;
        total+=take*p.size; needed-=take;
        if (needed<=0) return total;
      }
      return Infinity;
    }
    function typeFeasible(t) {
      const ty=types.find(x=>x.id===t);
      if (!ty?.enabled) return false;
      const boxOptions=typeBoxes(t).filter(available);
      if (!boxOptions.length) return false;
      const cc=typeCombos(t), rr=typeRules(t);
      const plans=cc.length ? cc.map(c=>c.items) : rr.length ? [rr.filter(r=>r.min>0).map(r=>({group:r.group,q:r.min}))] : [[{group:products.find(p=>visible(p,t))?.group || '',q:1}]];
      return plans.some(plan => {
        const required=sumBy(plan,x=>x.q);
        if (required < limits(t)[0] || required > limits(t)[1]) return false;
        const minSize=sumBy(plan,x=>minSizeForGroup(t,x.group,x.q));
        return Number.isFinite(minSize) && boxOptions.some(b=>b.capacity>=minSize);
      });
    }
    const selectBox = (s=size()) => typeBoxes().filter(available).find(b=>b.capacity>=s) || null;
    const valid = () => {
      const cc=typeCombos(), rr=typeRules(), [min,max]=limits();
      return typeFeasible(current) && count()>=min && count()<=max && !!selectBox() &&
        (cc.length ? cc.some(comboMatch) : rr.every(r=>groupCount(r.group)>=r.min && groupCount(r.group)<=r.max));
    };
    function selectBase() {
      for (const p of products) if (p.group === 'zaklad') p.q=0;
      const base=products.find(p=>p.group==='zaklad' && visible(p) && available(p));
      if (base) base.q=1;
    }
    function chooseAvailableType() {
      if (!typeFeasible(current)) {
        const first=types.find(t=>typeFeasible(t.id));
        products.forEach(p=>p.q=0);
        if (first) { current=first.id; selectBase(); }
      }
    }
    function canAdd(p) {
      if (busy || !visible(p) || !available(p) || p.q >= remaining(p)) return false;
      if (p.group==='zaklad' && p.q>=1) return false;
      if (count() >= limits()[1]) return false;
      const cc=typeCombos(), rr=typeRules();
      if (cc.length && !cc.some(c=>groups().every(g=>groupCount(g)+(g===p.group?1:0)<=comboCount(c,g)))) return false;
      if (!cc.length && rr.some(r=>r.group===p.group && groupCount(p.group)>=r.max)) return false;
      const caps=typeBoxes().filter(available).map(b=>b.capacity);
      return !!caps.length && size()+p.size<=Math.max(...caps);
    }

    m.hidden=source.hidden=true;
    D.body.classList.add('zb-on');
    const view=D.createElement('section'); view.id='zb';
    view.innerHTML=`<header><b>${esc(m.dataset.title || 'Vyberte produkty do balíčku')}</b><small class="zd"></small></header>${types.length>1?`<nav class="zy">${types.map(t=>`<button type="button" data-type="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</nav>`:''}<main><div class="zb-products">Načítám dostupnost…</div><aside><b>Váš balíček</b><div class="zbinfo"></div><i><u></u></i><small class="zc"></small><div class="zr"></div><div class="zs"></div><strong class="zt">—</strong><button type="button" class="zb-add" disabled>${esc(m.dataset.buttonText || 'Přidat do košíku')}</button><em class="zb-message" aria-live="polite"></em></aside></main>`;
    ($('.p-info-wrapper') || m.parentElement).append(view);
    const grid=$('.zb-products',view), message=$('.zb-message',view), addButton=$('.zb-add',view);
    await pool([...boxes,...products],5,loadProduct);
    chooseAvailableType();
    if (typeFeasible(current)) selectBase();
    grid.innerHTML=products.map(p=>`<article data-index="${p.index}">${p.image?`<img src="${esc(p.image)}" alt="">`:''}<div><a ${p.url?`href="${esc(p.url)}" target="_blank" rel="noopener"`:''}>${esc(p.name || p.code)}</a><small class="stock"></small><strong class="price"></strong><span><button type="button" class="m">−</button><b>0</b><button type="button" class="a">+</button></span></div></article>`).join('');
    function update() {
      chooseAvailableType();
      const cc=typeCombos(), rr=typeRules(), box=selectBox(), selected=products.filter(p=>p.q), [min,max]=limits();
      const any=types.some(t=>typeFeasible(t.id));
      $('.zd',view).textContent=!any ? 'Momentálně nedostupné. Zkontrolujte nastavení a sklad krabic i produktů.' :
        (m.dataset.description || (min===max ? `Vyberte přesně ${max} produktů.` : `Vyberte ${min}–${max} produktů.`));
      $$('.zy button',view).forEach(b=>{b.disabled=!typeFeasible(b.dataset.type);b.classList.toggle('on',b.dataset.type===current);});
      $$('.zb-products article',view).forEach(card=>{
        const p=products.find(x=>x.index===num(card.dataset.index));
        card.hidden=!visible(p);
        card.classList.toggle('on',p.q>0);
        card.classList.toggle('out',!available(p));
        $('span b',card).textContent=p.q;
        $('.m',card).disabled=busy || !p.q || p.group==='zaklad';
        $('.a',card).disabled=!canAdd(p);
        $('.stock',card).textContent=p.error || (p.out?'Vyprodáno':p.stockText);
        $('.price',card).textContent=money(p.price,currency,locale);
        const img=$('img',card); if (!img && p.image) { const el=D.createElement('img');el.src=p.image;el.alt='';card.prepend(el); }
      });
      $('.zbinfo',view).innerHTML=`<small>Krabice <b>${esc(box?.name || 'Nedostupná')}</b></small><small>Využití <b>${size()}/${box?.capacity || '—'}</b></small>${box?`<small>Cena krabice <b>${money(box.price,currency,locale)}</b></small>`:''}`;
      $('.zc',view).textContent=`${count()} položek`;
      $('aside i u',view).style.width=`${Math.min(100,100*size()/(box?.capacity || Math.max(1,...typeBoxes().map(b=>b.capacity))))}%`;
      $('.zr',view).innerHTML=cc.length?cc.map(c=>`<small class="${comboMatch(c)?'ok':''}">${esc(c.name || c.items.map(x=>`${x.q}× ${x.group}`).join(' + '))}<b>${comboMatch(c)?'✓':''}</b></small>`).join(''):
        rr.map(r=>`<small class="${groupCount(r.group)>=r.min&&groupCount(r.group)<=r.max?'ok':''}">${esc(r.name)} <b>${groupCount(r.group)}/${r.min===r.max?r.min:`${r.min}–${r.max}`}</b></small>`).join('');
      $('.zs',view).innerHTML=selected.map(p=>`<small>${p.q}× ${esc(p.name)}<b>${money(p.price*p.q,currency,locale)}</b></small>`).join('');
      $('.zt',view).textContent=box && selected.every(p=>Number.isFinite(p.price)) ? money(box.price+sumBy(selected,p=>p.price*p.q),currency,locale) : '—';
      addButton.disabled=busy || !valid();
    }
    $('.zy',view)?.addEventListener('click',e=>{
      const button=e.target.closest('button[data-type]');
      if (!button || button.disabled || busy || button.dataset.type===current) return;
      current=button.dataset.type;products.forEach(p=>p.q=0);selectBase();message.textContent='';update();
    });
    grid.addEventListener('click',e=>{
      const btn=e.target.closest('button.a,button.m');
      if (!btn || busy) return;
      e.preventDefault();e.stopPropagation();
      const p=products.find(x=>x.index===num(btn.closest('article').dataset.index));
      if (btn.classList.contains('a') && canAdd(p)) p.q++;
      else if (btn.classList.contains('m') && p.q>0 && p.group!=='zaklad') p.q--;
      message.textContent='';update();
    });
    addButton.addEventListener('click',async e=>{
      e.preventDefault();
      if (busy || !valid()) return;
      busy=true;message.textContent='Kontroluji sklad…';update();
      const selected=products.filter(p=>p.q>0);
      try {
        await pool([...selected,...typeBoxes()],5,loadProduct);
        const box=selectBox();
        const bad=selected.find(p=>!available(p) || p.q>remaining(p));
        if (bad) throw new Error(`Nedostatečný sklad nebo cena: ${bad.name}`);
        if (!box || !valid()) throw new Error('Vybraná kombinace nebo krabice již není dostupná.');
        if (remaining(box)<1) throw new Error(`Nedostatečný sklad: ${box.name}`);
        const parts=[{code:box.code,q:1},...selected.map(p=>({code:p.code,q:p.q}))];
        const snapshot=new Map(parts.map(p=>[p.code,cartCount(p.code)]));
        message.textContent='Přidávám produkty…';
        try {
          for (const p of parts) await addCart(p.code,p.q);
        } catch (err) {
          const restored=await rollbackTo(snapshot);
          throw new Error(restored ? `Přidání se nezdařilo, změny v košíku byly vráceny. ${err.message}` :
            'Přidání se nezdařilo a automatické vrácení nebylo úplné. Zkontrolujte košík.');
        }
        const record={
          id:`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
          t:Date.now(), type:activeType().name, typeId:current,
          currency,locale,size:size(),
          box:{code:box.code,name:box.name,capacity:box.capacity,price:box.price},
          items:selected.map(p=>({code:p.code,name:p.name,q:p.q,price:p.price}))
        };
        saveRecords([...getRecords(),record]);
        syncNote();renderSignature='';scheduleRender();
        message.textContent='Balíček přidán do košíku.';
        products.forEach(p=>p.q=0);selectBase();
      } catch (err) {
        console.error('[ZB] Add bundle failed:',err);
        message.textContent=err.message || 'Nepodařilo se přidat balíček.';
      } finally { busy=false;update(); }
    });
    update();
  }

  function start() { initNote(); initCartUI(); initSelector().catch(e=>console.error('[ZB] Configurator failed:',e)); }
  D.readyState==='loading' ? D.addEventListener('DOMContentLoaded',start,{once:true}) : start();
})();
