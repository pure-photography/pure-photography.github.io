    document.querySelectorAll('[data-reel-embed]').forEach(card => {
      const poster = card.querySelector('.reel-poster');
      poster.addEventListener('click', () => {
        const frame = document.createElement('iframe');
        frame.src = card.dataset.reelEmbed;
        frame.title = card.dataset.reelTitle;
        frame.loading = 'lazy';
        frame.scrolling = 'no';
        frame.referrerPolicy = 'no-referrer';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
        frame.setAttribute('allow', 'encrypted-media; picture-in-picture');
        poster.replaceWith(frame);
        frame.focus();
      }, { once: true });
    });

        
    

    const mailTo = 'purephotography6@gmail.com';
    const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    // Contract terms shared by contract.html and the booking-page contract modal.
    const contractTerms = [
        '1. Binding agreement: The photographer\'s signature on this agreement does not bind the contract \u2014 it simply shows that Mary Robinson is offering these terms and her photography services. This agreement becomes binding only when the client signs it.',
        '2. Booking fee: A $20 nonrefundable booking fee is due within 24 hours of requesting your shoot date to reserve it. If the booking fee is not received within 24 hours, the booking will be canceled and the date released.',
        '3. All payments are nonrefundable.',
        '4. Current session price: The current shoot fee is $10 plus the $20 booking fee ($30 total). Effective 12:00 AM EST on December 31, 2026, the shoot fee goes up to $50 ($70 total with the $20 booking fee) \u2014 book now to lock in current pricing!',
        '5. Photo protection guarantee and limit of liability: If photographs are lost because of SD card corruption or a camera malfunction, a free reshoot is guaranteed. The client understands that a session may not be possible to replicate, and if a reshoot cannot be done, the photographer\u2019s total liability is limited to a credit of the amount paid toward a future session. No cash refunds will be issued. Cameras, memory cards, and hard drives can fail without warning, and the photographer is not liable for data loss beyond this limit.',
        '6. Turnaround time varies. The client agrees to be flexible, and finished photos will be delivered.',
        '7. Gallery delivery may be by email or text. For email delivery, the client confirms the email address is valid and working. Photos are kept for 30 days and deleted if not successfully delivered within that time.',
        '8. Print prices: 5 \u00d7 7 \u2014 $20 each; 8 \u00d7 10 \u2014 $30 each; 11 \u00d7 14 \u2014 $50 each. Shipping and any applicable tax are confirmed separately.',
        '9. Photographer safety: The photographer reserves the right to end the session and leave the location at any time if she feels unsafe, uncomfortable, or is subjected to harassment of any kind, regardless of how many photographs have been captured. In such cases, the booking fee is nonrefundable.',
        '10. Rescheduling: Clients who need to reschedule must provide at least 72 hours\u2019 notice before the scheduled start time.',
        '11. Copyright and usage: Mary Robinson retains full copyright to all photographs. The client receives a non-exclusive license for personal, non-commercial use only \u2014 this includes sharing on personal social media and printing for home display. Any commercial use, publication, distribution, sale, or use by a third party requires a separate written license and fee. The client agrees not to alter the photographs in any way, including applying filters, cropping out watermarks, or retouching.',
        '12. Model release and social media: By signing this agreement, the client gives the photographer permission to photograph the session. Finished photographs may be used in the photographer\u2019s portfolio or posted to the photographer\u2019s social media accounts, subject to the children\u2019s privacy term below.',
        '13. Minors: The photographer does not photograph anyone under age 18 unless a parent or legal guardian is present throughout the session.',
        '14. Children\u2019s privacy: Children\u2019s privacy matters to me, and I love capturing the joy of working with little ones. If you\u2019d prefer your child\u2019s finished photographs stay off social media and my portfolio, let me know in writing before the shoot and I will honor that.',
        '15. Behind the scenes video (optional): Mary sometimes records short behind-the-scenes clips on wearable glasses during sessions. Behind-the-scenes video is recorded ONLY if the client opts in using the checkboxes below. The client may withdraw consent at any time, including during the session.',
        '16. Late arrivals and no-shows: If you\u2019re running late, please text the photographer as soon as possible. If 10 minutes have passed after the scheduled start time with no contact, the photographer will call twice and, if there is no answer, begin packing up. The client will also receive one text notification. At 15 minutes with no text explaining the delay, the photographer will consider the appointment a no-call/no-show. The photographer will wait no longer than 30 minutes after the scheduled start time and will then leave. There is currently no fee for arriving late; however, a client who no-call/no-shows will be charged a $100 fee to compensate for the reserved time.',
        '17. Photo delivery: The client will receive all of the best photographs from the session, as selected at the photographer\u2019s discretion.',
        '18. Photographer cancellation: If the photographer\u2019s ride falls through, she will call or text the client as soon as possible. If the photographer must cancel because of transportation issues or an emergency, the client will receive a free reschedule.',
        '19. Weather: If weather conditions, such as rain, prevent an outdoor shoot from taking place, the client will receive a free reschedule.',
        '20. Balance due: The $10 shoot fee is due on the day of the shoot and must be paid as soon as the session is over.',
        '21. Shoot location: The photographer does not operate a studio. Sessions take place in the client\u2019s home, outdoors at the client\u2019s home, or at another location chosen by the client. If the selected location requires a permit or permission, the client is responsible for securing it before the shoot date.',
        '22. Force majeure: Neither party is liable for failure to perform due to events beyond reasonable control, including natural disasters, severe weather, fire, illness, or other emergencies. If the photographer cannot perform for these reasons, any payments made will be returned.'
    ];
    // Contract terms for the free-shoot booking page (no payment terms).
    const freeShootTerms = [
        '1. Binding agreement: The photographer\'s signature on this agreement does not bind the contract \u2014 it simply shows that Mary Robinson is offering these terms and her photography services. This agreement becomes binding only when the client signs it.',
        '2. Free shoot: This session is completely free. There is no shoot fee and no retainer \u2014 nothing is due at booking or on the day of the shoot.',
        '3. Photo protection guarantee and limit of liability: If photographs are lost because of SD card corruption or a camera malfunction, a free reshoot is guaranteed. The client understands that a session may not be possible to replicate. Cameras, memory cards, and hard drives can fail without warning.',
        '4. Turnaround time varies. The client agrees to be flexible, and finished photos will be delivered.',
        '5. Gallery delivery may be by email or text. For email delivery, the client confirms the email address is valid and working. Photos are kept for 30 days and deleted if not successfully delivered within that time.',
        '6. Print prices: 5 \u00d7 7 \u2014 $20 each; 8 \u00d7 10 \u2014 $30 each; 11 \u00d7 14 \u2014 $50 each. Shipping and any applicable tax are confirmed separately.',
        '7. Photographer safety: The photographer reserves the right to end the session and leave the location at any time if she feels unsafe, uncomfortable, or is subjected to harassment of any kind, regardless of how many photographs have been captured.',
        '8. Rescheduling: Clients who need to reschedule must provide at least 72 hours\u2019 notice before the scheduled start time.',
        '9. Copyright and usage: Mary Robinson retains full copyright to all photographs. The client receives a non-exclusive license for personal, non-commercial use only \u2014 this includes sharing on personal social media and printing for home display. Any commercial use, publication, distribution, sale, or use by a third party requires a separate written license and fee. The client agrees not to alter the photographs in any way, including applying filters, cropping out watermarks, or retouching.',
        '10. Model release and social media: By signing this agreement, the client gives the photographer permission to photograph the session. Finished photographs may be used in the photographer\u2019s portfolio or posted to the photographer\u2019s social media accounts, subject to the children\u2019s privacy term below.',
        '11. Minors: The photographer does not photograph anyone under age 18 unless a parent or legal guardian is present throughout the session.',
        '12. Children\u2019s privacy: Children\u2019s privacy matters to me, and I love capturing the joy of working with little ones. If you\u2019d prefer your child\u2019s finished photographs stay off social media and my portfolio, let me know in writing before the shoot and I will honor that.',
        '13. Behind the scenes video (optional): Mary sometimes records short behind-the-scenes clips on wearable glasses during sessions. Behind-the-scenes video is recorded ONLY if the client opts in using the checkboxes below. The client may withdraw consent at any time, including during the session.',
        '14. Late arrivals and no-shows: If you\u2019re running late, please text the photographer as soon as possible. If 10 minutes have passed after the scheduled start time with no contact, the photographer will call twice and, if there is no answer, begin packing up. The client will also receive one text notification. At 15 minutes with no text explaining the delay, the photographer will consider the appointment a no-call/no-show. The photographer will wait no longer than 30 minutes after the scheduled start time and will then leave. A client who no-call/no-shows for a free shoot may not be offered another free session.',
        '15. Photo delivery: The client will receive all of the best photographs from the session, as selected at the photographer\u2019s discretion.',
        '16. Photographer cancellation: If the photographer\u2019s ride falls through, she will call or text the client as soon as possible. If the photographer must cancel because of transportation issues or an emergency, the client will receive a free reschedule.',
        '17. Weather: If weather conditions, such as rain, prevent an outdoor shoot from taking place, the client will receive a free reschedule.',
        '18. Shoot location: The photographer does not operate a studio. Sessions take place in the client\u2019s home, outdoors at the client\u2019s home, or at another location chosen by the client. If the selected location requires a permit or permission, the client is responsible for securing it before the shoot date.',
        '19. Force majeure: Neither party is liable for failure to perform due to events beyond reasonable control, including natural disasters, severe weather, fire, illness, or other emergencies.'
    ];
        const bookingForm = document.querySelector('#booking-form');
    if (bookingForm) {
    const shootType = document.querySelector('#type');
    const shootPrice = 10;
    const phoneInput = document.querySelector('#phone');
    const galleryEmailInput = document.querySelector('#gallery-email');
    const emailAgreement = document.querySelector('#email-valid-agreement');
    const deliveryEmail = document.querySelector('#gallery-by-email');
    const deliveryText = document.querySelector('#gallery-by-text');
    const printAddons = [
      { input: document.querySelector('#qty-5x7'), line: document.querySelector('#line-5x7'), label: document.querySelector('#label-5x7'), amount: document.querySelector('#amount-5x7'), name: '5 × 7 print', price: 20 },
      { input: document.querySelector('#qty-8x10'), line: document.querySelector('#line-8x10'), label: document.querySelector('#label-8x10'), amount: document.querySelector('#amount-8x10'), name: '8 × 10 print', price: 30 },
      { input: document.querySelector('#qty-11x14'), line: document.querySelector('#line-11x14'), label: document.querySelector('#label-11x14'), amount: document.querySelector('#amount-11x14'), name: '11 × 14 print', price: 50 }
    ];
    // Free-shoot gate: Mary texts/DMs this code to free-shoot clients.
    // To change it, just tell Hannah the new code.
    const FREE_SHOOT_CODE = 'maryfree';
    // Free-shoot booking page has no price calculator — skip all estimate logic there.
    const hasCalculator = printAddons.every(item => item.input && item.line && item.label && item.amount);
    const estimateSessionName = document.querySelector('#estimate-session-name');
    const estimateSessionPrice = document.querySelector('#estimate-session-price');
    const estimateTotal = document.querySelector('#estimate-total');
    const copyTotal = document.querySelector('#copy-total');
    const copyConfirmation = document.querySelector('#copy-confirmation');

    function currentEstimate() {
      if (!hasCalculator) {
        return { sessionPrice: 0, retainer: 0, addons: [], printsTotal: 0, hasSessionPrice: true, total: 0, freeShoot: true };
      }
      const sessionPrice = shootPrice;
      const addons = printAddons.map(item => {
        const quantity = Math.max(0, Math.floor(Number(item.input.value) || 0));
        return { ...item, quantity, subtotal: quantity * item.price };
      });
      const printsTotal = addons.reduce((sum, item) => sum + item.subtotal, 0);
      const hasSessionPrice = sessionPrice !== null && Number.isFinite(sessionPrice) && sessionPrice > 0;
      const retainer = 20;
      return { sessionPrice, retainer, addons, printsTotal, hasSessionPrice, total: hasSessionPrice ? sessionPrice + retainer + printsTotal : null };
    }

    function updateEstimate() {
      const estimate = currentEstimate();
      estimateSessionName.textContent = shootType.value ? shootType.value + ' shoot' : 'Shoot price';
      estimateSessionPrice.textContent = estimate.hasSessionPrice ? dollars.format(estimate.sessionPrice) : 'Not entered';
      estimate.addons.forEach(item => {
        item.line.hidden = item.quantity === 0;
        item.label.textContent = item.name + (item.quantity === 1 ? '' : 's') + ' × ' + item.quantity;
        item.amount.textContent = dollars.format(item.subtotal);
      });
      estimateTotal.textContent = estimate.hasSessionPrice ? dollars.format(estimate.total) : '—';
      copyTotal.disabled = !estimate.hasSessionPrice;
      copyConfirmation.textContent = '';
    }

    [shootType, ...printAddons.map(item => item.input)].forEach(control => { if (control) control.addEventListener('input', updateEstimate); });
    if (hasCalculator) updateEstimate();

    if (copyTotal) copyTotal.addEventListener('click', () => {
      const estimate = currentEstimate();
      if (!estimate.hasSessionPrice) return;
      const text = dollars.format(estimate.total);
      const temporary = document.createElement('textarea');
      temporary.value = text;
      temporary.setAttribute('readonly', '');
      temporary.setAttribute('aria-hidden', 'true');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.appendChild(temporary);
      temporary.select();
      const copied = document.execCommand('copy');
      temporary.remove();
      copyConfirmation.textContent = copied ? text + ' copied. You can paste it into PayPal’s payment field.' : 'The total could not be copied. Please select and copy ' + text + '.';
    });

    function updateGalleryDelivery() {
      const emailSelected = deliveryEmail.checked;
      const textSelected = deliveryText.checked;
      emailAgreement.disabled = !emailSelected;
      emailAgreement.required = emailSelected;
      if (!emailSelected) emailAgreement.checked = false;
      galleryEmailInput.disabled = !emailSelected || !emailAgreement.checked;
      galleryEmailInput.required = emailSelected;
      phoneInput.required = textSelected;
    }

    [deliveryEmail, deliveryText, emailAgreement].forEach(control => control.addEventListener('change', updateGalleryDelivery));
    updateGalleryDelivery();

    bookingForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (!f.reportValidity()) return;
      const estimate = currentEstimate();
      // Free-shoot gate: code must match what Mary sent by text/DM.
      if (estimate.freeShoot) {
        const codeInput = document.querySelector('#free-shoot-code');
        const codeStatus = document.querySelector('#free-shoot-code-status');
        const entered = (codeInput && codeInput.value || '').trim().toLowerCase();
        if (entered !== FREE_SHOOT_CODE) {
          if (codeStatus) codeStatus.textContent = 'That code doesn\u2019t match. Please check the code Mary sent you by text or DM and try again.';
          if (codeInput) { codeInput.focus(); codeInput.select(); }
          return;
        }
        if (codeStatus) codeStatus.textContent = '';
      }
      const selectedAddons = estimate.addons.filter(item => item.quantity > 0);
      const itemizedLines = estimate.freeShoot
        ? [
            'Shoot: ' + f.elements.type.value + ' — FREE',
            'Booking retainer — $0.00 (free shoot, nothing due)',
            'Total: $0.00'
          ]
        : [
            'Shoot: ' + f.elements.type.value + ' — ' + (estimate.hasSessionPrice ? dollars.format(estimate.sessionPrice) : 'Price to be confirmed'),
            'Booking retainer — ' + dollars.format(estimate.retainer),
            ...selectedAddons.map(item => item.name + (item.quantity === 1 ? '' : 's') + ' × ' + item.quantity + ' — ' + dollars.format(item.subtotal))
          ];
      if (!estimate.freeShoot && !selectedAddons.length) itemizedLines.push('Print add-ons: None');
      if (!estimate.freeShoot) itemizedLines.push('Total: ' + (estimate.hasSessionPrice ? dollars.format(estimate.total) : 'To be confirmed'));
      const galleryDelivery = deliveryEmail.checked ? 'Email to ' + galleryEmailInput.value : 'Text to ' + phoneInput.value;
      const subject = encodeURIComponent((estimate.freeShoot ? 'FREE shoot request from ' : 'Photo shoot request from ') + f.elements.name.value);
      const pricingNote = estimate.freeShoot
        ? 'This is a FREE shoot — no shoot fee and no retainer. Nothing is due.\n\nDetails:\n'
        : 'The current shoot fee is $10 plus the $20 retainer ($30 total). The shoot fee goes up to $50 on New Year\'s Eve at midnight ($70 total with the $20 retainer) — book now to lock in current pricing!\n\nDetails:\n';
      const body = encodeURIComponent('Hello Pure Photography,\n\nI would like to request a photo shoot.\n\nName: ' + f.elements.name.value + '\nPhone: ' + (f.elements.phone.value || 'Not provided') + '\nPreferred date: ' + f.elements.date.value + '\nGallery delivery: ' + galleryDelivery + '\n\nItemized estimate:\n' + itemizedLines.join('\n') + '\n\n' + pricingNote + f.elements.message.value + '\n');
      document.querySelector('#booking-status').textContent = 'Thanks for booking! Your email app is opening \u2014 please read and sign the contract below to finish.';
      setTimeout(() => {
        window.location.href = 'mailto:' + mailTo + '?subject=' + subject + '&body=' + body;
      }, 250);
      openContractModal();
    });

    // ---- Blocking contract modal (booking flow) ----
    // No close button, ESC is swallowed, backdrop clicks do nothing:
    // the client must read and sign before continuing.
    const contractModalBackdrop = document.querySelector('#contract-modal-backdrop');
    const contractModal = document.querySelector('#contract-modal');
    const contractModalForm = document.querySelector('#contract-modal-form');
    let contractModalOpener = null;

    function openContractModal() {
      if (!contractModalBackdrop || !contractModalBackdrop.hidden) return;
      contractModalOpener = document.activeElement;
      contractModalBackdrop.hidden = false;
      document.querySelectorAll('body > nav, body > main, body > footer').forEach(el => el.setAttribute('inert', ''));
      document.body.classList.add('modal-open');
      contractModal.scrollTop = 0;
      const modalInner = contractModal.querySelector('.contract-modal-inner');
      if (modalInner) modalInner.scrollTop = 0;
      const modalTitle = document.querySelector('#contract-modal-title');
      if (modalTitle) modalTitle.focus({ preventScroll: true });
    }

    function closeContractModal() {
      if (!contractModalBackdrop || contractModalBackdrop.hidden) return;
      contractModalBackdrop.hidden = true;
      document.querySelectorAll('body > nav, body > main, body > footer').forEach(el => el.removeAttribute('inert'));
      document.body.classList.remove('modal-open');
      document.querySelector('#booking-status').textContent = 'All set! Your booking request and signed contract are on their way \u2014 Mary will be in touch soon.';
      if (contractModalOpener && contractModalOpener.focus) contractModalOpener.focus({ preventScroll: true });
    }

    if (contractModal) {
      // Trap focus inside the modal and swallow Escape (it must stay open until signed).
      contractModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(contractModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter(el => !el.disabled && !el.hidden && el.closest('[hidden]') === null);
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    }

    if (contractModalForm) {
      const modalConsent = contractModalForm.elements.agreementConsent;
      const modalNameField = contractModalForm.elements.agreementName;
      const modalDateField = contractModalForm.elements.agreementDate;
      const modalSignatureFields = document.querySelector('#contract-modal-signature-fields');
      const modalStatus = document.querySelector('#contract-modal-status');
      function setModalSignatureFieldsVisible(visible) {
        modalSignatureFields.hidden = !visible;
        modalConsent.setAttribute('aria-expanded', String(visible));
        modalNameField.required = visible;
        modalDateField.required = visible;
        if (visible) {
          modalStatus.textContent = 'Thanks for reading the terms! Your signature line is now showing below \u2014 please type your full name and today\u2019s date.';
        } else {
          modalNameField.value = '';
          modalDateField.value = '';
        }
      }
      setModalSignatureFieldsVisible(false);
      modalConsent.addEventListener('change', () => setModalSignatureFieldsVisible(modalConsent.checked));
      contractModalForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!contractModalForm.reportValidity()) return;
        const signer = contractModalForm.elements.agreementName.value.trim();
        const signedDate = contractModalForm.elements.agreementDate.value;
        const timestamp = new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' });
        const subject = encodeURIComponent('Signed client agreement: ' + signer);
        const activeTerms = (typeof hasCalculator !== 'undefined' && !hasCalculator) ? freeShootTerms : contractTerms;
        const btsSelf = contractModalForm.elements.btsSelf && contractModalForm.elements.btsSelf.checked ? 'Yes' : 'No';
        const btsChild = contractModalForm.elements.btsChild && contractModalForm.elements.btsChild.checked ? 'Yes' : 'No';
        const btsLine = '\nBehind-the-scenes video opt-in: self=' + btsSelf + ', child=' + btsChild + '.\n';
        const body = encodeURIComponent('Hello Pure Photography,\n\nI have read and agree to the following terms:\n\n' + activeTerms.join('\n\n') + '\n\nPhotographer signature: Mary Robinson\n\nBy signing below, the client agrees to all terms in this contract.' + btsLine + 'Client typed full name: ' + signer + '\nDate: ' + signedDate + '\nTimestamp: ' + timestamp + '\n');
        modalStatus.textContent = 'Opening your email app with the signed agreement. Review it, then send it to Pure Photography.';
        window.location.href = 'mailto:' + mailTo + '?subject=' + subject + '&body=' + body;
        setTimeout(closeContractModal, 1500);
      });
    }

    }
    const agreementForm = document.querySelector('#agreement-form');
    if (agreementForm) {
    const agreementConsent = agreementForm.elements.agreementConsent;
    const agreementNameField = agreementForm.elements.agreementName;
    const agreementDateField = agreementForm.elements.agreementDate;
    const signatureFields = document.querySelector('#signature-fields');
    const agreementStatus = document.querySelector('#agreement-status');
    function setSignatureFieldsVisible(visible) {
      signatureFields.hidden = !visible;
      agreementConsent.setAttribute('aria-expanded', String(visible));
      agreementNameField.required = visible;
      agreementDateField.required = visible;
      if (visible) {
        agreementStatus.textContent = 'Thanks for reading the terms! Your signature line is now showing below \u2014 please type your full name and today\u2019s date.';
      } else {
        agreementNameField.value = '';
        agreementDateField.value = '';
      }
    }
    setSignatureFieldsVisible(false);
    agreementConsent.addEventListener('change', () => setSignatureFieldsVisible(agreementConsent.checked));
    agreementForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!agreementForm.reportValidity()) return;
      const signer = agreementForm.elements.agreementName.value.trim();
      const signedDate = agreementForm.elements.agreementDate.value;
      const timestamp = new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' });
      const subject = encodeURIComponent('Signed client agreement: ' + signer);
      const btsSelf = agreementForm.elements.btsSelf && agreementForm.elements.btsSelf.checked ? 'Yes' : 'No';
      const btsChild = agreementForm.elements.btsChild && agreementForm.elements.btsChild.checked ? 'Yes' : 'No';
      const btsLine = '\nBehind-the-scenes video opt-in: self=' + btsSelf + ', child=' + btsChild + '.\n';
      const body = encodeURIComponent('Hello Pure Photography,\n\nI have read and agree to the following terms:\n\n' + contractTerms.join('\n\n') + '\n\nPhotographer signature: Mary Robinson\n\nBy signing below, the client agrees to all terms in this contract.' + btsLine + 'Client typed full name: ' + signer + '\nDate: ' + signedDate + '\nTimestamp: ' + timestamp + '\n');
      document.querySelector('#agreement-status').textContent = 'Opening your email app with the signed agreement. Review it, then send it to Pure Photography.';
      window.location.href = 'mailto:' + mailTo + '?subject=' + subject + '&body=' + body;
    });

    }
    const dialog = document.querySelector('#lightbox');
    if (dialog) {
    const lightboxImage = document.querySelector('#lightbox-image');
    const lightboxCaption = document.querySelector('#lightbox-caption');
    document.querySelectorAll('.shot button').forEach(button => button.addEventListener('click', () => {
      const thumb = button.querySelector('img');
      lightboxImage.src = button.dataset.full; lightboxImage.alt = thumb.alt;
      lightboxCaption.textContent = button.dataset.caption; dialog.showModal();
    }));
    dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    }

    // Show the booking->contract notice when arriving from the booking page.
    (function () {
      var notice = document.querySelector('#booking-contract-notice');
      if (notice && /[?&]from=booking/.test(window.location.search)) {
        notice.hidden = false;
        notice.focus({ preventScroll: true });
      }
    })();

    // US-only banner fades after 30 seconds.
    (function () {
      var banner = document.querySelector('.us-only-banner');
      if (banner) {
        setTimeout(function () {
          banner.style.transition = 'opacity 1s ease';
          banner.style.opacity = '0';
          setTimeout(function () { banner.style.display = 'none'; }, 1000);
        }, 30000);
      }
    })();
