(function () {
  /*
    Squarespace — Collection → List Section Sync  v1.0
    Square Design Lab

    Syncs any Squarespace collection (Store, Blog, Events) into a List Section.
    The List Section becomes a display shell; this script fetches the real
    collection JSON at runtime and maps it onto the existing <li> slots.

    No classes / no constructors — a plain IIFE with function declarations so
    the flow is easy to read and debug. All behaviour is driven by the optional
    global window.SDL_SYNC_CONFIG object (see DEFAULTS below).
  */

  /* ------------------------------------------------------------------ */
  /*  CONFIG                                                            */
  /* ------------------------------------------------------------------ */

  const DEFAULTS = {
    titleLink: true,        // wrap the item title in an <a> linking to the item
    imageLink: false,       // overlay a full-size <a> link on the image
    showPrice: true,        // append product pricing to store item titles
    showDescription: true,  // map the item excerpt into the description element
    showButton: true,       // point the list-item button at the collection item
    showEventDateTags: true,// inject a date tag block for event items
    trimExtraItems: true,   // remove leftover <li> slots the collection can't fill
    removeCarousel: false   // true = strip Squarespace's carousel controller
                            // false = keep the native carousel and sync into it
  };

  const CONFIG = Object.assign({}, DEFAULTS, window.SDL_SYNC_CONFIG || {});

  // 21 currencies — symbol lookup for product pricing.
  const CURRENCY_MAP = {
    USD: '$',  EUR: '€',  JPY: '¥',  GBP: '£',  AUD: 'A$',
    CAD: 'C$', CHF: 'CHF', CNY: '¥', SEK: 'kr', NZD: 'NZ$',
    MXN: 'Mex$', SGD: 'S$', HKD: 'HK$', NOK: 'kr', KRW: '₩',
    TRY: '₺',  RUB: '₽',  INR: '₹',  BRL: 'R$', ZAR: 'R',
    PLN: 'zł'
  };

  function currencySign(code) {
    return CURRENCY_MAP[code] || '';
  }

  /* ------------------------------------------------------------------ */
  /*  DATA FETCHING                                                     */
  /* ------------------------------------------------------------------ */

  // Recursively walks a collection's JSON pages until enough items are
  // collected to fill every <li> slot. `state` carries cross-page flags.
  async function getCollectionData(path, itemsArray, neededCount, state) {
    try {
      const url = new URL(path, window.location.origin);
      const params = new URLSearchParams(url.search);

      // ?featured — restrict to starred items.
      if (params.has('featured')) {
        state.filterForFeatured = true;
        params.delete('featured');
      }

      // ?events= — upcoming (default) | past | both.
      let events = 'upcoming';
      if (params.has('events')) {
        events = params.get('events');
        params.delete('events');
      }

      // Cache-bust + force JSON.
      params.set('format', 'json');
      params.set('date', new Date().getTime());
      url.search = params.toString();

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.status);
      }
      const data = await response.json();

      // Resolve which array holds the items for this collection type.
      let items = data.items;
      if (!items) {
        if (!data.upcoming && !data.past) {
          throw new Error('No items in the collection');
        }
        items = data.upcoming;
        if (events === 'past') items = data.past;
        if (events === 'both') items = [].concat(data.upcoming, data.past);
      }

      if (state.filterForFeatured) {
        items = items.filter(function (item) { return item.starred === true; });
      }

      items.forEach(function (item) { itemsArray.push(item); });

      // Stop once we have enough, otherwise follow pagination.
      if (itemsArray.length >= neededCount) return itemsArray;
      if (data.pagination && data.pagination.nextPageUrl && data.pagination.nextPage) {
        return await getCollectionData(data.pagination.nextPageUrl, itemsArray, neededCount, state);
      }
      return itemsArray;
    } catch (error) {
      console.error('SDL List Section Sync — error fetching data:', error);
      throw error;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  TITLE / TEMPLATE HELPERS                                          */
  /* ------------------------------------------------------------------ */

  // Strip the {sync=...} tag from the visible title; hide the title if empty.
  function adjustTitle(titleEl, titleStr) {
    const tag = titleStr.match(/\{sync=(.*?)\}/)[0];
    titleEl.innerHTML = titleEl.innerHTML.replaceAll(tag, '');
    if (titleEl.innerText.trim() === '') titleEl.style.display = 'none';
  }

  // Normalise every <li> to match the first item's markup so mapping is
  // consistent regardless of what was typed into the Squarespace editor.
  function templatizeListItems(items) {
    if (!items.length) return;
    const templateHTML = items[0].innerHTML;
    items.forEach(function (el) { el.innerHTML = templateHTML; });
  }

  /* ------------------------------------------------------------------ */
  /*  MAPPING                                                           */
  /* ------------------------------------------------------------------ */

  function buildTitleHTML(item, realUrl) {
    const title = item.title;

    if (item.variants) {
      const variant = item.variants[0];
      const onSale = variant.onSale;
      const salePrice = variant.salePriceMoney.value;
      const price = variant.priceMoney.value;
      const currency = currencySign(variant.priceMoney.currency);
      const head = CONFIG.titleLink
        ? '<a href="' + realUrl + '">' + title + '</a>'
        : '<span>' + title + '</span>';

      if (!CONFIG.showPrice) return head;

      if (onSale) {
        return head + ' <span><span class="price">' + currency + salePrice +
          '</span><span class="price" style="text-decoration: line-through; margin-left: 5px;">' +
          currency + price + '</span></span>';
      }
      return head + ' <span class="price">' + currency + price + '</span>';
    }

    return CONFIG.titleLink
      ? '<a href="' + realUrl + '">' + title + '</a>'
      : '<span>' + title + '</span>';
  }

  function buildEventDateTag(item) {
    const dateStart = new Date(item.startDate);
    const dateEnd = new Date(item.endDate);
    const startMonth = dateStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = dateEnd.toLocaleDateString('en-US', { month: 'short' });

    const dateTag = document.createElement('div');
    dateTag.classList.add('eventlist-datetag');
    dateTag.innerHTML =
      '<div class="eventlist-datetag-inner">' +
        '<div class="eventlist-datetag-startdate eventlist-datetag-startdate--month">' + startMonth + '</div>' +
        '<div class="eventlist-datetag-startdate eventlist-datetag-startdate--day">' + dateStart.getDate() + '</div>' +
        '<div class="eventlist-datetag-enddate">to ' + endMonth + ' ' + dateEnd.getDate() + '</div>' +
        '<div class="eventlist-datetag-status"></div>' +
      '</div>';
    return dateTag;
  }

  function mapCollectionDataToListItems(sectionItems, collectionData) {
    sectionItems.forEach(function (listItem, index) {
      const item = collectionData[index];
      if (!item) return;

      const realUrl = item.passthrough ? item.sourceUrl : item.fullUrl;

      // Tag the synced image URL so CSS can reveal it once initialised.
      const newAssetUrl = new URL(item.assetUrl);
      const imgParams = new URLSearchParams(newAssetUrl.search);
      imgParams.set('isSyncedImage', 'true');
      newAssetUrl.search = imgParams.toString();

      const titleEl = listItem.querySelector('.list-item-content__title');
      const descriptionEl = listItem.querySelector('.list-item-content__description');
      const thumbnailEl = listItem.querySelector('img');
      const buttonEl = listItem.querySelector('a.list-item-content__button');

      if (item.recordTypeLabel) listItem.classList.add(item.recordTypeLabel);

      // Title (+ optional price).
      if (titleEl) titleEl.innerHTML = buildTitleHTML(item, realUrl);

      // Description / excerpt.
      if (descriptionEl && CONFIG.showDescription) descriptionEl.innerHTML = item.excerpt || '';

      // Image — clone, swap source, hide original to avoid flicker.
      if (thumbnailEl) {
        const cloneThumbnail = thumbnailEl.cloneNode(true);
        cloneThumbnail.src = newAssetUrl;
        cloneThumbnail.dataset.src = newAssetUrl;
        cloneThumbnail.dataset.image = newAssetUrl;
        cloneThumbnail.srcset = '';
        thumbnailEl.parentElement.append(cloneThumbnail);

        if (CONFIG.imageLink && !thumbnailEl.parentElement.querySelector('.image-link')) {
          const imageLink = document.createElement('a');
          imageLink.href = realUrl;
          imageLink.classList.add('image-link');
          thumbnailEl.parentElement.append(imageLink);
        }

        if (CONFIG.showEventDateTags && item.recordTypeLabel === 'event') {
          thumbnailEl.parentElement.append(buildEventDateTag(item));
        }

        thumbnailEl.style.display = 'none';
      }

      // Button link.
      if (buttonEl && CONFIG.showButton) {
        buttonEl.setAttribute('href', realUrl);
        const templateBtn = sectionItems[0].querySelector('a.list-item-content__button');
        if (templateBtn) buttonEl.innerHTML = templateBtn.innerHTML;
      }
    });

    window.dispatchEvent(new Event('resize'));
  }

  /* ------------------------------------------------------------------ */
  /*  CAROUSEL CONTROLLER                                               */
  /* ------------------------------------------------------------------ */

  // Squarespace's UserItemsListCarousel can fight the synced layout. When
  // removeCarousel is true we strip the controller (after it binds, via a
  // MutationObserver if needed). When false we leave the carousel running so
  // the synced items display inside Squarespace's native carousel.
  function handleCarousel(section) {
    if (!CONFIG.removeCarousel) return;

    const controllerElement = section.querySelector('[data-controller]');
    if (!controllerElement) return;

    if (controllerElement.dataset.controllersBound === 'UserItemsListCarousel') {
      controllerElement.removeAttribute('data-controller');
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName !== 'data-controllers-bound') return;
        if (controllerElement.dataset.controllersBound === 'UserItemsListCarousel') {
          controllerElement.removeAttribute('data-controller');
          observer.disconnect();
        }
      });
    });
    observer.observe(controllerElement, {
      attributes: true,
      attributeFilter: ['data-controllers-bound']
    });
  }

  /* ------------------------------------------------------------------ */
  /*  PER-SECTION ORCHESTRATION                                         */
  /* ------------------------------------------------------------------ */

  async function initSection(section) {
    section.dataset.listSectionSync = 'loading';

    const titleEl = section.querySelector('.list-section-title');
    const titleStr = titleEl.innerText;
    const match = titleStr.match(/\{sync=(.*?)\}/);
    if (!match) {
      section.dataset.listSectionSync = 'false';
      return;
    }

    const collectionUrl = match[1];
    const state = { filterForFeatured: false };

    let sectionItems = Array.from(section.querySelectorAll('li.list-item'));

    try {
      const collectionData = await getCollectionData(collectionUrl, [], sectionItems.length, state);

      adjustTitle(titleEl, titleStr);

      // Trim empty slots the collection can't fill.
      if (CONFIG.trimExtraItems && sectionItems.length > collectionData.length) {
        console.warn('SDL List Section Sync — not enough collection items, trimming list.');
        while (sectionItems.length > collectionData.length) {
          sectionItems[sectionItems.length - 1].remove();
          sectionItems = Array.from(section.querySelectorAll('li.list-item'));
        }
      }

      templatizeListItems(sectionItems);
      mapCollectionDataToListItems(sectionItems, collectionData);

      // Squarespace re-renders on these events — re-map to stay in sync.
      const remap = function () { mapCollectionDataToListItems(sectionItems, collectionData); };
      window.addEventListener('DOMContentLoaded', remap);
      window.addEventListener('load', remap);

      section.dataset.listSectionSync = 'initialized';
      handleCarousel(section);
    } catch (error) {
      // Leave the section in `loading` state (hidden on frontend) on failure.
      console.error('SDL List Section Sync — failed to initialise section:', error);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  PUBLIC INIT                                                       */
  /* ------------------------------------------------------------------ */

  function init() {
    const titles = document.querySelectorAll('.list-section-title');
    titles.forEach(function (el) {
      const section = el.closest('.page-section');
      if (!section || section.dataset.listSectionSync) return;

      const text = el.innerText;
      if (text.includes('{') && text.includes('}')) {
        initSection(section);
      } else {
        section.dataset.listSectionSync = 'false';
      }
    });
  }

  // Re-runnable for AJAX / dynamic page loads — already-tagged sections skip.
  window.sdlListSectionSync = { init: init };

  init();
}());
