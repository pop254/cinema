(function(){
  "use strict";

  /* ---------------- Photo helpers ---------------- */
  // A photo counts as "real" only once you've replaced the * with a file name
  function hasPhoto(src){ return !!src && src.indexOf("*") === -1; }
  var IMG_STYLE = 'width:100%;height:100%;object-fit:cover;display:block;';

  /* ---------------- Data ---------------- */
  var palettes = [
    ["#3d1f22","#1a0f12"], ["#1f2e3d","#0f151f"], ["#2e2013","#150f0a"],
    ["#1c2d24","#0d1611"], ["#331f3d","#160c1a"], ["#3d2f14","#171207"],
    ["#182233","#0a0e17"], ["#3d1a1a","#180a0a"]
  ];
  function posterSvg(i, title){
    var p = palettes[i % palettes.length];
    return '<svg viewBox="0 0 300 450" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="g'+i+'" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="'+p[0]+'"/><stop offset="100%" stop-color="'+p[1]+'"/></linearGradient></defs>' +
      '<rect width="300" height="450" fill="url(#g'+i+')"/>' +
      '<circle cx="'+(60+ (i*37)%180)+'" cy="'+(90+(i*53)%160)+'" r="'+(70+ (i*17)%60)+'" fill="rgba(231,172,63,0.10)"/>' +
      '<rect x="0" y="330" width="300" height="120" fill="rgba(0,0,0,0.25)"/>' +
      '</svg>';
  }
  // Photo if you've set one, gradient + title otherwise
  function posterMedia(item, i){
    if(hasPhoto(item.poster)){
      return '<img src="'+item.poster+'" alt="'+item.title+' poster" loading="lazy" style="'+IMG_STYLE+'">';
    }
    return posterSvg(i, item.title) + '<div class="poster-tag">'+item.title+'</div>';
  }

  var nowShowing = [
    {title:"By Any Means", genre:"Action", rating:"16+", runtime:"1h 40m", imax:false, poster:"images/d785c5f092d9dc495c24e924dd1ad45f.jpg"},
    {title:"Spider-Man: Brand New Day", genre:"Superhero", rating:"PG", runtime:"2h 24m", imax:false, poster:"images/cc70e1c36c6f8d8c278b5aee1f2c0ff5.jpg"},
    {title:"Coyote vs Acme", genre:"Family / Comedy", rating:"PG", runtime:"1h 43m", imax:false, poster:"images/5ae8ccc7b81b3d78bdf1ef7edd196605.jpg"},
    {title:"Moana (Live Action)", genre:"Adventure", rating:"PG", runtime:"2h 00m", imax:false, poster:"images/834ff4d6e1030234fc64dd5cfb2adc8c.jpg"},
    {title:"Practical Magic 2", genre:"Comedy", rating:"PG", runtime:"2h 10m", imax:false, poster:"images/d6a508cecb405d4ec56ab83db99a9ce4.jpg"},
    {title:"Runner", genre:"Thriller", rating:"16+", runtime:"1h 50m", imax:false, poster:"images/a552d826a5629d7d6f89dabfdd5212df.jpg"},
    {title:"Dune: Part Three", genre:"Sci-Fi", rating:"16+", runtime:"1h 40m", imax:true, poster:"images/5b80db5c8c88af96c6c8f3d381923b7b.jpg"},
    {title:"East West Love", genre:"Romance", rating:"TBC", runtime:"1h 40m", imax:false, poster:"images/ad25b629fa6715d007e49b533b3b5b59.jpg"},
    {title:"The Odyssey", genre:"Epic / Adventure", rating:"16+", runtime:"3h 05m", imax:false, poster:"images/032322a6e329894c39e3e7224bc78aa0.jpg"},
    {title:"Resident Evil", genre:"Horror", rating:"18+", runtime:"1h 30m", imax:true, poster:"images/226354a6a329f872ab001d795672e2bc.jpg"},
    {title:"Avengers: Endgame Encore", genre:"Superhero", rating:"PG", runtime:"3h 05m", imax:true, poster:"images/90c16dc0118c71cc2b33bc479f911d2b.jpg"}
  ];
  var comingSoon = [
    {title:"Digger", date:"2 Oct", poster:"images/e09021748dcfe2108176ef93d9a85006.jpg"},
    {title:"Street Fighter", date:"16 Oct", poster:"images/26f45b32202ad32cdd6c4a658429f3bd.jpg"},
    {title:"Clayface", date:"23 Oct", poster:"images/474327bb8b2d2d417e9d5c395c9d6dd5.jpg"},
    {title:"The Cat in the Hat", date:"6 Nov", poster:"images/0f5713d9a22659f4ae5a3094af215bb2.jpg"},
    {title:"The Hunger Games: Sunrise on the Reaping", date:"20 Nov", poster:"images/f6c634a2ac5d5a82669c1ed5f426dc6c.jpg"},
    {title:"Violent Night 2", date:"4 Dec", poster:"images/43335c452d51ca98ab43f276a454c44c.jpg"},
    {title:"Zero A.D.", date:"11 Dec", poster:"images/d585e62bc45d860070a3583a565c1bff.jpg"},
    {title:"Avengers: Doomsday", date:"19 Dec", poster:"images/91f168d29854d15717761c64bf4b206a.jpg"}
  ];
  var locations = [
    {name:"Riverbend Mall", sub:"9 screens · 1 IMAX"},
    {name:"Crossroads", sub:"6 screens"},
    {name:"Ridgeview", sub:"7 screens · 1 IMAX"},
    {name:"Two Rivers", sub:"8 screens · 1 IMAX"}
  ];
  // bg = wide hero background photo (landscape works best, e.g. 1600x900)
  // video = wide hero background video (mp4). If both are set, video wins and bg is used as its poster frame while it loads.
  var heroSlides = [
  {tag:"Now Showing · IMAX", title:"Dune: Part Three", meta:["Sci-Fi","1h 40m","16+"], imax:true, i:8, video:"videos/60e9f97effbb8cc6d21bf193b56254d2_720w.mp4"},
  {tag:"Now Showing · IMAX", title:"Resident Evil", meta:["Horror","1h 30m","18+"], imax:true, i:0, video:"videos/2996e6a449a930fe7e5545351d982425.mp4"},
  {tag:"Now Showing", title:"The Odyssey", meta:["Adventure","3h 05m","16+"], imax:true, i:2, video:"videos/d0bba3fe9b7946aa8fe86750cb8b7b1b_720w.mp4"},
  {tag:"Now Showing · IMAX", title:"Avengers: Endgame Encore", meta:["Superhero","3h 05m","PG"], imax:true, i:8, video:"videos/b0a72fe42a19faa4aa4eb110c2def7b7.mp4"}
];

  /* ---------------- Header shrink on scroll ---------------- */
  var header = document.getElementById("siteHeader");
  window.addEventListener("scroll", function(){
    header.classList.toggle("scrolled", window.scrollY > 40);
  }, {passive:true});

  /* ---------------- Hero build ---------------- */
  var hero = document.querySelector(".hero");
  var dotsWrap = document.getElementById("heroDots");
  function posterSvgFull(i){
    var p = palettes[i % palettes.length];
    return '<defs><radialGradient id="hg'+i+'" cx="30%" cy="30%" r="80%">'+
      '<stop offset="0%" stop-color="'+p[0]+'"/><stop offset="100%" stop-color="'+p[1]+'"/></radialGradient></defs>'+
      '<rect width="1600" height="900" fill="url(#hg'+i+')"/>';
  }
  heroSlides.forEach(function(s, idx){
    var el = document.createElement("div");
    el.className = "slide" + (idx===0 ? " active":"");
    var chips = s.meta.map(function(m,mi){ return '<span class="chip'+(s.imax&&mi===0?' imax':'')+'">'+m+'</span>'; }).join("");

    var bgHtml;
    if (hasPhoto(s.video)) {
      // video wins if present; use bg (if set) as the poster frame shown before it loads/plays
      bgHtml = '<video autoplay muted loop playsinline preload="auto" style="'+IMG_STYLE+'"' +
        (hasPhoto(s.bg) ? ' poster="'+s.bg+'"' : '') + '>' +
        '<source src="'+s.video+'" type="video/mp4">' +
        '</video>';
    } else if (hasPhoto(s.bg)) {
      bgHtml = '<img src="'+s.bg+'" alt="" style="'+IMG_STYLE+'">';
    } else {
      bgHtml = '<svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">'+posterSvgFull(s.i)+'</svg>';
    }

    el.innerHTML =
      '<div class="slide-bg">'+bgHtml+'</div>'+
      '<div class="hero-inner wrap">'+
        '<div class="hero-tag">'+s.tag+'</div>'+
        '<h1 class="hero-title">'+s.title+'</h1>'+
        '<div class="hero-meta">'+chips+'</div>'+
        '<div class="hero-actions"><a href="#showing" class="btn btn-gold">Book tickets</a><a href="#showing" class="btn btn-line">View trailer</a></div>'+
      '</div>';
    hero.insertBefore(el, document.getElementById("heroDots"));
    var dot = document.createElement("button");
    if(idx===0) dot.className = "active";
    dot.addEventListener("click", function(){ goTo(idx); });
    dotsWrap.appendChild(dot);
  });

  var slides = document.querySelectorAll(".slide");
  var dots = document.querySelectorAll(".hero-dots button");
  var current = 0, timer;
  function goTo(idx){
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add("active");
    dots[current].classList.add("active");
    resetTimer();
  }
  function resetTimer(){
    clearInterval(timer);
    timer = setInterval(function(){ goTo(current+1); }, 20000);
  }
  resetTimer();

  /* ---------------- Filmstrip reel dots along bottom of hero ---------------- */
  var reel = document.getElementById("reel");
  var reelCount = Math.ceil(window.innerWidth / 18) + 2;
  for(var r=0;r<reelCount;r++){ var sp=document.createElement("span"); reel.appendChild(sp); }

  /* ---------------- Locations ---------------- */
  var locRow = document.getElementById("locRow");
  locations.forEach(function(loc, i){
    var b = document.createElement("button");
    b.className = "loc-tab" + (i===0 ? " active":"");
    b.innerHTML = "<span>"+loc.name+"</span><small>"+loc.sub+"</small>";
    b.addEventListener("click", function(){
      document.querySelectorAll(".loc-tab").forEach(function(t){t.classList.remove("active");});
      b.classList.add("active");
      renderGrid();
    });
    locRow.appendChild(b);
  });

  /* ---------------- Filter + grid ---------------- */
  var grid = document.getElementById("movieGrid");
  var activeFilter = "showing";
  document.getElementById("filterShowing").addEventListener("click", function(){ setFilter("showing"); });
  document.getElementById("filterSoon").addEventListener("click", function(){ setFilter("soon"); });
  function setFilter(f){
    activeFilter = f;
    document.getElementById("filterShowing").classList.toggle("active", f==="showing");
    document.getElementById("filterSoon").classList.toggle("active", f==="soon");
    renderGrid();
  }
  function renderGrid(){
    grid.style.opacity = "0";
    setTimeout(function(){
      grid.innerHTML = "";
      var list = activeFilter === "showing" ? nowShowing : comingSoon.map(function(c,ci){
        return {title:c.title, genre:"Coming " + c.date, rating:"TBC", runtime:"", imax: ci%3===0, poster:c.poster};
      });
      list.forEach(function(m, i){
        var card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML =
          '<div class="poster">'+
            '<div class="badge-row"><span class="badge rated">'+m.rating+'</span>'+(m.imax?'<span class="badge imax-badge">IMAX</span>':'')+'</div>'+
            posterMedia(m, i)+
            '<div class="book-overlay"><span class="book-pill">'+(activeFilter==="showing"?"Book now":"Notify me")+'</span></div>'+
          '</div>'+
          '<div class="card-body"><h3>'+m.title+'</h3><div class="runtime">'+m.genre+(m.runtime?" · "+m.runtime:"")+'</div></div>';
        grid.appendChild(card);
      });
      grid.style.transition = "opacity .35s ease";
      grid.style.opacity = "1";
    }, 180);
  }
  renderGrid();

  /* ---------------- Coming soon strip ---------------- */
  var strip = document.getElementById("soonStrip");
  comingSoon.forEach(function(c, i){
    var el = document.createElement("div");
    el.className = "strip-card";
    var media = hasPhoto(c.poster)
      ? '<img src="'+c.poster+'" alt="'+c.title+' poster" loading="lazy" style="'+IMG_STYLE+'">'
      : posterSvg(i+3, c.title) + '<span>'+c.title+'</span>';
    el.innerHTML =
      '<div class="strip-poster">'+media+'</div>'+
      '<div class="strip-date">Opens '+c.date+'</div>';
    strip.appendChild(el);
  });

  document.getElementById("year").textContent = new Date().getFullYear();
})();
