require("dotenv").config();
const db=require("./db");
const {hashPassword}=require("./auth");

const adminEmail=process.env.ADMIN_EMAIL||"admin@marqueecinema.co.ke";
const adminPassword=process.env.ADMIN_PASSWORD||"ChangeThisPassword123!";

const seed=db.transaction(()=>{
  db.prepare("DELETE FROM booking_seats").run();
  db.prepare("DELETE FROM bookings").run();
  db.prepare("DELETE FROM showtimes").run();
  db.prepare("DELETE FROM seats").run();
  db.prepare("DELETE FROM screens").run();
  db.prepare("DELETE FROM cinemas").run();
  db.prepare("DELETE FROM movies").run();

  const movies=[
    ["By Any Means","by-any-means","Action / Thriller",105,"English","16","2026-09-01",true,false,false],
    ["Spider-Man: Brand New Day","spider-man-brand-new-day","Action / Adventure",140,"English","PG-13","2026-07-31",true,false,true],
    ["Coyote vs Acme","coyote-vs-acme","Comedy / Family",115,"English","PG","2026-08-15",true,false,false],
    ["Moana (Live Action)","moana-live-action","Adventure / Family",120,"English","PG","2026-07-10",true,false,true],
    ["Practical Magic","practical-magic","Fantasy / Romance",105,"English","PG-13","2026-10-01",false,true,false],
    ["The Housemaid","the-housemaid","Mystery / Thriller",115,"English","16","2026-10-15",false,true,false],
    ["Michael","michael","Biography / Music",130,"English","PG-13","2026-10-02",false,true,false],
    ["Toy Story 5","toy-story-5","Animation / Family",105,"English","G","2026-06-19",true,false,false],
    ["Avengers: Secret Wars","avengers-secret-wars","Action / Sci-Fi",160,"English","PG-13","2027-05-07",false,true,true],
    ["The Batman Part II","the-batman-part-ii","Action / Crime",145,"English","PG-13","2027-10-01",false,true,false],
    ["Avatar: Fire and Ash","avatar-fire-and-ash","Adventure / Sci-Fi",195,"English","PG-13","2026-12-19",false,true,true]
  ];
  const insertMovie=db.prepare(`INSERT INTO movies(title,slug,description,genre,duration_minutes,language,age_rating,release_date,is_now_showing,is_coming_soon,is_imax) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  for(const m of movies) insertMovie.run(m[0],m[1],`Experience ${m[0]} at Marquee Cinemas.`,m[2],m[3],m[4],m[5],m[6],m[7]?1:0,m[8]?1:0,m[9]?1:0);

  const cinemas=[
    ["Riverbend Mall","riverbend-mall","Riverbend Mall, Nairobi","Nairobi","+254 700 000001","Premium seating, Laser projection, Food & drinks"],
    ["Crossroads","crossroads","Crossroads Mall, Nairobi","Nairobi","+254 700 000002","Premium seating, IMAX, Food & drinks"],
    ["Ridgeview","ridgeview","Ridgeview Mall, Nairobi","Nairobi","+254 700 000003","Premium seating, Laser projection, Food & drinks"],
    ["Two Rivers","two-rivers","Two Rivers Mall, Nairobi","Nairobi","+254 700 000004","Premium seating, IMAX, Food & drinks"]
  ];
  const insertCinema=db.prepare("INSERT INTO cinemas(name,slug,address,city,phone,features_json) VALUES(?,?,?,?,?,?)");
  const cinemaIds=[];
  for(const c of cinemas) cinemaIds.push(insertCinema.run(c[0],c[1],c[2],c[3],c[4],JSON.stringify(c[5].split(", ")) ).lastInsertRowid);

  const insertScreen=db.prepare("INSERT INTO screens(cinema_id,name,screen_type,total_rows,total_columns) VALUES(?,?,?,?,?)");
  const insertSeat=db.prepare("INSERT INTO seats(screen_id,row_label,seat_number,seat_type) VALUES(?,?,?,?)");
  const screenIds=[];
  for(const cid of cinemaIds){
    const screens=[
      [cid,"Screen 1","STANDARD",8,12],
      [cid,"Screen 2","STANDARD",8,12],
      [cid,"IMAX","IMAX",10,14]
    ];
    for(const s of screens){
      const sid=insertScreen.run(...s).lastInsertRowid; screenIds.push({sid,cid,type:s[2]});
      for(let r=0;r<s[3];r++){
        const row=String.fromCharCode(65+r);
        for(let n=1;n<=s[4];n++){
          const type=(r>=s[3]-2)?"premium":"standard";
          insertSeat.run(sid,row,n,type);
        }
      }
    }
  }

  const movieIds=db.prepare("SELECT id FROM movies WHERE is_now_showing=1 ORDER BY id").all().map(x=>x.id);
  const insertShow=db.prepare("INSERT INTO showtimes(movie_id,screen_id,start_time,end_time,price,format,language) VALUES(?,?,?,?,?,?,?)");
  const times=["10:00","13:00","16:00","19:00","21:30"];
  let idx=0;
  for(const d of [0,1,2,3,4,5,6]){
    const date=new Date(Date.now()+d*86400000).toISOString().slice(0,10);
    for(const sc of screenIds){
      const movieId=movieIds[idx++%movieIds.length];
      const time=times[idx%times.length];
      const [h,min]=time.split(":").map(Number);
      const endMin=h*60+min+120;
      const end=`${String(Math.floor(endMin/60)%24).padStart(2,"0")}:${String(endMin%60).padStart(2,"0")}`;
      insertShow.run(movieId,sc.sid,`${date}T${time}:00`,`${date}T${end}:00`,sc.type==="IMAX"?1500:1000,sc.type==="IMAX"?"IMAX":"2D","English");
    }
  }

  const existing=db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if(existing) db.prepare("UPDATE users SET role='admin',password_hash=? WHERE id=?").run(hashPassword(adminPassword),existing.id);
  else db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)").run("Marquee Admin",adminEmail,hashPassword(adminPassword),"admin");
});

seed();
console.log("Database seeded.");
console.log(`Admin login: ${adminEmail}`);
console.log("Change ADMIN_PASSWORD in .env before using this outside local development.");
