# School Bus Management System

A complete web application for managing 44 school buses at **Prathibha Junior College**. Uses free tools only: Google Sheets as database, OpenStreetMap for live bus tracking, and WhatsApp (WATI or wa.me) for parent notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Google Sheets API |
| Notifications | WATI WhatsApp API (fallback: wa.me links) |
| QR Codes | `qrcode` npm package |
| GPS / Maps | OpenStreetMap + Leaflet.js (CDN, no API key) |

## Project Structure

```
school-bus-system/
├── client/           → React frontend (port 5173)
├── server/           → Express API (port 3002)
├── qr-generator/     → QR card generator script
├── .env              → Environment variables
└── README.md
```

## Prerequisites

- Node.js 18+
- Google Cloud project with Sheets API enabled
- Service account with access to the spreadsheet
- (Optional) WATI WhatsApp API credentials

No map API key is required — maps use OpenStreetMap tiles via Leaflet.js CDN.

## Google Sheets Setup

Share the spreadsheet with your service account email (Editor access).

Run the header setup script once:

```bash
cd server
node setup-sheets.js
```

### Sheet tabs and columns

**Students:** `student_id | name | class | bus_number | stop_name | parent_name | parent_whatsapp | fee_status | fee_due_date`

**Attendance:** `timestamp | student_id | student_name | bus_number | stop_name | boarded_at | driver_name | date | notification_status | scan_type | dropoff_time | scanned_by | arrival_time`

**Scan types:** `boarding` · `college_arrival` · `dropoff` · `return_boarding`

**Buses:** `bus_number | driver_name | driver_phone | route_name | capacity | current_lat | current_lng | last_updated | morning_start_time | return_start_time | journey_type | current_status | morning_end_time | return_end_time`

**Incidents:** `date | student_id | student_name | bus_number | driver_name | incident_type | details | timestamp`

**Incident types:** `missed_driver_scan` · `fee_defaulter` · `duplicate_scan` · `not_dropped_off`

## Environment Variables

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WATI_API_KEY=your_wati_key
WATI_API_ENDPOINT=https://live-server.wati.io/xxxx
SCHOOL_NAME=Prathibha Junior College
ADMIN_PASSWORD=admin123
RECEPTION_PIN=9999
ADMIN_WHATSAPP=+91XXXXXXXXXX
PORT=3002
DROPOFF_CUTOFF_TIME=15:00
NOT_DROPPED_ALERT_TIME=17:00
CLIENT_URL=http://localhost:5173
DRIVER_PINS={"1":"0001","2":"0002"}   # optional
```

## Installation

```bash
npm run install:all
```

## Running the App

**Terminal 1 — Backend:**
```bash
cd server
npm start
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open: **http://localhost:5173**

## App Routes

| Route | Description |
|-------|-------------|
| `/` | Home page with links |
| `/driver` | Driver app (PIN login, QR scan, morning + return journey) |
| `/reception` | College gate scanner (reception PIN) |
| `/admin` | Admin dashboard (password protected) |
| `/track/:bus_number` | Parent live bus tracking |

## Daily WhatsApp flow for parents

1. 🚌 Bus started (morning)
2. ✅ Child boarded the bus
3. ✅ Child arrived at college (reception scan)
4. 🚌 Bus started return journey
5. 📍 Child dropped off at stop

## Driver Login

Default PIN for Bus N is `000N` (e.g. Bus 1 → `0001`).

## Reception Login

Default PIN: `9999` (set via `RECEPTION_PIN` in `.env`).

## Generate QR Cards

```bash
node qr-generator/generate.js
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Driver scan (boarding/dropoff/return) |
| POST | `/api/reception/scan` | College gate arrival scan |
| POST | `/api/bus/start` | Start morning journey |
| POST | `/api/bus/stop` | End morning journey |
| POST | `/api/bus/start-return` | Start return journey |
| POST | `/api/bus/stop-return` | End return journey |
| GET | `/api/reception/summary` | Reception dashboard stats |
| GET | `/api/incidents` | All incidents (admin) |
| GET | `/api/dashboard` | Admin stats + driver performance |
| GET | `/api/students` | All students |
| GET | `/api/attendance` | Attendance by date |
| GET | `/api/bus/:number` | Bus info + location |
| POST | `/api/bus/location` | Update GPS |
| PUT | `/api/fee/:id` | Toggle fee status |

## Features

- **Driver App** — Morning start, return journey, QR/manual scan, fee alerts, GPS
- **Reception Scanner** — College gate arrivals, missed driver scan detection
- **Incidents** — Auto-logged missed scans, fee defaulters, duplicates, not dropped off
- **Admin Dashboard** — Stats, attendance by scan type, incidents, driver performance flags
- **Parent Tracking** — Live bus map
- **CSV Export** — Attendance, unpaid fees, incidents

## Production Build

```bash
cd client
npm run build
```

## License

MIT — Free for educational use.
