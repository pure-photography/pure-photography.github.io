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
        '4. Current session price: The current shoot fee is $10 plus the $20 booking fee ($30 total). Current pricing through December 31, 2026; new pricing takes effect January 1, 2027 \u2014 book now to lock in current pricing!',
        '5. Photo protection guarantee and limit of liability: If photographs are lost because of SD card corruption or a camera malfunction, a free reshoot is guaranteed. The client understands that a session may not be possible to replicate, and if a reshoot cannot be done, the photographer\u2019s total liability is limited to a credit of the amount paid toward a future session. No cash refunds will be issued. Cameras, memory cards, and hard drives can fail without warning, and the photographer is not liable for data loss beyond this limit.',
        '6. Turnaround time varies. The client agrees to be flexible, and finished photos will be delivered.',
        '7. Gallery delivery may be by email or text. For email delivery, the client confirms the email address is valid and working. Photos are kept for 30 days and deleted if not successfully delivered within that time.',
        '8. Print prices: 5 \u00d7 7 \u2014 $20 each; 8 \u00d7 10 \u2014 $30 each; 11 \u00d7 14 \u2014 $50 each. Shipping and any applicable tax are confirmed separately.',
        '9. Photographer safety: The photographer reserves the right to end the session and leave the location at any time if she feels unsafe, uncomfortable, or is subjected to harassment of any kind, regardless of how many photographs have been captured. In such cases, no payments will be refunded.',
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
        '22. Force majeure: Neither party is liable for failure to perform due to events beyond reasonable control, including natural disasters, severe weather, fire, illness, or other emergencies. If the photographer cannot perform for these reasons, any payments made will be returned.',
        '23. Print and product use: Prints, photo books, and other physical products from Pure Photography \u2014 as well as the digital photographs \u2014 are for the client\u2019s personal enjoyment only. They may be given as gifts or displayed in the client\u2019s home. They may not be handed to any third party for commercial use, resale, or use in other merchandise.',
        '24. Artistic style: The client has viewed the photographer\u2019s portfolio and trusts the photographer\u2019s true-to-color, no-editing artistic style. The photographer has sole discretion over creative choices including posing, composition, and image selection.',
        '25. Governing law: This agreement is governed by the laws of South Carolina.',
        '26. Severability: If any term of this agreement is found unenforceable, the remaining terms stay in full effect.'
    ];
    // Contract terms for the free-shoot booking page (no payment terms).
    const freeShootTerms = [
        '1. Binding agreement: The photographer\'s signature on this agreement does not bind the contract \u2014 it simply shows that Mary Robinson is offering these terms and her photography services. This agreement becomes binding only when the client signs it.',
        '2. Free shoot: This session is completely free. There is no shoot fee and no booking fee \u2014 nothing is due at booking or on the day of the shoot.',
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
        '19. Force majeure: Neither party is liable for failure to perform due to events beyond reasonable control, including natural disasters, severe weather, fire, illness, or other emergencies.',
        '20. Print and product use: Prints, photo books, and other physical products from Pure Photography \u2014 as well as the digital photographs \u2014 are for the client\u2019s personal enjoyment only. They may be given as gifts or displayed in the client\u2019s home. They may not be handed to any third party for commercial use, resale, or use in other merchandise.',
        '21. Artistic style: The client has viewed the photographer\u2019s portfolio and trusts the photographer\u2019s true-to-color, no-editing artistic style. The photographer has sole discretion over creative choices including posing, composition, and image selection.',
        '22. Governing law: This agreement is governed by the laws of South Carolina.',
        '23. Severability: If any term of this agreement is found unenforceable, the remaining terms stay in full effect.'
    ];
        const bookingForm = document.querySelector('#booking-form');
    if (bookingForm) {
    const isFreeShoot = bookingForm.hasAttribute('data-free-shoot');
    const shootType = document.querySelector('#type');
    const phoneInput = document.querySelector('#phone');
    const deliveryEmail = document.querySelector('#gallery-by-email');
    const deliveryText = document.querySelector('#gallery-by-text');
    const dateInput = document.querySelector('#date');
    const waiverField = document.querySelector('#waiver-field');
    const waiverAgree = document.querySelector('#waiver-agree');
    // Free-shoot gate: Mary texts/DMs this code to free-shoot clients.
    // To change it, just tell Hannah the new code.
    const FREE_SHOOT_CODE = 'maryfree';

    // Preferred date can't be in the past (local date).
    try {
      if (dateInput) {
        var _dd = new Date();
        var _ddm = String(_dd.getMonth() + 1).padStart(2, '0');
        var _ddy = String(_dd.getDate()).padStart(2, '0');
        dateInput.min = _dd.getFullYear() + '-' + _ddm + '-' + _ddy;
      }
    } catch (e) {}

    function updateGalleryDelivery() {
      const textSelected = deliveryText.checked;
      phoneInput.required = textSelected;
    }

    [deliveryEmail, deliveryText].forEach(control => control.addEventListener('change', updateGalleryDelivery));
    updateGalleryDelivery();

    // Newborn/infant waiver: only shown when that shoot type is chosen.
    function updateWaiverVisibility() {
      if (!waiverField || !waiverAgree) return;
      const isNewborn = shootType.value === 'Newborn / Infant';
      waiverField.hidden = !isNewborn;
      waiverAgree.required = isNewborn;
      if (!isNewborn) waiverAgree.checked = false;
    }
    if (shootType) {
      shootType.addEventListener('change', updateWaiverVisibility);
      updateWaiverVisibility();
    }

    let pendingBooking = null;

    bookingForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (!f.reportValidity()) return;
      // Free-shoot gate: code must match what Mary sent by text/DM.
      if (isFreeShoot) {
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
      pendingBooking = {
        name: f.elements.name.value.trim(),
        email: f.elements.bookingEmail.value.trim(),
        phone: (f.elements.phone.value || '').trim() || 'Not provided',
        type: f.elements.type.value,
        date: f.elements.date.value,
        gallery: deliveryEmail.checked ? 'Email' : 'Text',
        message: f.elements.message.value.trim(),
        waiver: !!(waiverAgree && waiverAgree.checked)
      };
      document.querySelector('#booking-status').textContent = 'Thanks! One more step: please read and sign the client agreement. Your email app will then open with your booking request and signed agreement together.';
      openContractModal();
    });

    // ---- Contract modal (booking flow) ----
    // Dismissible: the client can close it, but the date isn't held
    // until the signed agreement is sent.
    const contractModalBackdrop = document.querySelector('#contract-modal-backdrop');
    const contractModal = document.querySelector('#contract-modal');
    const contractModalForm = document.querySelector('#contract-modal-form');
    const contractModalClose = document.querySelector('#contract-modal-close');
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

    function closeContractModal(signed) {
      if (!contractModalBackdrop || contractModalBackdrop.hidden) return;
      contractModalBackdrop.hidden = true;
      document.querySelectorAll('body > nav, body > main, body > footer').forEach(el => el.removeAttribute('inert'));
      document.body.classList.remove('modal-open');
      document.querySelector('#booking-status').textContent = signed
        ? 'All set! Your booking request and signed agreement are on their way \u2014 Mary will be in touch soon.'
        : 'Your date isn\u2019t held until the signed agreement is sent.';
      if (contractModalOpener && contractModalOpener.focus) contractModalOpener.focus({ preventScroll: true });
    }

    if (contractModalClose) {
      contractModalClose.addEventListener('click', () => closeContractModal(false));
    }

    if (contractModal) {
      // Trap focus inside the modal; Escape closes it (the date isn't held until signed).
      contractModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeContractModal(false);
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
        const activeTerms = isFreeShoot ? freeShootTerms : contractTerms;
        const btsSelf = contractModalForm.elements.btsSelf && contractModalForm.elements.btsSelf.checked ? 'Yes' : 'No';
        const btsChild = contractModalForm.elements.btsChild && contractModalForm.elements.btsChild.checked ? 'Yes' : 'No';
        const btsLine = '\nBehind-the-scenes video opt-in: self=' + btsSelf + ', child=' + btsChild + '.\n';
        const b = pendingBooking || {};
        const itemizedLines = isFreeShoot
          ? [
              'Shoot: ' + (b.type || '') + ' \u2014 FREE',
              'Booking fee \u2014 $0.00 (free shoot, nothing due)',
              'Total: $0.00'
            ]
          : [
              'Shoot: ' + (b.type || '') + ' \u2014 $10.00',
              'Booking fee \u2014 $20.00',
              'Total: $30.00'
            ];
        const pricingNote = isFreeShoot
          ? 'This is a FREE shoot \u2014 no shoot fee and no booking fee. Nothing is due.\n\n'
          : 'The current shoot fee is $10 plus the $20 booking fee ($30 total). Current pricing through December 31, 2026; new pricing takes effect January 1, 2027 \u2014 book now to lock in current pricing!\n\n';
        const subject = encodeURIComponent((isFreeShoot ? 'FREE shoot request from ' : 'Photo shoot request from ') + (b.name || signer) + ' \u2014 signed client agreement');
        const body = encodeURIComponent(
          'Hello Pure Photography,\n\nI would like to request a photo shoot.\n\n' +
          'Name: ' + (b.name || '') + '\nEmail: ' + (b.email || '') + '\nPhone: ' + (b.phone || '') + '\nPreferred date: ' + (b.date || '') + '\nShoot type: ' + (b.type || '') + '\nGallery delivery: ' + (b.gallery || '') +
          (b.waiver ? '\nNewborn/infant safety waiver: agreed (see waiver.html)' : '') +
          '\n\nItemized estimate:\n' + itemizedLines.join('\n') + '\n\n' + pricingNote +
          (b.message ? 'What the client is imagining:\n' + b.message + '\n\n' : '') +
          '--- Signed client agreement ---\n\nI have read and agree to the following terms:\n\n' + activeTerms.join('\n\n') +
          '\n\nPhotographer signature: Mary Robinson\n\nBy signing below, the client agrees to all terms in this contract.' + btsLine +
          'Client typed full name: ' + signer + '\nDate: ' + signedDate + '\nTimestamp: ' + timestamp + '\n'
        );
        modalStatus.textContent = 'Opening your email app with your booking request and signed agreement. Review them, then send the email to Pure Photography.';
        window.location.href = 'mailto:' + mailTo + '?subject=' + subject + '&body=' + body;
        setTimeout(function () {
          closeContractModal(true);
          var confirmation = document.querySelector('#booking-confirmation');
          if (confirmation && !isFreeShoot) {
            confirmation.hidden = false;
            confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 1500);
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
