/* Pure Photography — shared product catalog.
 *
 * Single source of truth for product pricing across every client gallery,
 * the card builder, and the booking page. ALL products are client-only:
 * no verified session = no purchase, no exceptions.
 *
 * Include this script before any order-form script:
 *   <script src="https://pure-photography.github.io/js/products.js"></script>
 */
(function (global) {
  'use strict';

  // Holiday window labels stay correct every year: "December 26" is the
  // same date annually, so the year part is computed, not hard-coded
  // (Mary 2026-10-20: ornaments/cards return each Oct 1 – Dec 26).
  var DEC26 = 'Available until December 26, ' + new Date().getFullYear();
  // POD holiday guidance: standard shipping needs ~2 weeks in December —
  // standard US orders must be placed by ~Dec 10 to land by Christmas
  // (Printify 2025 holiday dates; 2026 confirmed mid-October).
  var ORDERBY = 'Order by December 10 for Christmas delivery.';

  global.PurePhotoProducts = {
    // Individual photo prints — priced per photo, per size.
    prints: [
      { id: 'print-5x7',   label: '5 × 7 print',   price: 20 },
      { id: 'print-8x10',  label: '8 × 10 print',  price: 30 },
      { id: 'print-11x14', label: '11 × 14 print', price: 50 }
    ],
    // Wallet-size stickers — 80 stickers of EACH photo the client picks.
    stickers: {
      id: 'stickers',
      label: 'Wallet-size photo stickers',
      detail: '80 stickers of each photo you pick',
      price: 60,
      unit: 'per photo'
    },
    // Holiday / Christmas cards — pack of 40 from the client's photo(s).
    // The client picks the photo(s) from ANY of their previous sessions
    // via the card builder (card-builder.html).
    // LIMITED TIME: available until December 26 each year (Mary 2026-10-20).
    holidayCards: {
      id: 'holiday-cards',
      label: 'Holiday cards',
      detail: 'Pack of 40 cards made from your photos — you pick the photo(s). ' + ORDERBY,
      price: 45,
      unit: 'per pack of 40',
      limitedTime: DEC26
    },
    // Ceramic photo ornaments — LIMITED TIME until December 26 each year
    // (Mary 2026-10-20: pricing confirmed, add to print store).
    ornaments: [
      { id: 'ornament-single', label: 'Photo ornament', detail: 'Ceramic ornament with your photo. ' + ORDERBY, price: 25, unit: 'each', limitedTime: DEC26 },
      { id: 'ornament-3pack', label: 'Photo ornament 3-pack', detail: 'Three ceramic ornaments with your photos. ' + ORDERBY, price: 60, unit: 'per 3-pack', limitedTime: DEC26 }
    ]
  };

  // Holiday products (ornaments, holiday cards) are seasonal: visible
  // Oct 1 – Dec 26 each year, hidden Dec 27 – Sep 30 (Mary 2026-10-20).
  // Galleries should call this before rendering holiday items.
  global.PurePhotoProducts.holidayActive = function () {
    try {
      var now = new Date(), m = now.getMonth(), d = now.getDate();
      return (m === 9) || (m === 10) || (m === 11 && d <= 26);
    } catch (e) { return true; }
  };
})(window);
