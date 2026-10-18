#!/usr/bin/env python3
"""Build multi-page Pure Photography site from single-page source.

Reads ~/workspace/site-live/index.html, outputs to ~/workspace/site-new/.
"""
import re, os, base64, shutil, html

SRC = os.path.expanduser('~/workspace/site-live')
DST = os.path.expanduser('~/workspace/site-new')
MAILING_LIST_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeGV3Y2m8BORvzlky1mNiB4UQwvLIFvXggDLFZbW6F-uoHqqA/viewform'

# Per-page SEO (from the SPA router's pageTitles/pageDescriptions)
PAGES = {
    'index': {
        'file': 'index.html',
        'title': 'Pure Photography | Portrait Photographer in York, SC',
        'desc': 'Warm, affordable photography in York, South Carolina, serving families, portraits, seniors, baptisms, and events across Rock Hill, Clover, and Lake Wylie.',
        'nav': 'Home',
    },
    'portfolio': {
        'file': 'portfolio.html',
        'title': 'Family & Baptism Photographer York County | Portfolio',
        'desc': 'View family, portrait, graduation, couples, and baptism photography by Pure Photography, serving York County and nearby South Carolina communities.',
        'nav': 'Portfolio',
    },
    'behind-scenes': {
        'file': 'behind-scenes.html',
        'title': 'Behind the Scenes | Photographer York SC',
        'desc': 'Go behind the scenes with a York, South Carolina photographer during church, family, portrait, and event photo sessions.',
        'nav': 'Behind the scenes',
    },
    'about': {
        'file': 'about.html',
        'title': 'About Mary | Portrait Photographer Clover SC',
        'desc': 'Meet Mary Robinson of Pure Photography and learn about her natural, unretouched approach to portrait photography in Clover, York, and Rock Hill, South Carolina.',
        'nav': 'About',
    },
    'services': {
        'file': 'services.html',
        'title': 'Affordable Photographer South Carolina | Services & Pricing',
        'desc': 'Affordable family, portrait, senior, pet, and event photography serving York, Rock Hill, Clover, and the South Carolina side of Lake Wylie.',
        'nav': 'Services & pricing',
    },
    'booking': {
        'file': 'booking.html',
        'title': 'Book a Family Photographer Rock Hill SC | Pure Photography',
        'desc': 'Book a family, portrait, senior, pet, baptism, or event photographer serving Rock Hill, York, Clover, and Lake Wylie, South Carolina.',
        'nav': 'Book a shoot',
    },
    'contract': {
        'file': 'contract.html',
        'title': 'Photography Client Contract | Pure Photography',
        'desc': 'Review and sign the Pure Photography client agreement for portrait, family, senior, baptism, and event photography in York, South Carolina.',
        'nav': 'Contract',
    },
    'contact': {
        'file': 'contact.html',
        'title': 'Contact a Photographer in York SC | Pure Photography',
        'desc': 'Contact Pure Photography at 803-630-7835 for affordable photography in York, Rock Hill, Clover, and Lake Wylie, South Carolina.',
        'nav': 'Contact',
    },
    'baptism-guide': {
        'file': 'baptism-guide.html',
        'title': 'Baptismal Guide | Pure Photography',
        'desc': 'A simple guide to baptism — what it means, what the Bible says, and what to bring.',
        'nav': 'Baptism Guide',
    },
}

# Which data-page sections go on which page.
# data-page values in source: home, behind-scenes, about, services, contract, book, contact, baptism-guide
PAGE_SECTIONS = {
    'index': ['home'],            # motto, hero, featured, process, testimonials + mailing list + hub buttons
    'portfolio': ['home-portfolio'],  # featured gallery section only (special-cased below)
    'behind-scenes': ['behind-scenes'],
    'about': ['about'],
    'services': ['services'],
    'booking': ['book'],
    'contract': ['contract'],
    'contact': ['contact'],
    'baptism-guide': ['baptism-guide'],
}

# Map old #hash links to new pages
HASH_MAP = {
    '#home': 'index.html', '#portfolio': 'portfolio.html',
    '#behind-scenes': 'behind-scenes.html', '#about': 'about.html',
    '#services': 'services.html', '#book': 'booking.html', '#booking': 'booking.html',
    '#contract': 'contract.html', '#agreement': 'contract.html',
    '#contact': 'contact.html', '#baptism-guide': 'baptism-guide.html',
    '#instagram-feed': 'index.html', '#clients': 'services.html',
}

def main():
    with open(os.path.join(SRC, 'index.html'), encoding='utf-8') as f:
        src = f.read()

    os.makedirs(DST, exist_ok=True)
    os.makedirs(os.path.join(DST, 'video'), exist_ok=True)

    # ---- 1. Extract videos (base64 -> files) ----
    video_names = ['baptism-slideshow.mp4', 'bts-1.mp4', 'bts-2.mp4', 'bts-3.mp4', 'bts-4.mp4', 'bts-5.mp4']
    vids = list(re.finditer(r'<source src="data:application/octet-stream;base64,([A-Za-z0-9+/=]+)"', src))
    assert len(vids) == 6, f'expected 6 embedded videos, found {len(vids)}'
    for m, name in zip(vids, video_names):
        data = base64.b64decode(m.group(1))
        with open(os.path.join(DST, 'video', name), 'wb') as f:
            f.write(data)
        print(f'wrote video/{name} ({len(data)} bytes)')
    # Replace base64 sources with file paths
    for m, name in zip(vids, video_names):
        src = src.replace(m.group(0), f'<source src="video/{name}" type="video/mp4"', 1)

    # ---- 2. Extract CSS -> styles.css ----
    styles = re.findall(r'<style>(.*?)</style>', src, re.DOTALL)
    assert len(styles) == 2, f'expected 2 style blocks, found {len(styles)}'
    css = '\n'.join(styles)
    # The SPA hid non-active pages; multi-page doesn't need it. Keep harmless.
    # Allow the motto banner to use a <p> on inner pages (same styling as h1).
    css += '\n.motto-banner .motto-line{font-family:\'Libre Baskerville\',serif;font-size:clamp(1.45rem,3vw,2.4rem);font-weight:400;line-height:1.2;letter-spacing:-.02em;margin:0}\n'
    # Hub buttons grid for the homepage
    css += ('.page-hub{background:var(--surface)}.hub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;max-width:860px;margin:0 auto}'
            '.hub-grid a{display:flex;align-items:center;justify-content:center;min-height:64px;padding:1rem;border:1px solid var(--line);background:var(--bg);font-weight:700;text-decoration:none;border-radius:.3rem;text-align:center}'
            '.hub-grid a:hover{border-color:var(--accent);color:var(--accent)}'
            '@media(max-width:600px){.hub-grid{grid-template-columns:1fr 1fr}}\n')
    # Mailing list section
    css += ('.mailing{background:var(--accent-soft);text-align:center}.mailing-inner{max-width:660px;margin:0 auto}'
            '.mailing h2{font-family:\'Libre Baskerville\',serif;font-size:clamp(1.6rem,3.2vw,2.3rem);margin:0 0 .8rem}'
            '.mailing p{margin:0 0 1.6rem}\n')
    with open(os.path.join(DST, 'styles.css'), 'w', encoding='utf-8') as f:
        f.write(css)
    print(f'wrote styles.css ({len(css)} chars)')

    # ---- 3. Extract sections by data-page ----
    sections = {}
    for m in re.finditer(r'<section[^>]*data-page="([^"]*)"[^>]*>.*?</section>', src, re.DOTALL):
        dp = m.group(1)
        sections.setdefault(dp, []).append(m.group(0))
    # Motto banner (separate div, data-page="home") -> prepended to every page
    m_motto = re.search(r'<div class="motto-banner" data-page="home">.*?</div>', src, re.DOTALL)
    motto_banner = re.sub(r'\sdata-page="[^"]*"', '', m_motto.group(0))
    # Inner-page version: <p> instead of <h1> (one h1 per page for SEO)
    motto_inner = re.sub(
        r'(<div class="motto-banner">\s*)<h1 id="hero-title">(.*?)</h1>',
        r'\1<p class="motto-line">\2</p>', motto_banner)
    print('data-page groups:', {k: len(v) for k, v in sections.items()})

    # Also grab body-level banners (bookings banner, pricing banner, us-only banner)
    banners = ''
    for m in re.finditer(r'<p class="bookings-banner".*?</p>|<p class="pricing-banner".*?</p>|<div class="us-only-banner".*?</div>', src, re.DOTALL):
        banners += m.group(0) + '\n'
    # Footer
    footer = re.search(r'<footer>.*?</footer>', src, re.DOTALL).group(0)
    # Lightbox dialog
    lightbox = re.search(r'<dialog id="lightbox".*?</dialog>', src, re.DOTALL).group(0)
    # True AI widget HTML (from <div class="trueai-widget"> to its closing </div>)
    trueai_html = re.search(r'<div class="trueai-widget">.*?</div>\s*</div>', src, re.DOTALL).group(0)
    # JSON-LD
    jsonld = re.search(r'<script type="application/ld\+json">.*?</script>', src, re.DOTALL).group(0)

    # ---- 4. Build main.js ----
    main_js = build_main_js(src)

    # ---- 5. Build True AI JS ----
    trueai_js = build_trueai_js(src)

    with open(os.path.join(DST, 'main.js'), 'w', encoding='utf-8') as f:
        f.write(main_js)
    with open(os.path.join(DST, 'trueai.js'), 'w', encoding='utf-8') as f:
        f.write(trueai_js)
    print(f'wrote main.js ({len(main_js)} chars), trueai.js ({len(trueai_js)} chars)')

    # ---- 6. Build pages ----
    # Extract the featured-portfolio section (data-page="home", class="portfolio") for portfolio.html
    home_sections = sections.get('home', [])
    portfolio_section = [s for s in home_sections if 'class="portfolio"' in s][0]
    other_home = [s for s in home_sections if 'class="portfolio"' not in s]

    page_bodies = {
        'index': other_home,  # motto, hero, process, testimonials (portfolio handled separately)
        'portfolio': [portfolio_section],
        'behind-scenes': sections.get('behind-scenes', []),
        'about': sections.get('about', []),
        'services': sections.get('services', []),
        'booking': sections.get('book', []),
        'contract': sections.get('contract', []),
        'contact': sections.get('contact', []),
        'baptism-guide': sections.get('baptism-guide', []),
    }

    for key, meta in PAGES.items():
        body_sections = list(page_bodies[key])
        # strip data-page/hidden attributes (no longer needed)
        cleaned = []
        for s in body_sections:
            s = re.sub(r'\sdata-page="[^"]*"', '', s)
            s = re.sub(r'\shidden(?=[\s>])', '', s)
            cleaned.append(s)
        # Pink motto banner on every page (h1 on home, <p> on inner pages)
        banner_html = motto_banner if key == 'index' else motto_inner
        body_html = banner_html + '\n' + '\n'.join(cleaned)
        # Inner pages: promote the first <h2> to <h1> (one h1 per page for SEO)
        if key != 'index':
            body_html = re.sub(r'<h2', '<h1', body_html, count=1)
            # match the corresponding closing tag: find first </h2> after the new <h1>
            h1pos = body_html.find('<h1')
            cpos = body_html.find('</h2>', h1pos)
            # make sure we close the right one: it must come before any other <h1 or <h2
            next_h = body_html.find('<h', h1pos + 3)
            if cpos != -1 and (next_h == -1 or cpos < next_h):
                body_html = body_html[:cpos] + '</h1>' + body_html[cpos + 5:]

        # Homepage extras: hub buttons + mailing list section
        extras = ''
        if key == 'index':
            extras = homepage_extras()
        # Fix internal hash links
        body_html = fix_links(body_html)
        full = page_template(meta, banners, body_html, extras, footer, lightbox, trueai_html, jsonld if key == 'index' else '')
        with open(os.path.join(DST, meta['file']), 'w', encoding='utf-8') as f:
            f.write(full)
        print(f"wrote {meta['file']} ({len(full)} chars)")

    # ---- 7. Copy assets ----
    for item in ['img', 'story-video.mp4', 'robots.txt',
                 'google17c2867d3c64f80e.html', 'google8147dc387921367f.html']:
        s = os.path.join(SRC, item)
        d = os.path.join(DST, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        elif os.path.exists(s):
            shutil.copy2(s, d)
        print('copied', item)

    # ---- 8. Sitemap ----
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for key, meta in PAGES.items():
        prio = '1.0' if key == 'index' else '0.8'
        sm.append(f'  <url><loc>/{meta["file"]}</loc><lastmod>2026-10-17</lastmod><changefreq>weekly</changefreq><priority>{prio}</priority></url>')
    sm.append('</urlset>')
    with open(os.path.join(DST, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sm))
    print('wrote sitemap.xml')

    print('DONE')


def fix_links(html_text):
    """Rewrite #hash links to page files; leave #main, mailto:, tel:, sms: alone."""
    def repl(m):
        href = m.group(1)
        return f'href="{HASH_MAP.get(href, href)}"'
    return re.sub(r'href="(#home|#portfolio|#behind-scenes|#about|#services|#book|#booking|#contract|#agreement|#contact|#baptism-guide|#instagram-feed|#clients)"', repl, html_text)


def homepage_extras():
    hub_links = ''.join(
        f'<a href="{PAGES[k]["file"]}">{PAGES[k]["nav"]}</a>'
        for k in ['portfolio', 'behind-scenes', 'about', 'services', 'booking', 'contract', 'contact', 'baptism-guide']
    )
    return f'''
    <section class="page-hub" aria-labelledby="hub-title">
      <div class="section-head"><h2 id="hub-title">Explore the site</h2><p>Every part of Pure Photography has its own page — jump right in.</p></div>
      <div class="hub-grid">{hub_links}</div>
    </section>
    <section class="mailing" aria-labelledby="mailing-title">
      <div class="mailing-inner">
        <p class="eyebrow">Mailing list</p>
        <h2 id="mailing-title">Join my mailing list</h2>
        <p>Get a personal update from Mary once a month — new services, behind-the-scenes, and booking reminders. No spam, ever.</p>
        <div class="actions" style="justify-content:center"><a class="button" href="{MAILING_LIST_URL}" target="_blank" rel="noopener noreferrer">Join my mailing list</a></div>
      </div>
    </section>'''


def nav_html(current_key):
    items = []
    for key, meta in PAGES.items():
        cur = ' aria-current="page"' if key == current_key else ''
        items.append(f'<li><a href="{meta["file"]}"{cur}>{html.escape(meta["nav"])}</a></li>')
    return '<nav aria-label="Main navigation">\n    <ul>\n      ' + '\n      '.join(items) + '\n    </ul>\n  </nav>'


def page_template(meta, banners, body_html, extras, footer, lightbox, trueai_html, jsonld):
    key = [k for k, v in PAGES.items() if v == meta][0]
    # Fix footer links too
    footer = fix_links(footer)
    banners = fix_links(banners)
    # Newsletter section on contact page -> point to the real Google Form
    body_html = update_newsletter(body_html)
    # Mary's new print prices
    body_html = update_print_prices(body_html)
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="{html.escape(meta['desc'])}">
  <meta name="keywords" content="photographer York SC, family photographer Rock Hill SC, portrait photographer Clover SC, senior photographer Lake Wylie, affordable photographer South Carolina, baptism photographer York County">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="Pure Photography">
  <meta property="og:title" content="{html.escape(meta['title'])}">
  <meta property="og:description" content="{html.escape(meta['desc'])}">
  <meta property="og:image" content="https://purephotography.netlify.app/img/mary-headshot.jpg">
  <meta property="og:url" content="https://purephotography.netlify.app/{meta['file'] if meta['file'] != 'index.html' else ''}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{html.escape(meta['title'])}">
  <meta name="twitter:description" content="{html.escape(meta['desc'])}">
  <meta name="twitter:image" content="https://purephotography.netlify.app/img/inline-5c0ef73be958.jpg">
  <link rel="canonical" href="https://purephotography.netlify.app/{meta['file'] if meta['file'] != 'index.html' else ''}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="styles.css">
  <title>{html.escape(meta['title'])}</title>
  {jsonld}
</head>
<body>
  <a class="skip" href="#main">Skip to main content</a>
{banners}
{nav_html(key)}
  <main id="main" tabindex="-1">
{body_html}
{extras}
  </main>
{footer}

  {lightbox}

{trueai_html}

  <script src="main.js" defer></script>
  <script src="trueai.js" defer></script>
</body>
</html>
'''


def update_print_prices(html_text):
    """Mary's new print prices: 5x7 $20 (was $15), 8x10 $30, 11x14 $50."""
    html_text = html_text.replace(
        '<label for="qty-5x7">5 × 7 print <span>$15 each</span></label>',
        '<label for="qty-5x7">5 × 7 print <span>$20 each</span></label>')
    html_text = html_text.replace(
        'aria-label="Quantity of 5 by 7 prints at 15 dollars each"',
        'aria-label="Quantity of 5 by 7 prints at 20 dollars each"')
    html_text = html_text.replace(
        '5 × 7 prints are $15 each',
        '5 × 7 prints are $20 each')
    return html_text


def update_newsletter(body_html):
    """Replace the placeholder newsletter form with a real link to Mary's Google Form."""
    # Replace the whole form with a CTA button linking to the Google Form
    new_form = (f'<div class="newsletter-actions">'
                f'<a class="newsletter-btn" href="{MAILING_LIST_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Yes, keep me updated!</a>'
                f'</div>'
                f'<p class="newsletter-note">One personal email a month, plus a reminder when you book. Unsubscribe anytime.</p>')
    body_html = re.sub(r'<form class="newsletter-form" id="newsletter-form".*?</form>', new_form, body_html, flags=re.DOTALL)
    return body_html


def remove_braced(text, start_marker):
    """Remove a `const x = {...};` or `function f(...) {...}` starting at start_marker,
    using brace matching."""
    i = text.find(start_marker)
    if i == -1:
        return text
    j = text.find('{', i)
    depth = 0
    k = j
    while k < len(text):
        if text[k] == '{':
            depth += 1
        elif text[k] == '}':
            depth -= 1
            if depth == 0:
                break
        k += 1
    # consume trailing ';' and newline
    end = k + 1
    if end < len(text) and text[end] == ';':
        end += 1
    if end < len(text) and text[end] == '\n':
        end += 1
    return text[:i] + text[end:]


def build_main_js(src):
    """Extract the main script block, remove SPA router + dead print-form code,
    guard each feature, update print prices, fix contract redirect."""
    m = re.search(r'  <script>\n    document\.querySelectorAll\(\'\[data-reel-embed\]\'\).*?\n  </script>', src, re.DOTALL)
    js = m.group(0)
    # strip outer <script> tags
    js = re.sub(r'^  <script>\n', '', js)
    js = re.sub(r'\n  </script>$', '', js)

    # --- Remove the SPA router (pageTitles, pageDescriptions, showPage) ---
    js = remove_braced(js, 'const pageTitles = {')
    js = remove_braced(js, 'const pageDescriptions = {')
    js = remove_braced(js, 'function showPage(requestedRoute')
    js = re.sub(r'    const routeAliases = .*?\n', '', js)
    js = re.sub(r'    let activeRoute = \'\';\n', '', js)
    js = re.sub(r'    const initialHash = .*?\n', '', js)
    js = re.sub(r'    showPage\(initialHash.*?\n', '', js)
    js = re.sub(r'    window\.addEventListener\(\'hashchange\'.*?\n', '', js)

    # --- Remove dead print-form code (the #print-form element does not exist in the HTML) ---
    # It spans from 'const printForm' to the end of its submit handler.
    i = js.find('const printForm = ')
    if i != -1:
        # find the submit handler and brace-match it
        h = js.find("printForm.addEventListener('submit'", i)
        j = js.find('{', h)
        depth = 0
        k = j
        while k < len(js):
            if js[k] == '{':
                depth += 1
            elif js[k] == '}':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        end = k + 1
        if end < len(js) and js[end] == ')':
            end += 1
        if end < len(js) and js[end] == ';':
            end += 1
        if end < len(js) and js[end] == '\n':
            end += 1
        js = js[:i] + js[end:]

    # --- Update print prices 15 -> 20 ---
    js = js.replace("name: '5 × 7 print', price: 15", "name: '5 × 7 print', price: 20")
    js = js.replace("'7. Print prices: 5 × 7 — $15 each;", "'7. Print prices: 5 × 7 — $20 each;")

    # --- Booking form: go to contract.html instead of #contract hash ---
    js = js.replace("window.location.hash = 'contract';", "window.location.href = 'contract.html?from=booking';")

    # --- Guard: booking/calculator/agreement/lightbox only run when their elements exist ---
    # Wrap the booking block
    js = js.replace(
        "    const bookingForm = document.querySelector('#booking-form');",
        "    const bookingForm = document.querySelector('#booking-form');\n    if (bookingForm) {")
    # find the end of the booking submit handler and close the guard before agreement code
    js = js.replace(
        "    const agreementForm = document.querySelector('#agreement-form');",
        "    }\n    const agreementForm = document.querySelector('#agreement-form');\n    if (agreementForm) {")
    js = js.replace(
        "    const dialog = document.querySelector('#lightbox');",
        "    }\n    const dialog = document.querySelector('#lightbox');\n    if (dialog) {")
    # close the dialog guard, dropping the dead newsletter JS (form replaced by a real link)
    ni = js.find('// Newsletter signup')
    if ni != -1:
        # back up to the start of the line
        ni = js.rfind('\n', 0, ni) + 1
        # find the if (newsletterForm) { and brace-match to its end
        h = js.find('if (newsletterForm)', ni)
        j = js.find('{', h)
        depth = 0
        k = j
        while k < len(js):
            if js[k] == '{':
                depth += 1
            elif js[k] == '}':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        end = k + 1
        if end < len(js) and js[end] == '\n':
            end += 1
        js = js[:ni] + '    }\n' + js[end:]

    # --- Contract page: show the "thanks for booking" notice when arriving from booking ---
    js += """
    // Show the booking->contract notice when arriving from the booking page.
    (function () {
      var notice = document.querySelector('#booking-contract-notice');
      if (notice && /[?&]from=booking/.test(window.location.search)) {
        notice.hidden = false;
        notice.focus({ preventScroll: true });
      }
    })();
"""

    # --- US-only banner fade (from the second inline script) ---
    js += """
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
"""
    return js


def build_trueai_js(src):
    """Extract the True AI script as-is, with booking URL + print KB updated."""
    m = re.search(r'<script>\n\(function\(\)\{\n  "use strict";\n  var BOOKING_URL.*?\n</script>', src, re.DOTALL)
    js = m.group(0)
    js = re.sub(r'^<script>\n', '', js)
    js = re.sub(r'\n</script>$', '', js)
    # Booking link -> relative page (works on any host)
    js = js.replace('var BOOKING_URL = "https://purephotography.netlify.app/#booking";',
                    'var BOOKING_URL = "booking.html";')
    # Prints are back with new prices
    js = js.replace('"Prints paused"', '"Print pricing"')
    js = js.replace(
        '{k:["print"], r:"Print orders are paused right now — Mary will announce when they\'re available again."},',
        '{k:["print"], r:"Prints are available! 5 × 7 — $20 each, 8 × 10 — $30 each, 11 × 14 — $50 each. You can add prints when you book, and they ship straight to you."},')
    return js


if __name__ == '__main__':
    main()
