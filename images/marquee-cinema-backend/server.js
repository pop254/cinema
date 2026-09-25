require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const db = require("./db");
const { hashPassword, verifyPassword, createSession, authRequired, adminRequired, optionalAuth } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const BOOKING_FEE = Number(process.env.BOOKING_FEE || 50);

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map(s => s.trim()) : true,
  credentials: false
}));
app.use(express.json({ limit: "1mb" }));

function cleanUser(user) {
  return user ? { id:user.id, name:user.name, email:user.email, phone:user.phone, role:user.role, membershipTier:user.membership_tier, createdAt:user.created_at } : null;
}
function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function bookingRef() {
  return `MQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}
function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}
function parseJson(value, fallback=[]) {
  try { return JSON.parse(value); } catch { return fallback; }
}

app.get("/api/health", (_req,res) => res.json({ ok:true, service:"marquee-cinema-api", time:new Date().toISOString() }));

app.post("/api/auth/register", (req,res) => {
  const { name, email, password, phone="" } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error:"name, email and password are required" });
  if (password.length < 8) return res.status(400).json({ error:"Password must be at least 8 characters" });
  try {
    const result = db.prepare("INSERT INTO users(name,email,phone,password_hash) VALUES(?,?,?,?)")
      .run(String(name).trim(), String(email).trim().toLowerCase(), String(phone).trim(), hashPassword(password));
    const user = db.prepare("SELECT id,name,email,phone,role,membership_tier,created_at FROM users WHERE id=?").get(result.lastInsertRowid);
    const token = createSession(user.id);
    res.status(201).json({ user:cleanUser(user), token });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error:"An account with that email already exists" });
    res.status(500).json({ error:"Could not create account" });
  }
});

app.post("/api/auth/login", (req,res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").get(String(email || "").trim());
  if (!user || !verifyPassword(String(password || ""), user.password_hash)) return res.status(401).json({ error:"Invalid email or password" });
  res.json({ user:cleanUser(user), token:createSession(user.id) });
});

app.post("/api/auth/logout", authRequired, (req,res) => {
  const hash = crypto.createHash("sha256").update(req.token).digest("hex");
  db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash);
  res.json({ ok:true });
});

app.get("/api/me", authRequired, (req,res) => res.json({ user:req.user }));

app.get("/api/movies", (req,res) => {
  const { status, search, imax } = req.query;
  let sql = "SELECT * FROM movies WHERE 1=1";
  const args = [];
  if (status === "now_showing") sql += " AND is_now_showing=1";
  if (status === "coming_soon") sql += " AND is_coming_soon=1";
  if (imax === "true") sql += " AND is_imax=1";
  if (search) { sql += " AND (title LIKE ? OR genre LIKE ?)"; args.push(`%${search}%`,`%${search}%`); }
  sql += " ORDER BY CASE WHEN is_now_showing=1 THEN 0 ELSE 1 END, release_date ASC, title ASC";
  const movies = db.prepare(sql).all(...args).map(m => ({
    ...m, isNowShowing:!!m.is_now_showing, isComingSoon:!!m.is_coming_soon, isImax:!!m.is_imax
  }));
  res.json({ movies });
});

app.get("/api/movies/:id", (req,res) => {
  const m = db.prepare("SELECT * FROM movies WHERE id=? OR slug=?").get(req.params.id, req.params.id);
  if (!m) return res.status(404).json({ error:"Movie not found" });
  res.json({ movie:{...m,isNowShowing:!!m.is_now_showing,isComingSoon:!!m.is_coming_soon,isImax:!!m.is_imax} });
});

app.get("/api/cinemas", (_req,res) => {
  const cinemas = db.prepare("SELECT * FROM cinemas ORDER BY name").all().map(c => ({...c,features:parseJson(c.features_json)}));
  res.json({ cinemas });
});

app.get("/api/cinemas/:id", (req,res) => {
  const c = db.prepare("SELECT * FROM cinemas WHERE id=? OR slug=?").get(req.params.id,req.params.id);
  if (!c) return res.status(404).json({ error:"Cinema not found" });
  const screens = db.prepare("SELECT id,name,screen_type,total_rows,total_columns FROM screens WHERE cinema_id=?").all(c.id);
  res.json({ cinema:{...c,features:parseJson(c.features_json),screens} });
});

app.get("/api/showtimes", (req,res) => {
  const { movieId, cinemaId, date, imax } = req.query;
  let sql = `
    SELECT st.*, m.title AS movie_title, m.slug AS movie_slug, m.poster_url,
           s.name AS screen_name, s.screen_type, c.id AS cinema_id, c.name AS cinema_name, c.slug AS cinema_slug
    FROM showtimes st
    JOIN movies m ON m.id=st.movie_id
    JOIN screens s ON s.id=st.screen_id
    JOIN cinemas c ON c.id=s.cinema_id
    WHERE st.status='scheduled'
  `;
  const args=[];
  if (movieId) { sql += " AND st.movie_id=?"; args.push(movieId); }
  if (cinemaId) { sql += " AND c.id=?"; args.push(cinemaId); }
  if (date && validDate(date)) { sql += " AND substr(st.start_time,1,10)=?"; args.push(date); }
  if (imax === "true") sql += " AND s.screen_type='IMAX'";
  sql += " ORDER BY st.start_time";
  const showtimes = db.prepare(sql).all(...args);
  res.json({ showtimes });
});

app.get("/api/cinemas/:id/showtimes", (req,res) => {
  req.query.cinemaId = req.params.id;
  const { date } = req.query;
  if (date && !validDate(date)) return res.status(400).json({error:"date must be YYYY-MM-DD"});
  const c = db.prepare("SELECT id FROM cinemas WHERE id=? OR slug=?").get(req.params.id,req.params.id);
  if (!c) return res.status(404).json({error:"Cinema not found"});
  const rows = db.prepare(`
    SELECT st.*,m.title AS movie_title,m.slug AS movie_slug,m.poster_url,
           s.name AS screen_name,s.screen_type
    FROM showtimes st JOIN movies m ON m.id=st.movie_id
    JOIN screens s ON s.id=st.screen_id
    WHERE s.cinema_id=? AND st.status='scheduled' ${date ? "AND substr(st.start_time,1,10)=?" : ""}
    ORDER BY st.start_time
  `).all(...(date ? [c.id,date] : [c.id]));
  res.json({showtimes:rows});
});

app.get("/api/showtimes/:id/seats", (req,res) => {
  const st = db.prepare(`
    SELECT st.id,st.price,st.start_time,st.format,m.title AS movie_title,
           s.id AS screen_id,s.name AS screen_name,c.id AS cinema_id,c.name AS cinema_name
    FROM showtimes st JOIN movies m ON m.id=st.movie_id
    JOIN screens s ON s.id=st.screen_id JOIN cinemas c ON c.id=s.cinema_id
    WHERE st.id=?
  `).get(req.params.id);
  if (!st) return res.status(404).json({error:"Showtime not found"});
  const seats = db.prepare(`
    SELECT seats.id,seats.row_label,seats.seat_number,seats.seat_type,
           CASE WHEN bs.id IS NULL THEN 0 ELSE 1 END AS booked
    FROM seats
    LEFT JOIN booking_seats bs ON bs.seat_id=seats.id AND bs.showtime_id=?
    JOIN screens s ON s.id=seats.screen_id
    WHERE s.id=?
    ORDER BY seats.row_label,seats.seat_number
  `).all(st.id,st.screen_id);
  res.json({showtime:st,seats:seats.map(s=>({...s,booked:!!s.booked}))});
});

app.post("/api/bookings", optionalAuth, (req,res) => {
  const { showtimeId, seatIds, customerName, customerEmail, customerPhone="" } = req.body || {};
  if (!showtimeId || !Array.isArray(seatIds) || seatIds.length < 1 || !customerName || !customerEmail)
    return res.status(400).json({error:"showtimeId, seatIds, customerName and customerEmail are required"});
  if (seatIds.length > 10) return res.status(400).json({error:"Maximum 10 seats per booking"});
  const uniqueSeatIds=[...new Set(seatIds.map(Number))];
  const showtime=db.prepare(`
    SELECT st.*,s.id AS screen_id FROM showtimes st JOIN screens s ON s.id=st.screen_id
    WHERE st.id=? AND st.status='scheduled'
  `).get(showtimeId);
  if (!showtime) return res.status(404).json({error:"Showtime not found"});
  const placeholders=uniqueSeatIds.map(()=>"?").join(",");
  const validSeats=db.prepare(`SELECT id FROM seats WHERE screen_id=? AND id IN (${placeholders})`).all(showtime.screen_id,...uniqueSeatIds);
  if (validSeats.length !== uniqueSeatIds.length) return res.status(400).json({error:"One or more seats are invalid for this showtime"});
  const subtotal=Number((showtime.price*uniqueSeatIds.length).toFixed(2));
  const total=Number((subtotal+BOOKING_FEE).toFixed(2));
  const reference=bookingRef();

  try {
    const create = db.transaction(() => {
      const b=db.prepare(`
        INSERT INTO bookings(reference,user_id,showtime_id,customer_name,customer_email,customer_phone,subtotal,booking_fee,total)
        VALUES(?,?,?,?,?,?,?,?,?)
      `).run(reference,req.user?.id || null,showtimeId,String(customerName).trim(),String(customerEmail).trim().toLowerCase(),String(customerPhone).trim(),subtotal,BOOKING_FEE,total);
      const insertSeat=db.prepare("INSERT INTO booking_seats(booking_id,showtime_id,seat_id,price) VALUES(?,?,?,?)");
      for(const id of uniqueSeatIds) insertSeat.run(b.lastInsertRowid,showtimeId,id,showtime.price);
      return b.lastInsertRowid;
    });
    const bookingId=create();
    const booking=getBooking(bookingId);
    res.status(201).json({booking});
  } catch(e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({error:"One or more selected seats have just been booked. Refresh the seats and try again."});
    console.error(e);
    res.status(500).json({error:"Could not create booking"});
  }
});

function getBooking(idOrRef) {
  const b=db.prepare(`
    SELECT b.*,m.title AS movie_title,st.start_time,st.end_time,st.format,
           c.name AS cinema_name,s.name AS screen_name
    FROM bookings b JOIN showtimes st ON st.id=b.showtime_id
    JOIN movies m ON m.id=st.movie_id JOIN screens s ON s.id=st.screen_id
    JOIN cinemas c ON c.id=s.cinema_id
    WHERE b.id=? OR b.reference=?
  `).get(idOrRef,idOrRef);
  if(!b) return null;
  const seats=db.prepare(`
    SELECT bs.seat_id,bs.price,seats.row_label,seats.seat_number,seats.seat_type
    FROM booking_seats bs JOIN seats ON seats.id=bs.seat_id
    WHERE bs.booking_id=? ORDER BY seats.row_label,seats.seat_number
  `).all(b.id);
  return {...b,seats};
}

app.get("/api/bookings/:reference", (req,res) => {
  const b=getBooking(req.params.reference);
  if(!b) return res.status(404).json({error:"Booking not found"});
  res.json({booking:b});
});

app.get("/api/me/bookings", authRequired, (req,res) => {
  const bookings=db.prepare("SELECT reference,showtime_id,total,status,payment_status,created_at FROM bookings WHERE user_id=? ORDER BY created_at DESC").all(req.user.id);
  res.json({bookings});
});

app.post("/api/payments", optionalAuth, (req,res) => {
  const { bookingReference, provider="demo", transactionRef="" }=req.body||{};
  const b=db.prepare("SELECT * FROM bookings WHERE reference=?").get(bookingReference);
  if(!b) return res.status(404).json({error:"Booking not found"});
  db.prepare("INSERT INTO payments(booking_id,provider,transaction_ref,amount,status) VALUES(?,?,?,?,?)")
    .run(b.id,provider,String(transactionRef),b.total,"paid");
  db.prepare("UPDATE bookings SET payment_status='paid' WHERE id=?").run(b.id);
  res.json({ok:true,booking:getBooking(b.id),payment:{provider,transactionRef,status:"paid",amount:b.total}});
});

app.post("/api/membership/join", authRequired, (req,res) => {
  db.prepare("INSERT INTO memberships(user_id,tier) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier").run(req.user.id,"reel_club");
  db.prepare("UPDATE users SET membership_tier='reel_club' WHERE id=?").run(req.user.id);
  const user=db.prepare("SELECT id,name,email,phone,role,membership_tier,created_at FROM users WHERE id=?").get(req.user.id);
  res.json({user:cleanUser(user),membership:{tier:"reel_club"}});
});

app.post("/api/contact", (req,res) => {
  const {name,email,subject,message}=req.body||{};
  if(!name||!email||!subject||!message) return res.status(400).json({error:"name, email, subject and message are required"});
  const r=db.prepare("INSERT INTO contact_messages(name,email,subject,message) VALUES(?,?,?,?)").run(name,email,subject,message);
  res.status(201).json({ok:true,id:r.lastInsertRowid});
});

/* Admin */
app.get("/api/admin/stats", adminRequired, (_req,res) => {
  const count=q=>db.prepare(q).get().count;
  res.json({
    movies:count("SELECT COUNT(*) count FROM movies"),
    cinemas:count("SELECT COUNT(*) count FROM cinemas"),
    showtimes:count("SELECT COUNT(*) count FROM showtimes"),
    bookings:count("SELECT COUNT(*) count FROM bookings"),
    customers:count("SELECT COUNT(*) count FROM users WHERE role='customer'"),
    revenue:db.prepare("SELECT COALESCE(SUM(total),0) total FROM bookings WHERE payment_status='paid'").get().total
  });
});

app.post("/api/admin/movies", adminRequired, (req,res) => {
  const m=req.body||{};
  if(!m.title) return res.status(400).json({error:"title is required"});
  const slug=m.slug||slugify(m.title);
  try {
    const r=db.prepare(`
      INSERT INTO movies(title,slug,description,genre,duration_minutes,language,age_rating,release_date,poster_url,backdrop_url,trailer_url,is_now_showing,is_coming_soon,is_imax)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(m.title,slug,m.description||"",m.genre||"",Number(m.durationMinutes||120),m.language||"English",m.ageRating||"PG",m.releaseDate||null,m.posterUrl||null,m.backdropUrl||null,m.trailerUrl||null,m.isNowShowing?1:0,m.isComingSoon?1:0,m.isImax?1:0);
    res.status(201).json({movie:db.prepare("SELECT * FROM movies WHERE id=?").get(r.lastInsertRowid)});
  } catch(e){res.status(400).json({error:e.message});}
});

app.post("/api/admin/showtimes", adminRequired, (req,res) => {
  const {movieId,screenId,startTime,endTime,price,format="2D",language="English"}=req.body||{};
  if(!movieId||!screenId||!startTime||!endTime||price==null) return res.status(400).json({error:"movieId, screenId, startTime, endTime and price are required"});
  const r=db.prepare("INSERT INTO showtimes(movie_id,screen_id,start_time,end_time,price,format,language) VALUES(?,?,?,?,?,?,?)").run(movieId,screenId,startTime,endTime,Number(price),format,language);
  res.status(201).json({showtime:db.prepare("SELECT * FROM showtimes WHERE id=?").get(r.lastInsertRowid)});
});

app.patch("/api/admin/showtimes/:id", adminRequired, (req,res) => {
  const {price,format,status}=req.body||{};
  const current=db.prepare("SELECT * FROM showtimes WHERE id=?").get(req.params.id);
  if(!current) return res.status(404).json({error:"Showtime not found"});
  db.prepare("UPDATE showtimes SET price=?,format=?,status=? WHERE id=?").run(price==null?current.price:Number(price),format||current.format,status||current.status,current.id);
  res.json({showtime:db.prepare("SELECT * FROM showtimes WHERE id=?").get(current.id)});
});

app.delete("/api/admin/showtimes/:id", adminRequired, (req,res) => {
  db.prepare("UPDATE showtimes SET status='cancelled' WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/admin/bookings", adminRequired, (_req,res) => {
  res.json({bookings:db.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500").all()});
});

app.get("/api/admin/messages", adminRequired, (_req,res) => {
  res.json({messages:db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 500").all()});
});

app.use((_req,res)=>res.status(404).json({error:"Route not found"}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Internal server error"});});

app.listen(PORT,()=>console.log(`Marquee API running on http://localhost:${PORT}`));
