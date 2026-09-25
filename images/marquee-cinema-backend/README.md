# Marquee Cinema Backend

REST API for the Marquee Cinema frontend at https://pop254.github.io/cinema/

## Requirements
- Node.js 20+ (Node 26 works)
- npm

## Setup

1. Copy `.env.example` to `.env`.
2. Set a strong `ADMIN_PASSWORD`.
3. Install packages:

```bash
npm install
```

4. Create the database and demo data:

```bash
npm run seed
```

5. Start:

```bash
npm start
```

API: `http://localhost:4000/api`

## Main endpoints

- `GET /api/health`
- `GET /api/movies`
- `GET /api/movies/:id`
- `GET /api/cinemas`
- `GET /api/cinemas/:id/showtimes?date=YYYY-MM-DD`
- `GET /api/showtimes?movieId=&cinemaId=&date=`
- `GET /api/showtimes/:id/seats`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/bookings`
- `GET /api/bookings/:reference`
- `GET /api/me/bookings`
- `POST /api/contact`
- `POST /api/membership/join`

Admin routes require a logged-in admin session.

This project uses SQLite through better-sqlite3. The package version is set to a release with Node 26 prebuild support.
