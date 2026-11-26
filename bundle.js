/* Universal Shoptet bundle engine v6.10 — configure products and boxes in HTML only. */
(() => {
  'use strict';
  if (window.__zbBundleV6) {
    if (window.__zbBundleVersion !== '6.10') console.warn('[ZB] Another bundle engine is already active. Remove all older script tags.');
    return;
  }
  window.__zbBundleV6 = true;
  window.__zbBundleVersion = '6.10';

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
  const log = (...args) => { if (DEBUG) console.log('[ZB v6.10]', ...args); };
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
  const imageUrl = raw => {
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const priceFromText = s => {
    const text = String(s || '').replace(/[\u00a0\u202f]/g, ' ').trim();
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
      unitPrice:x.priceWithVat != null && x.priceWithVat !== "" && Number.isFinite(Number(x.priceWithVat)) ? Number(x.priceWithVat) : null
    })).filter(x => x.code);
    const main=$$('.removeable[data-micro-sku]');
    const widget=$$('#cart-widget .cart-widget-product[data-micro-sku]');
    const candidates=main.length?main:widget;
    const parents=[...new Set(candidates.map(row=>row.parentElement))];
    const parent=parents.find(el=>el.getClientRects().length)||parents[0];
    return candidates.filter(row=>row.parentElement===parent).map(row => ({
      code:row.dataset.microSku, q:num($('input.amount[name="amount"]', row)?.value, 0),
      itemId:$('input[name="itemId"]', row)?.value || null,
      priceId:$('input[name="priceId"]', row)?.value || null,
      unitPrice:priceFromText($('.p-price', row)?.textContent) ?? (() => {
        const total=priceFromText($('[data-testid="cartWidgetProductPrice"]',row)?.textContent);
        const count=num($('input.amount[name="amount"]',row)?.value,0);
        return total!==null && count>0 ? total/count : null;
      })()
    }));
  }
  const cartCount = c => sumBy(cartLines().filter(x => x.code === c), x => x.q);
  const hasCartData = () => Array.isArray(dl('cart')) || !!$('.removeable[data-micro-sku], #cart-widget .cart-widget-product[data-micro-sku]');
  const readIdsFromDom = (c, line) => {
    // On normal storefront pages there is no full cart table. Shoptet still
    // includes the real itemId/priceId in the hidden native hover-cart forms.
    const row = $$('.removeable[data-micro-sku], #cart-widget .cart-widget-product[data-micro-sku]')
      .find(x => x.dataset.microSku === c);
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
    if (removing) return; // Do not reconcile a partially updated bundle.
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
    D.addEventListener('submit', e => { if (!e.target?.closest?.(VIRTUAL_ROWS) && e.target?.closest?.('#order-form, form')) syncNote(); }, true);
    D.addEventListener('focusout', e => { if (e.target?.matches?.('#remark')) syncNote(); }, true);
    D.addEventListener('change', e => { if (e.target?.matches?.('#add-note')) queueMicrotask(syncNote); }, true);
  }

  // Cart/checkout presentation: underlying Shoptet rows and totals remain untouched.
  function actualPrice(c, domRow, line, fallback) {
    if (domRow) {
      const totalRoot=$('.p-total, .cart-item-price',domRow);
      const totalNode=totalRoot && ($('[data-testid="cartPrice"], .price-final, .price',totalRoot)||totalRoot);
      const total=priceFromText(totalNode?.textContent);
      if(total!==null && line?.q>0) return total/line.q;
      const unitRoot=$('.p-price',domRow);
      const unitNode=unitRoot && ($('[data-testid="cartItemPrice"], .price-final, .price',unitRoot)||unitRoot);
      const unit=priceFromText(unitNode?.textContent);
      if(unit!==null) return unit;
    }
    return Number.isFinite(line?.unitPrice) ? line.unitPrice : fallback;
  }
  // The product's real title is independent of the selected bundle type.
  function productTitle(doc = D) {
    return ($('.p-detail h1, .p-detail-inner h1, .p-info-wrapper h1',doc)?.textContent ||
      $('h1',doc)?.textContent || $('meta[property="og:title"]',doc)?.content || '').replace(/\s+/g,' ').trim();
  }
  const bundleLabel = r => String(r.productName || r.cartName || r.type || 'Dárkový balíček').trim();
  const titleRequests = new Map();
  function upgradeLegacyTitles(records) {
    for (const r of records) {
      if (r.productName || !configuredUrl(r.productUrl) || titleRequests.has(r.productUrl)) continue;
      const url = r.productUrl;
      const request = fetch(url, {credentials:'same-origin'}).then(async response => {
        if (!response.ok) return;
        const doc = new DOMParser().parseFromString(await response.text(),'text/html');
        // Only accept a configurator page, not a login/error/redirect page.
        if (!$('.bundle_menu',doc)) return;
        const name = productTitle(doc);
        if (!name) return;
        // Read the current records after fetch, never resurrect removed bundles.
        const latest = getRecords();
        let changed = false;
        for (const item of latest) if (!item.productName && item.productUrl === url) {
          item.productName = name; changed = true;
        }
        if (changed) {saveRecords(latest);renderSignature='';scheduleRender();}
      }).catch(err => log('Could not recover product title',url,err));
      titleRequests.set(url,request);
    }
  }
  // Clone the real product structure; do not draw a second cart theme.
  // Strip identity and action attributes but keep native layout classes.
  function cleanClone(source, cls) {
    const row = source.cloneNode(true);
    row.classList.remove('zb-hidden-original');
    row.classList.add(cls);
    for (const el of [row,...$$('*',row)]) {
      const test=el.getAttribute('data-testid')||'';
      if (/^(cartItemPrice|cartPrice|cartWidgetProductPrice)$/i.test(test)) el.dataset.zbPriceKind=/^cartItemPrice$/i.test(test)?'unit':'total';
      for (const attr of [...el.attributes]) {
        if (/^data-(?:price|unit-price|total-price|final-price|mobile-price|price-with-vat)$/.test(attr.name) && /\d/.test(attr.value)) {
          el.dataset.zbPriceAttrs=(el.dataset.zbPriceAttrs||'')+' '+attr.name;
          continue;
        }
        if (attr.name === 'id' || attr.name === 'data-testid' || attr.name.startsWith('data-micro') ||
            attr.name.startsWith('on') || /^(?:data-(?:item|price|product|cart-item|sku)(?:-|$)|form|for$)/i.test(attr.name)) el.removeAttribute(attr.name);
      }
    }
    // A virtual row is never a Shoptet form, even on mobile where the
    // platform can bind directly to quantity inputs before our script loads.
    for (const form of $$('form',row)) {
      const div=D.createElement('div');
      div.className=form.className;
      div.classList.remove('js-quantity-form','js-remove-form','csrf-enabled','quantity-form');
      if(form.classList.contains('quantity-form')) div.classList.add('zb-quantity-form');
      div.append(...form.childNodes);form.replaceWith(div);
    }
    $$('input[type="hidden"]',row).forEach(el=>el.remove());
    return row;
  }
  function setNativeName(cell, name, href) {
    if (!cell) return;
    const link = $('a.main-link, a',cell);
    if (link) {
      // Keep the original anchor and its classes, remove variant/ingredient text.
      link.textContent=name;link.href=href;
      for (const el of $$('small, .variant-name, .p-variant, .cart-item-variant',cell)) if (!el.contains(link)) el.remove();
    } else cell.textContent=name;
  }
  function setNativeImage(cell, opts) {
    if (!cell) return;
    const img=$('img',cell), src=imageUrl(opts.image);
    if (img && src) {
      for (const a of ['srcset','data-src','data-srcset','data-original','data-lazy','data-lazy-src']) img.removeAttribute(a);
      $$('source',cell).forEach(el=>el.remove());
      img.src=src;img.alt=opts.name;
    } else if (img) img.remove();
    else if (src) {const el=D.createElement('img');el.src=src;el.alt=opts.name;($('a',cell)||cell).append(el);}
    const link=$('a',cell);if(link)link.href=opts.href;
  }
  // Replace only the displayed number, preserving the theme's currency/unit
  // spans, text alignment, typography, and any surrounding markup.
  function replaceNumber(root, value) {
    if (!root) return false;
    const walker=D.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n;
    while ((n=walker.nextNode())) {
      if (n.parentElement?.closest('button, .remove-item, .sr-only, .price-standard, .price-old, del, s')) continue;
      if (/\d/.test(n.nodeValue)) {
        n.nodeValue=n.nodeValue.replace(/-?\d(?:[\d.,]|[ \u00a0\u202f](?=\d))*/u,value);return true;
      }
    }
    return false;
  }
  // Every responsive copy must show the same calculated amount. Keep the
  // price wrappers/classes, but never keep the cloned product's price text.
  const PRICE_NODES='[data-zb-price-kind], .price-final, .price, .cart-item-price, .mobile-price, .price-mobile, .p-price-mobile, .p-total-mobile';
  const OLD_PRICES='.price-standard, .price-old, .price-save, del, s';
  function setNativePrice(root, value, opts, unit=false) {
    if (!root) return;
    $$(OLD_PRICES,root).forEach(el=>el.remove());
    const formatted=widgetMoney(value,opts.currency,opts.locale);
    const candidates=$$(PRICE_NODES,root).filter(el=>!el.closest('button, .remove-item, .sr-only'));
    const targets=candidates.filter(el=>!candidates.some(other=>other!==el && el.contains(other)));
    if(!targets.length) {
      const strong=$$('strong',root).filter(el=>!el.closest('button, .remove-item, .sr-only'));
      targets.push(...(strong.length?strong:[root]));
    }
    for(const target of targets) {
      const hasUnit=/\/\s*ks/i.test(target.textContent);
      // Price nodes normally contain only a number and currency. Keep any
      // separate unit span, and don't touch a delete control in the same cell.
      if(!target.querySelector('button, .remove-item, .unit-value, .price-unit, .unit')) {
        target.textContent=formatted+(unit&&hasUnit?' / ks':'');
      } else if(!replaceNumber(target,new Intl.NumberFormat(opts.locale||'cs-CZ',{maximumFractionDigits:2}).format(value))) {
        target.prepend(formatted);
      }
      target.dataset.zbRenderedPrice='1';
    }
    if(unit && !/\/\s*ks/i.test(root.textContent) && !$('.price-unit, .unit-value, .unit',root)) targets[0].append(' / ks');
  }
  function updateResponsivePrices(row,opts) {
    // Additional price nodes in the product-name/quantity area are common
    // in responsive themes. They are not necessarily inside .p-price/.p-total.
    for(const el of $$(PRICE_NODES,row)) {
      if(el.closest('.p-price,.p-total,.cart-item-price,[data-zb-rendered-price],a,button,.p-availability') || el.querySelector(PRICE_NODES)) continue;
      const unit=el.dataset.zbPriceKind==='unit'||/\/\s*ks/i.test(el.textContent);
      setNativePrice(el,unit?opts.unit:opts.total,opts,unit);
    }
    // Keep any price-bearing data attributes used by responsive CSS in sync.
    for(const el of [row,...$$('[data-zb-price-attrs]',row)]) {
      for(const attr of split((el.dataset.zbPriceAttrs||'').trim().replace(/\s+/g,','))) {
        const unit=attr==='data-unit-price'||el.dataset.zbPriceKind==='unit'||!!el.closest('.p-price');
        const value=unit?opts.unit:opts.total;
        const old=el.getAttribute(attr)||'';
        el.setAttribute(attr,/(?:Kč|CZK|EUR|€)/i.test(old)?widgetMoney(value,opts.currency,opts.locale):String(value));
      }
    }
    // Some templates render a separate mobile price without a price class.
    // Replace currency-bearing text outside names/controls as well.
    const walker=D.createTreeWalker(row,NodeFilter.SHOW_TEXT);
    let n;
    while((n=walker.nextNode())) {
      const el=n.parentElement;
      if(!el || el.closest('[data-zb-rendered-price],a,button,.p-availability,.cart-p-image,.sr-only,form,.zb-quantity-form')) continue;
      if(/\d[\d\s.,]*(?:Kč|CZK|EUR|€)/i.test(n.nodeValue)) {
        const unit=!!el.closest('.p-price')||/\/\s*ks/i.test(n.nodeValue);
        n.nodeValue=n.nodeValue.replace(/-?\d[\d\s.,]*(?:Kč|CZK|EUR|€)/gi,widgetMoney(unit?opts.unit:opts.total,opts.currency,opts.locale));
      }
    }
  }
  // Keep the native visual classes, but make the virtual quantity field ours.
  // The mobile theme can hide +/-; the input must remain editable on all devices.
  const VIRTUAL_ROWS = '.zb-cart-bundle,.zb-cart-extra,.zb-widget-bundle,.zb-widget-extra,.zb-recap-bundle,.zb-recap-extra';
  const QUANTITY_INPUT = 'input[data-zb-quantity]';
  function configureQuantityInput(input, opts) {
    if (!input) return;
    for (const attr of [...input.attributes]) {
      if (attr.name.startsWith('data-') || attr.name.startsWith('on') ||
          ['name','form','disabled','readonly','max','pattern','required'].includes(attr.name)) input.removeAttribute(attr.name);
    }
    input.classList.remove('amount');input.classList.add('zb-amount');
    const wrapper=input.closest('.quantity');
    if(wrapper){wrapper.classList.remove('quantity');wrapper.classList.add('zb-quantity');}
    input.type='number';input.inputMode='numeric';input.min='0';input.step='1';
    input.autocomplete='off';
    input.readOnly=false;input.disabled=false;
    input.defaultValue=String(opts.amount);input.value=String(opts.amount);
    input.dataset.zbQuantity=opts.bundle?'bundle':'extra';
    input.dataset.zbKey=opts.bundle?opts.id:opts.code;
    input.dataset.zbCurrent=String(opts.amount);
    input.setAttribute('aria-label','Množství');
  }
  function nativeMainRow(source, opts) {
    const tr=cleanClone(source,opts.bundle?'zb-cart-bundle':'zb-cart-extra');
    tr.dataset.zbVirtual=opts.bundle?opts.id:opts.code;
    opts.href=opts.href||'/kosik/';
    setNativeImage($('.cart-p-image',tr),opts);
    setNativeName($('.p-name',tr),opts.name,opts.href);
    const availability=$('.p-availability',tr);
    if (opts.bundle && availability) {
      const label=$('.availability-label',availability)||availability;
      if (opts.inStock) {
        label.textContent='Skladem';
        // Remove stock count belonging to the cloned template product.
        if(label!==availability) for(const n of [...availability.childNodes]) if(n!==label && !n.contains(label)) n.remove();
      } else availability.replaceChildren();
    }
    const quantity=$('.p-quantity',tr);
    if (quantity) {
      let input=$('input.amount',quantity), minus=$('.decrease',quantity), plus=$('.increase',quantity);
      if (!input || !minus || !plus) {
        quantity.innerHTML='<div class="zb-quantity-form"><span class="quantity"><button type="button" class="decrease"><span class="decrease__sign">−</span></button><label><input type="number" class="amount" min="1"></label><button type="button" class="increase"><span class="increase__sign">+</span></button></span></div>';
        input=$('input.amount',quantity);minus=$('.decrease',quantity);plus=$('.increase',quantity);
      }
      configureQuantityInput(input,opts);
      for (const [btn,change] of [[minus,-1],[plus,1]]) {
        btn.setAttribute('type','button');btn.removeAttribute('disabled');btn.removeAttribute('name');btn.removeAttribute('href');
        if(opts.bundle)btn.setAttribute(change>0?'data-zb-duplicate':'data-zb-remove',opts.id);
        else {btn.setAttribute('data-zb-extra',opts.code);btn.setAttribute('data-change',String(change));}
        btn.setAttribute('aria-label',change>0?'Zvýšit množství':'Snížit množství');
      }
    }
    for(const cell of $$('.p-price',tr)) setNativePrice(cell,opts.unit,opts,true);
    for(const cell of $$('.p-total',tr)) setNativePrice(cell,opts.total,opts);
    updateResponsivePrices(tr,opts);
    let remove=$('.remove-item, .p-remove button, .p-delete button',tr);
    if (!remove) {
      remove=D.createElement('button');remove.className='remove-item';
      ($('.p-remove, .p-delete, .p-total',tr)||tr.lastElementChild).append(remove);
    }
    remove.setAttribute('type','button');remove.removeAttribute('href');remove.removeAttribute('name');remove.removeAttribute('disabled');
    remove.setAttribute('aria-label',opts.bundle?'Odebrat celý balíček':'Odebrat samostatný produkt');
    remove.setAttribute(opts.bundle?'data-zb-remove':'data-zb-extra-remove',opts.bundle?opts.id:opts.code);
    $$('button',tr).filter(b=>!b.matches('[data-zb-remove],[data-zb-duplicate],[data-zb-extra],[data-zb-extra-remove]')).forEach(b=>b.remove());
    return tr;
  }
  function makeMainRow(r,total,source,inStock) {
    return nativeMainRow(source,{bundle:true,id:r.id,name:bundleLabel(r),image:r.image,href:r.productUrl,amount:1,unit:total,total,currency:r.currency,locale:r.locale,inStock});
  }
  function makeMainExtra(c,name,amount,unit,currency,locale,source) {
    return nativeMainRow(source,{bundle:false,code:c,name,amount,unit,total:unit*amount,currency,locale,href:$('.p-name a',source)?.getAttribute('href'),image:$('.cart-p-image img',source)?.getAttribute('src')});
  }
  function nativeRecapRow(source,opts) {
    const row=cleanClone(source,opts.bundle?'zb-recap-bundle':'zb-recap-extra');
    setNativeName($('.cart-item-name',row),opts.name,opts.href||'/kosik/');
    if(opts.bundle) setNativeImage($('.cart-item-image, .cart-p-image',row),{...opts,href:opts.href||'/kosik/'});
    const amount=$('.cart-item-amount',row);
    if(amount && !replaceNumber(amount,String(opts.amount))) amount.textContent=`${opts.amount} ks`;
    setNativePrice($('.cart-item-price',row),opts.total,opts);
    updateResponsivePrices(row,{...opts,unit:opts.amount?opts.total/opts.amount:opts.total});
    // Recap is read-only on this theme. Do not add a photo or controls that
    // ordinary products do not have. Never retain ingredient action links.
    $$('form, button, .remove-item, .cart-item-delete',row).forEach(el=>el.remove());
    return row;
  }
  function makeRecapRow(r,total,source) {
    return nativeRecapRow(source,{bundle:true,name:bundleLabel(r),image:r.image,href:r.productUrl,amount:1,total,currency:r.currency,locale:r.locale});
  }
  function makeRecapExtra(name,amount,total,currency,locale,source) {
    return nativeRecapRow(source,{bundle:false,name,amount,total,currency,locale,href:$('.cart-item-name a',source)?.getAttribute('href')});
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
    const anchor = rows.find(row=>needed.has(row.dataset.microSku)) || rows[0];
    const template = rows.find(row=>!needed.has(row.dataset.microSku)) || anchor;
    for (const r of records) {
      const total = sumBy(partList(r), p => (units.get(p.code) ?? p.price ?? 0) * p.q);
      const source = template;
      const inStock = isMain && partList(r).every(p => /^skladem\b/i.test($('.p-availability',byCode.get(p.code))?.textContent.trim()||''));
      anchor.before(isMain ? makeMainRow(r,total,source,inStock) : makeRecapRow(r,total,source));
    }
    for (const [c, bundled] of needed) {
      const remaining = (counts.get(c) || 0) - bundled;
      if (remaining > 0) {
        const row = byCode.get(c);
        const name = $('.p-name a, .cart-item-name a',row)?.textContent.trim() || $('.p-name', row)?.textContent.trim() || $('.cart-item-name', row)?.textContent.trim() || c;
        const unit = units.get(c) ?? 0;
        const base = records[0];
        anchor.before(isMain ? makeMainExtra(c,name,remaining,unit,base.currency,base.locale,row) : makeRecapExtra(name,remaining,remaining*unit,base.currency,base.locale,row));
      }
    }
    for (const row of rows) if (needed.has(row.dataset.microSku)) row.classList.add('zb-hidden-original');
  }
  let renderPending = false, renderSignature = '';
  function renderGroups() {
    const records = reconcileRecords();
    upgradeLegacyTitles(records);
    const main = $$('.removeable[data-micro-sku]');
    const recaps = $$('.order-summary-top .cart-items .cart-item[data-micro-sku]');
    const signature = JSON.stringify({
      ids:records.map(r => [r.id,bundleLabel(r)]),
      cart:cartLines().map(x => [x.code,x.q,x.itemId,x.unitPrice]),
      main:main.map(x => [x.dataset.microSku,$('.p-price',x)?.textContent,$('.p-total',x)?.textContent]), recap:recaps.map(x => [x.dataset.microSku,$('.cart-item-price',x)?.textContent])
    });
    const required = needs(records);
    const hasAllParts = rows => [...required.keys()].every(c => rows.some(row => row.dataset.microSku === c));
    const mainParents=[...new Set(main.map(row=>row.parentElement))];
    const mainReady=mainParents.every(parent=>{const rows=main.filter(row=>row.parentElement===parent);return !hasAllParts(rows)||(rows.filter(row=>required.has(row.dataset.microSku)).every(row=>row.classList.contains('zb-hidden-original'))&&$$('.zb-cart-bundle',parent).length===records.length);});
    const recapParents = [...new Set(recaps.map(row => row.parentElement))];
    const recapReady = recapParents.every(parent => {
      const rows = recaps.filter(row => row.parentElement === parent);
      return !hasAllParts(rows) || (
        rows.filter(row => required.has(row.dataset.microSku)).every(row => row.classList.contains('zb-hidden-original')) &&
        $$('.zb-recap-bundle',parent).length === records.length);
    });
    if (signature === renderSignature && (records.length === 0 || (mainReady && recapReady))) return;
    renderSignature = signature;
    $$('.zb-cart-bundle, .zb-cart-extra, .zb-recap-bundle, .zb-recap-extra').forEach(el => el.remove());
    $$('.removeable.zb-hidden-original, .order-summary-top .cart-items .cart-item.zb-hidden-original').forEach(el => el.classList.remove('zb-hidden-original'));
    if (!records.length) return;
    for(const parent of mainParents) renderGroupContainer(main.filter(row=>row.parentElement===parent),records,true);
    const parents = [...new Set(recaps.map(el => el.parentElement))];
    for (const parent of parents) renderGroupContainer(recaps.filter(el => el.parentElement === parent), records, false);
  }
  // Shoptet's hover-cart is separate from the full cart and checkout. It is
  // frequently rebuilt on hover, so render directly into each live popup.
  // Do not alter the real Shoptet forms or cart totals; only hide their rows.
  function widgetRowQty(row) {
    return Math.max(0, num($('input.amount[name="amount"], input.amount',row)?.value, 0));
  }
  function widgetRowPrice(row) {
    // The popup shows LINE totals (e.g. 660 Kč for three 220 Kč items).
    const text = $('[data-testid="cartWidgetProductPrice"]',row)?.textContent ||
      $('.cart-widget-product-name > span',row)?.textContent || '';
    return priceFromText(text);
  }
  const widgetMoney=(n,currency='CZK',locale='cs-CZ')=>{
    if(!Number.isFinite(n))return 'Cena nedostupná';
    try{return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(n);}
    catch{return money(n,currency,locale);}
  };
  // Clone Shoptet's *real* popup product row, rather than drawing a custom
  // card. Its own theme CSS then controls the image, title, quantity and bin.
  // Strip the native form actions, item IDs and microdata: a virtual row must
  // never submit an individual ingredient or be treated as a real cart item.
  function nativeWidgetRow(source, opts) {
    const div=cleanClone(source,opts.bundle ? 'zb-widget-bundle' : 'zb-widget-extra');
    ['data-micro','data-micro-sku','data-micro-identifier','data-testid'].forEach(a=>div.removeAttribute(a));
    $$('[data-testid]',div).forEach(el=>el.removeAttribute('data-testid'));
    $$('form',div).forEach(form=>form.remove());
    const href=opts.href || '/kosik/';
    const picture=$('.cart-widget-product-image',div);
    const img=imageUrl(opts.image);
    if(picture) picture.innerHTML=`<a href="${esc(href)}">${img?`<img src="${esc(img)}" alt="${esc(opts.name)}" width="100" height="100" loading="lazy">`:''}</a>`;
    let name=$('.cart-widget-product-name',div);
    if(!name){name=D.createElement('div');name.className='cart-widget-product-name';div.append(name);}
    const plus=opts.bundle ? `data-zb-duplicate="${esc(opts.id)}"` : `data-zb-extra="${esc(opts.code)}" data-change="1"`;
    const minus=opts.bundle ? `data-zb-remove="${esc(opts.id)}"` : `data-zb-extra="${esc(opts.code)}" data-change="-1"`;
    name.innerHTML=`<strong><a href="${esc(href)}">${esc(opts.name)}</a></strong>`+
      `<span>${widgetMoney(opts.total,opts.currency,opts.locale)}</span>`+
      `<div class="cart-widget-product-amount"><div class="zb-quantity-form"><span class="quantity">`+
      `<label><span class="sr-only">Množství</span><input type="number" class="amount" value="${opts.amount}" min="0" step="1" inputmode="numeric" aria-label="Množství"></label>`+
      `<button class="increase" type="button" ${plus} aria-label="${opts.bundle?'Přidat další stejný balíček':'Zvýšit množství o 1'}"><span class="increase__sign">+</span></button>`+
      `<button class="decrease" type="button" ${minus} aria-label="${opts.bundle?'Odebrat tento balíček':'Snížit množství o 1'}"><span class="decrease__sign">−</span></button>`+
      `</span></div></div>`;
    configureQuantityInput($('input.amount',name),opts);
    let remove=$('.cart-widget-product-delete',div);
    if(!remove){remove=D.createElement('div');remove.className='cart-widget-product-delete';div.append(remove);}
    const deleteAttr=opts.bundle ? `data-zb-remove="${esc(opts.id)}"` : `data-zb-extra-remove="${esc(opts.code)}"`;
    remove.innerHTML=`<div class="inline"><button type="button" class="remove-item" ${deleteAttr} aria-label="${opts.bundle?'Odebrat celý balíček':'Odebrat samostatný produkt'}"><span class="sr-only">Odstranit z košíku</span></button></div>`;
    updateResponsivePrices(div,{...opts,unit:opts.amount?opts.total/opts.amount:opts.total});
    return div;
  }
  function makeWidgetRow(r, total, source) {
    const div=nativeWidgetRow(source,{
      bundle:true,id:r.id,name:bundleLabel(r),image:r.image,
      href:r.productUrl || '/kosik/',amount:1,total,currency:r.currency,locale:r.locale
    });
    div.dataset.zbBundleId=r.id;
    return div;
  }
  function makeWidgetExtra(row, amount, total, currency, locale) {
    const link=$('.cart-widget-product-name a',row);
    return nativeWidgetRow(row,{
      bundle:false,code:row.dataset.microSku,name:link?.textContent.trim()||row.dataset.microSku,
      image:$('.cart-widget-product-image img',row)?.getAttribute('src')||'',
      href:link?.getAttribute('href')||'/kosik/',amount,total,currency,locale
    });
  }
  function renderWidget() {
    const records=getRecords();
    const required=needs(records);
    // The popup can be present before hover, inserted on hover, or replaced in place.
    for(const container of $$('#cart-widget .cart-widget-products-inner')) {
      const rows=$$('.cart-widget-product[data-micro-sku]',container);
      const signature=JSON.stringify({
        records:records.map(r=>[r.id,bundleLabel(r),r.image,r.box?.code,r.items.map(x=>[x.code,x.q])]),
        rows:rows.map(row=>[row.dataset.microSku,widgetRowQty(row),widgetRowPrice(row),$('input[name="itemId"]',row)?.value])
      });
      const grouped=$$('.zb-widget-bundle',container);
      const hidden=rows.filter(row=>required.has(row.dataset.microSku));
      const alreadyDone=records.length ? grouped.length===records.length &&
        hidden.length>0 && hidden.every(row=>row.classList.contains('zb-hidden-original')) :
        !grouped.length && !$$('.zb-widget-extra,.cart-widget-product.zb-hidden-original',container).length;
      if(container.dataset.zbWidgetSignature===signature && alreadyDone) continue;
      container.dataset.zbWidgetSignature=signature;
      $$('.zb-widget-bundle,.zb-widget-extra',container).forEach(el=>el.remove());
      $$('.cart-widget-product.zb-hidden-original',container).forEach(el=>el.classList.remove('zb-hidden-original'));
      if(!records.length || !rows.length) continue;
      const byCode=new Map(), counts=new Map(), unitPrices=new Map();
      for(const row of rows) {
        const c=row.dataset.microSku, count=widgetRowQty(row), total=widgetRowPrice(row);
        if(!byCode.has(c)) byCode.set(c,row);
        counts.set(c,(counts.get(c)||0)+count);
        if(total!==null) {
          const old=unitPrices.get(c) || {total:0,qty:0};
          old.total+=total;old.qty+=count;unitPrices.set(c,old);
        }
      }
      // If Shoptet is still loading the widget, leave every native item visible.
      if([...required].some(([c,q])=>!byCode.has(c) || (counts.get(c)||0)<q)) continue;
      const units=new Map();
      for(const [c, row] of byCode) {
        const observed=unitPrices.get(c);
        const fallback=records.flatMap(partList).find(p=>p.code===c)?.price;
        const layerUnit=cartLines().find(x=>x.code===c)?.unitPrice;
        units.set(c,observed?.qty>0 ? observed.total/observed.qty :
          (Number.isFinite(layerUnit) ? layerUnit : fallback));
      }
      const anchor=rows.find(row=>required.has(row.dataset.microSku));
      for(const r of records) {
        const parts=partList(r);
        const allKnown=parts.every(p=>Number.isFinite(units.get(p.code) ?? p.price));
        const total=allKnown ? sumBy(parts,p=>(units.get(p.code) ?? p.price)*p.q) : NaN;
        anchor.before(makeWidgetRow(r,total,byCode.get(r.box.code)||anchor));
      }
      for(const [c,bundled] of required) {
        const standalone=(counts.get(c)||0)-bundled;
        if(standalone>0) {
          const row=byCode.get(c), base=records[0], unit=units.get(c);
          anchor.before(makeWidgetExtra(row,standalone,Number.isFinite(unit)?unit*standalone:NaN,base.currency,base.locale));
        }
      }
      for(const row of rows) if(required.has(row.dataset.microSku)) row.classList.add('zb-hidden-original');
    }
  }
  function scheduleRender() {
    if (renderPending || removing) return;
    renderPending = true;
    setTimeout(() => {
      renderPending = false;
      if (removing) return; // Wait until every physical SKU has been updated.
      const active=D.activeElement;
      if(active?.matches?.(QUANTITY_INPUT) && active.value!==active.dataset.zbCurrent && !active.dataset.zbPending) return;
      renderGroups(); renderWidget(); syncNote();
    }, 120);
  }
  let removing = false;
  async function duplicateBundle(id, copies=1) {
    if (removing || !Number.isSafeInteger(copies) || copies<1 || copies>999) return false;
    const records=reconcileRecords();
    const target=records.find(r=>r.id===id);
    if(!target) return false;
    const parts=groupedParts(target);
    const snapshot=new Map(parts.map(p=>[p.code,cartCount(p.code)]));
    removing=true;
    try {
      // One request per physical SKU, not one request per copy.
      for(const p of parts) await addCart(p.code,p.q*copies);
      const added=Array.from({length:copies},()=>({...target,id:`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,t:Date.now()}));
      saveRecords([...getRecords(),...added]);
      if(!$('.removeable[data-micro-sku]')) location.reload();
      return true;
    } catch(err) {
      const restored=await rollbackTo(snapshot);
      console.error('[ZB] Duplicate bundle failed:',err);
      alert(restored ? 'Další balíček se nepodařilo přidat. Košík byl vrácen do původního stavu.' :
        'Další balíček se nepodařilo přidat a vrácení změn nebylo úplné. Zkontrolujte košík.');
      return false;
    } finally {removing=false;renderSignature='';scheduleRender();}
  }
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
      saveRecords(getRecords().filter(r => r.id !== id));
      if (!$('.removeable[data-micro-sku]')) location.reload(); // refresh checkout totals
      return true;
    } catch (e) {
      console.error('[ZB] Remove bundle failed:',e);
      reconcileRecords();
      alert('Balíček se nepodařilo kompletně odebrat. Zkontrolujte košík.');
      return false;
    } finally { removing = false; renderSignature='';scheduleRender(); }
  }
  async function setStandaloneQuantity(c, desired) {
    if (removing || !Number.isSafeInteger(desired) || desired<0) return false;
    const bundled=needs(reconcileRecords()).get(c)||0;
    const current=Math.max(0,cartCount(c)-bundled);
    const delta=desired-current;
    if (!delta) return true;
    removing=true;
    try {
      if(delta<0) await subtractCart(c,-delta);
      else await addCart(c,delta);
      return true;
    } catch(err) {
      console.error('[ZB] Standalone quantity change failed:',err);
      alert('Nepodařilo se změnit množství. Zkontrolujte košík.');
      return false;
    } finally {removing=false;renderSignature='';scheduleRender();}
  }
  function commitQuantity(input) {
    if (!input || input.dataset.zbPending) return;
    const current=Number(input.dataset.zbCurrent);
    const raw=input.value.trim();
    const desired=Number(raw);
    const isBundle=input.dataset.zbQuantity==='bundle';
    // Empty/invalid is not zero. Never remove a bundle just because the user
    // clears the field while typing. Cap a single virtual-row expansion to
    // avoid accidentally generating thousands of local records.
    if (!raw || !Number.isSafeInteger(desired) || desired<0 || (isBundle && desired>1000) || removing) {
      input.value=String(current);scheduleRender();return;
    }
    if (desired===current) {scheduleRender();return;}
    input.dataset.zbPending='1';
    input.setAttribute('aria-busy','true');
    input.readOnly=true;
    const key=input.dataset.zbKey;
    const operation=isBundle ? (desired===0?removeBundle(key):duplicateBundle(key,desired-1)) : setStandaloneQuantity(key,desired);
    Promise.resolve(operation).then(ok=>{
      // Bundles are still represented as one row per independently removable
      // configuration. Extras retain their normal aggregated quantity.
      if (ok && !isBundle) input.dataset.zbCurrent=String(desired);
    }).catch(err=>console.error('[ZB] Quantity commit failed:',err)).finally(()=>{
      input.value=input.dataset.zbCurrent;
      input.readOnly=false;delete input.dataset.zbPending;input.removeAttribute('aria-busy');
    });
  }
  window.__zbCartDiagnostics=()=>({version:window.__zbBundleVersion,viewport:innerWidth,
    rows:$$('.zb-cart-bundle,.zb-widget-bundle,.zb-recap-bundle').map(row=>({classes:row.className,
      fields:$$('input',row).map(el=>({classes:el.className,value:el.value,name:el.name,visible:!!el.getClientRects().length})),
      prices:$$('.p-price,.p-total,.cart-item-price,.price-final,.price,.mobile-price,.price-mobile,[data-zb-rendered-price]',row).map(el=>({classes:el.className,text:el.textContent.trim(),visible:!!el.getClientRects().length})),
      forms:$$('form',row).length})),busy:removing});
  function initCartUI() {
    // Shoptet delegates quantity events on .amount / .quantity-form. Block
    // those events for virtual inputs only, without preventing normal typing,
    // number steppers, focus or native updates for ordinary products.
    for (const type of ['beforeinput','input','change','focus','focusin','blur','focusout','keydown','keypress','keyup','click']) {
      window.addEventListener(type,e=>{
        const input=e.target?.closest?.(QUANTITY_INPUT);
        if (!input) return;
        e.stopImmediatePropagation();
        if (type==='change' || type==='blur' || type==='focusout') commitQuantity(input);
        if (type==='keydown' && e.key==='Enter' && !e.isComposing) {
          e.preventDefault();commitQuantity(input);input.blur();
        }
      },true);
    }
    window.addEventListener('submit', e=>{
      if (!e.target.closest?.(VIRTUAL_ROWS)) return;
      e.preventDefault();e.stopImmediatePropagation();
      commitQuantity($(QUANTITY_INPUT,e.target));
    },true);
    // Capture before Shoptet's delegated .increase/.decrease/.remove-item handlers.
    D.addEventListener('click', async e => {
      const controlled=e.target.closest?.('[data-zb-remove],[data-zb-duplicate],[data-zb-extra],[data-zb-extra-remove]');
      if(!controlled) return;
      e.preventDefault();e.stopImmediatePropagation();
      const duplicate=e.target.closest('[data-zb-duplicate]');
      if(duplicate){ await duplicateBundle(duplicate.dataset.zbDuplicate);return; }
      const remove = e.target.closest('[data-zb-remove]');
      if (remove) {
        if (removing) return;
        remove.disabled=true;
        remove.setAttribute('aria-busy','true');
        try { await removeBundle(remove.dataset.zbRemove); }
        finally { if (remove.isConnected) { remove.disabled=false; remove.removeAttribute('aria-busy'); } }
        return;
      }
      const extraRemove=e.target.closest('[data-zb-extra-remove]');
      if(extraRemove){
        if(removing)return;
        const c=extraRemove.dataset.zbExtraRemove;
        const standalone=cartCount(c)-(needs(getRecords()).get(c)||0);
        if(standalone<=0)return;
        await setStandaloneQuantity(c,0);
        return;
      }
      const extra = e.target.closest('[data-zb-extra]');
      if (!extra || removing) return;
      const c = extra.dataset.zbExtra, change = num(extra.dataset.change);
      const bundled = needs(getRecords()).get(c) || 0;
      if (change < 0 && cartCount(c) <= bundled) return;
      await setStandaloneQuantity(c,Math.max(0,cartCount(c)-bundled+change));
    }, true);
    D.addEventListener('ShoptetCartUpdated', () => { renderSignature=''; scheduleRender(); });
    D.addEventListener('ShoptetDataLayerUpdated', scheduleRender);
    D.addEventListener('ShoptetDOMContentChanged', scheduleRender);
    D.addEventListener('pointerover', e => { if(e.target?.closest?.('#cart-widget')) scheduleRender(); }, true);
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
    // Optional data-image on .bundle_menu overrides the product's own social/gallery image.
    const configuratorImage = imageUrl(m.dataset.image ||
      $('meta[property="og:image"]')?.getAttribute('content') ||
      $('meta[name="twitter:image"]')?.getAttribute('content') ||
      $('.p-detail .p-image img, .p-detail-inner .p-image img, .p-image img')?.getAttribute('src'));
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
          productName:productTitle() || m.dataset.cartName || m.dataset.title || activeType().name,
          currency,locale,size:size(),image:configuratorImage,productUrl:location.pathname,
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
