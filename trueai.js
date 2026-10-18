(function(){
  "use strict";
  var BOOKING_URL = "booking.html";
  var EMAIL = "purephotography6@gmail.com";
  var openBtn = document.getElementById("trueai-open");
  var panel = document.getElementById("trueai-panel");
  var closeBtn = document.getElementById("trueai-close");
  var log = document.getElementById("trueai-messages");
  var quick = document.getElementById("trueai-quick");
  var form = document.getElementById("trueai-form");
  var input = document.getElementById("trueai-input");
  var booking = null;
  var greeted = false;

  function stripHtml(s){ return String(s).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(); }
  var KB_LABELS = ["Angel Shoot pricing","Birthday pricing","Engagement pricing","Pet sessions","Session pricing","Services list","Location","No-editing policy","Mary's story","Print pricing","Hours / availability","Contact info","Thanks"];

  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function bookLink(){return '<a href="'+BOOKING_URL+'">the booking page</a>';}

  function addMsg(text, who, isHtml){
    var d = document.createElement("div");
    d.className = "trueai-msg " + who;
    if (who === "ai" && isHtml) { d.innerHTML = text; } else { d.textContent = text; }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function say(text){ addMsg(text, "ai", true); }

  var KB = [
    {k:["angel","baptism"], r:"Angel Shoots are Mary's baptism photography sessions — <strong>$120 total</strong>. She's there for the full church service plus the baptism ceremony. Would you like to book one? Just type <strong>book</strong> and I'll get your request ready."},
    {k:["birthday"], r:"Birthday party photography is <strong>$220 total</strong> ($200 shoot + $20 retainer). Tell me about the celebration you have in mind — or type <strong>book</strong> to start a booking request."},
    {k:["engagement","engaged","proposal"], r:"Engagement sessions are <strong>$120 total</strong>. Mary would love to capture your story! Type <strong>book</strong> and I'll help you get started."},
    {k:["pet","dog","cat","puppy","kitten"], r:"Mary photographs pets — <strong>dogs and cats only</strong> — at the regular $30 session rate. Pets need to work on or off leash, or be comfortable free in the home."},
    {k:["price","pricing","cost","how much","fee","charge","rate"], r:"Portrait sessions are <strong>$30 total</strong> — a $10 shoot fee plus a $20 nonrefundable retainer due when you book. Special sessions: Angel Shoots (baptism) $120, birthday parties $220, engagements $120."},
    {k:["service","offer","what do you","shoot","photograph"], r:"Mary offers portraits, couples and family sessions, senior portraits, pet portraits (dogs and cats only), Angel Shoots for baptisms ($120), birthday parties ($220), engagement sessions ($120), and prom photos. Which one are you interested in?"},
    {k:["where","location","travel","come to","york","address","area","based"], r:"Sessions take place in <strong>York, South Carolina — clients come to Mary</strong>. She serves York, Rock Hill, Clover, and Lake Wylie."},
    {k:["edit","photoshop","retouch","filter","true to color","true-to-color"], r:"True to color — Mary doesn't edit her photos. What you see is what you get: honest, natural color exactly as it was in the moment."},
    {k:["your story","my story","about mary","about you","vision","blind","see the world","sight"], r:"Mary is a photographer in York, South Carolina with vision limitations. She sees the world through light, color, and shadow — and photography is how she shares what she sees. You can read her full story in the <strong>My Story</strong> section on the About page of this site."},
    {k:["print"], r:"Prints are available! 5 × 7 — $20 each, 8 × 10 — $30 each, 11 × 14 — $50 each. You can add prints when you book, and they ship straight to you."},
    {k:["hour","when are","open","available","appointment time","schedule a time"], r:"Sessions are <strong>by appointment</strong>. Send a booking request and Mary will work out a time with you personally."},
    {k:["human","real person","talk to mary","speak to","contact","email","phone","reach"], r:"I'm True AI, Mary's virtual receptionist! For anything I can't answer, Mary reads every message personally. You can also email her at <strong>"+EMAIL+"</strong>."},
    {k:["thank","thanks"], r:"You're so welcome! I hope we get to photograph you soon."}
  ];

  function matchIntent(q){
    for (var i = 0; i < KB.length; i++){
      var keys = KB[i].k;
      for (var j = 0; j < keys.length; j++){
        if (q.indexOf(keys[j]) !== -1) return {r: KB[i].r, i: i};
      }
    }
    return null;
  }

  function startBooking(){
    booking = {step:"name", name:"", session:"", date:""};
    say("Wonderful — let's get your booking request ready for Mary. First, what's your <strong>name</strong>?");
  }

  function bookingNext(v){
    if (/^(cancel|never mind|stop)$/i.test(v)){ booking = null; say("No problem at all — I've cancelled that. Is there anything else I can help with?"); return; }
    if (booking.step === "name"){
      booking.name = v; booking.step = "session";
      say("Nice to meet you, " + esc(v) + "! What kind of <strong>session</strong> would you like? For example: portrait, family, senior, pet, Angel Shoot, birthday, or engagement.");
    } else if (booking.step === "session"){
      booking.session = v; booking.step = "date";
      say("Great choice. What <strong>date</strong> works best for you? Any format is fine — for example, Saturday, November 2nd.");
    } else if (booking.step === "date"){
      booking.date = v;
      var doneBooking = {name: booking.name, session: booking.session, date: booking.date};
      booking = null;
      showSummary(doneBooking);
    }
  }

  function summaryText(){
    return "Booking request for Pure Photography\nName: " + booking.name + "\nSession: " + booking.session + "\nPreferred date: " + booking.date + "\n\nReminder: sessions take place in York, SC — clients come to Mary.\nBook: " + BOOKING_URL;
  }

  function showSummary(b){
    var wrap = document.createElement("div");
    wrap.className = "trueai-msg ai";
    var p = document.createElement("div");
    p.innerHTML = "Here's your booking request summary:<br><strong>Name:</strong> " + esc(b.name) +
      "<br><strong>Session:</strong> " + esc(b.session) +
      "<br><strong>Preferred date:</strong> " + esc(b.date) +
      "<br><br>Reminder: sessions take place in York, SC — clients come to Mary. Mary will confirm availability personally.";
    wrap.appendChild(p);
    var actions = document.createElement("div");
    actions.className = "trueai-actions";
    var copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.textContent = "Copy my details";
    copyBtn.setAttribute("aria-label", "Copy booking details to clipboard");
    copyBtn.addEventListener("click", function(){
      var txt = "Booking request for Pure Photography\nName: " + b.name + "\nSession: " + b.session + "\nPreferred date: " + b.date + "\n\nReminder: sessions take place in York, SC — clients come to Mary.\nBook: " + BOOKING_URL;
      function done(){ say("Copied! Your booking details are on your clipboard."); }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done, function(){ fallbackCopy(txt); done(); });
      } else { fallbackCopy(txt); done(); }
    });
    var mail = document.createElement("a");
    mail.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Booking request from " + b.name) +
      "&body=" + encodeURIComponent("Hi Mary,\n\nI'd like to book a session.\n\nName: " + b.name + "\nSession: " + b.session + "\nPreferred date: " + b.date + "\n\nThank you!");
    mail.textContent = "Email my details to Mary";
    mail.addEventListener("click", function(){});
    var bookA = document.createElement("a");
    bookA.href = BOOKING_URL; bookA.textContent = "Go to the booking page";
    actions.appendChild(copyBtn); actions.appendChild(mail); actions.appendChild(bookA);
    wrap.appendChild(actions);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function fallbackCopy(txt){
    var ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly","");
    ta.style.position = "absolute"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta);
  }

  var FALLBACK = "I want to make sure I get that right — I can help with <strong>pricing</strong>, <strong>services</strong>, <strong>where sessions take place</strong>, and <strong>booking</strong>. Could you ask me about one of those? Or type <strong>book</strong> to start a booking request.";
  var GREETING = "Hello, and welcome to Pure Photography! I'm <strong>True AI</strong>, Mary's virtual receptionist. I can answer questions about pricing, services, and booking — or type <strong>book</strong> and I'll help you start a booking request. What can I help with today?";

  function handleUser(v){
    addMsg(v, "user", false);
    var q = v.toLowerCase();
    if (booking){ bookingNext(v); return; }
    if (/\b(book|booking|schedule|appointment|reserve|sign up)\b/.test(q)){ startBooking(); return; }
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q) && q.length < 24){ say(GREETING); return; }
    var m = matchIntent(q);
    if (m){
      say(m.r);
    } else {
      say(FALLBACK);
    }
  }

  var QUICK = [
    {label:"How much is a session?", send:"How much is a session?"},
    {label:"What services do you offer?", send:"What services do you offer?"},
    {label:"Where do sessions take place?", send:"Where do sessions take place?"},
    {label:"I want to book", send:"I want to book"}
  ];
  QUICK.forEach(function(item){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = item.label;
    b.addEventListener("click", function(){ handleUser(item.send); input.focus(); });
    quick.appendChild(b);
  });

  function openPanel(){
    panel.hidden = false;
    openBtn.setAttribute("aria-expanded","true");
    if (!greeted){ greeted = true; say(GREETING); }
    input.focus();
  }
  function closePanel(){
    panel.hidden = true;
    openBtn.setAttribute("aria-expanded","false");
    openBtn.focus();
  }
  openBtn.addEventListener("click", function(){ panel.hidden ? openPanel() : closePanel(); });
  closeBtn.addEventListener("click", closePanel);
  panel.addEventListener("keydown", function(e){ if (e.key === "Escape" || e.keyCode === 27){ closePanel(); } });
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var v = input.value.trim();
    if (!v) return;
    input.value = "";
    handleUser(v);
  });
})();