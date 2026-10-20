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
    // LIMITED TIME: available until December 26, 2026 (Mary 2026-10-20).
    holidayCards: {
      id: 'holiday-cards',
      label: 'Holiday cards',
      detail: 'Pack of 40 cards made from your photos — you pick the photo(s)',
      price: 45,
      unit: 'per pack of 40',
      limitedTime: 'Available until December 26, 2026'
    },
    // Ceramic photo ornaments — LIMITED TIME until December 26, 2026
    // (Mary 2026-10-20: pricing confirmed, add to print store).
    ornaments: [
      { id: 'ornament-single', label: 'Photo ornament', detail: 'Ceramic ornament with your photo', price: 25, unit: 'each', limitedTime: 'Available until December 26, 2026' },
      { id: 'ornament-3pack', label: 'Photo ornament 3-pack', detail: 'Three ceramic ornaments with your photos', price: 60, unit: 'per 3-pack', limitedTime: 'Available until December 26, 2026' }
    ]
  };
})(window);
