# Thalacauvery Borewell – Big / Small Machine Separation

## What changed

### Login flow
```
Login → Machine Selection → Big Machine or Small Machine Dashboard
```

### New files
- `frontend/client/src/context/MachineContext.jsx` – machine state + localStorage
- `frontend/client/src/pages/MachineSelection.jsx` – selection UI
- `frontend/client/src/components/MachineProtectedRoute.jsx` – blocks routes until machine is chosen

### Modified (frontend)
- `App.jsx` – new routes & flow
- `main.jsx` – wraps app with MachineProvider
- `Layout.jsx` – shows current machine + “Switch Machine”
- `Login.jsx` / `Register.jsx` – redirect to `/machine-selection`
- `Dashboard.jsx`, `Bills.jsx`, `BorewellPoints.jsx`, `Attendance.jsx`, `Materials.jsx` – filter by `machineType`
- `authSlice.js` – clears machine on logout
- `dashboardSlice.js` – passes `machineType` to APIs

### Modified (backend – Mongoose)
- Models: `Attendance`, `SalaryAdvance`, `Material`, `ActivityLog` – added `machineType` (`'small' | 'big'`, default `'small'`)
- Routes: `points`, `bills`, `attendance`, `materials`, `salaryAdvances`, `dashboard`, `activityLogs` – accept `?machineType=big|small` and filter server-side

### Already had machineType
- `BorewellPoint` and `Bill` already had `machineType` enum `['small','big']`

## Data separation
- When user selects **BIG MACHINE** → all list/dashboard queries send `machineType=big`
- When user selects **SMALL MACHINE** → `machineType=small`
- Server validates and filters; frontend alone is never trusted

## Personal Information
- Remains common (employee / partner / broker records are not machine-specific)

## How machine selection works
1. After login → `/machine-selection`
2. Click Big or Small → stored in React context + `localStorage` key `thalacauvery_machine`
3. Sidebar shows current machine badge
4. “Switch Machine” clears selection and returns to selection screen (does **not** logout)
5. Refresh keeps the selected machine (localStorage)

## Run locally

```bash
# Backend
cd backend/server
npm install
# set MONGO_URI in .env
npm start

# Frontend
cd frontend/client
npm install
npm run dev
```

## Deploy notes (Render)
1. Push these changes to your repo
2. Redeploy frontend + backend
3. Existing records without `machineType` will use schema default `'small'`
4. No data is deleted; fields are additive only

## Testing checklist
1. Login → see machine selection
2. Enter Big Machine → sidebar says BIG MACHINE
3. Points / Attendance / Dashboard show only big data
4. Switch Machine → selection screen
5. Enter Small Machine → only small data
6. Refresh → stays on same machine
7. Logout → machine cleared

## API documentation

See **[API.md](./API.md)** for full endpoint reference including `machineType` query parameters and request bodies.

