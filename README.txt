Thalacuvery Borewell working layout

Frontend: frontend/client   (React 18 + Vite + MUI + Redux Toolkit)
Backend:  backend/server    (Express + Mongoose)

Run frontend development:
  cd frontend/client
  npm install
  npm run dev          # http://localhost:3000 (proxies /api to :5000)

Run backend:
  cd backend/server
  npm install
  npm start            # or: npm run dev (nodemon)

Build frontend into backend public folder:
  cd frontend/client
  npm run build

Seed login accounts (WARNING: deletes existing auth accounts):
  cd backend/server
  npm run seed

Roles (enforced on the server, not just the UI):
  partner / admin  → full control (create, edit, delete everything)
  viewer           → read-only access

- Public registration at /register always creates a read-only viewer.
- Partners manage accounts (create, promote, deactivate) from the
  "Accounts" page in the app sidebar.
- Activity Log and Accounts pages are partner/admin only.

API documentation:
  See API.md for endpoints, auth, and machineType parameters.
  See MACHINE_SEPARATION_README.md for Big/Small machine architecture.
