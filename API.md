# Thalacauvery Borewell Service – API Documentation

**Base URL:** `/api`  
**Auth:** `Authorization: Bearer <token>`

Replace `YOUR_TOKEN` and `http://localhost:5000` as needed.

---

## Machine Type

| Value   | Meaning                |
|---------|------------------------|
| `big`   | Big Machine only       |
| `small` | Small Machine only     |
| `both`  | Both machines (users)  |

- Query: `?machineType=big` or `?machineType=small`
- Server validates; invalid values are ignored
- User profiles may use `both | big | small`

---

## Auth

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "yourpassword"
  }'
```

**Response**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "name": "Admin",
    "username": "admin",
    "role": "admin"
  }
}
```

### Register (creates viewer only)

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Viewer",
    "username": "john",
    "password": "secret123",
    "phone": "9876543210"
  }'
```

---

## Users (Personal Information)

### List users

```bash
# All employees
curl "http://localhost:5000/api/users?type=Employee&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Users for Big Machine (includes machineType=big and both)
curl "http://localhost:5000/api/users?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search by name
curl "http://localhost:5000/api/users?search=kumar&type=Employee" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create user

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "type": "Employee",
    "name": "Ravi Kumar",
    "phone": "9876543210",
    "email": "ravi@example.com",
    "salary": 25000,
    "machineType": "big"
  }'
```

**machineType options:** `"both"` | `"big"` | `"small"` (default: `"both"`)

### Update user

```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ravi Kumar",
    "salary": 28000,
    "machineType": "both"
  }'
```

### Delete user

```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List brokers (dropdowns)

```bash
curl "http://localhost:5000/api/users/brokers" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Agent Rate Cards (Points)

### List rate cards

```bash
# Big Machine only
curl "http://localhost:5000/api/points?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Small Machine only
curl "http://localhost:5000/api/points?machineType=small&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by broker
curl "http://localhost:5000/api/points?machineType=big&brokerId=BROKER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create rate card

```bash
curl -X POST http://localhost:5000/api/points \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "brokerId": "BROKER_ID",
    "machineType": "big",
    "plasticOuter": { "rate": 120 },
    "plasticInner": { "rate": 100 },
    "jiOuter": { "rate": 90 },
    "jiInner": { "rate": 80 },
    "depthDetails": [
      { "range": "1-300 Feet", "rate": 50 },
      { "range": "300-400 Feet", "rate": 55 }
    ]
  }'
```

### Small machine example

```bash
curl -X POST http://localhost:5000/api/points \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "machineType": "small",
    "outerPipe": { "rate": 80 },
    "innerPipe": { "rate": 70 },
    "smallInnerPipe": { "rate": 60 },
    "depthDetails": [
      { "range": "0-200 Feet", "rate": 40 }
    ]
  }'
```

---

## Bills / Work Points

### List bills

```bash
curl "http://localhost:5000/api/borewell-points?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:5000/api/borewell-points?machineType=small&search=party" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create bill (Big Machine)

```bash
curl -X POST http://localhost:5000/api/borewell-points \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "partyName": "ABC Constructions",
    "machineType": "big",
    "brokerId": "BROKER_ID",
    "plasticOuterFeet": 100,
    "plasticInnerFeet": 80,
    "jiOuterFeet": 50,
    "jiInnerFeet": 40,
    "depthFeet": 450,
    "serviceType": "Point",
    "totalAmount": 85000,
    "paidAmount": 40000,
    "paymentStatus": "Partial"
  }'
```

### Create bill (Small Machine)

```bash
curl -X POST http://localhost:5000/api/borewell-points \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "partyName": "XYZ Farm",
    "machineType": "small",
    "outerPipeFeet": 120,
    "innerPipeFeet": 100,
    "smallPipeFeet": 50,
    "depthFeet": 300,
    "serviceType": "Flushing",
    "flushingAmount": 5000,
    "totalAmount": 35000,
    "paidAmount": 35000,
    "paymentStatus": "Paid"
  }'
```

### Update / Delete

```bash
curl -X PUT http://localhost:5000/api/borewell-points/BILL_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "paidAmount": 85000, "paymentStatus": "Paid" }'

curl -X DELETE http://localhost:5000/api/borewell-points/BILL_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Attendance

### List attendance

```bash
curl "http://localhost:5000/api/attendance?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:5000/api/attendance?machineType=small&search=ravi" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark attendance

```bash
curl -X POST http://localhost:5000/api/attendance \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "month": "2026-08",
    "machineType": "big",
    "absentDays": 2,
    "workingDays": 26,
    "notes": "2 days leave"
  }'
```

Unique per `(employeeId, month, machineType)`.

---

## Salary Advances

### List

```bash
curl "http://localhost:5000/api/salary-advances?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create

```bash
curl -X POST http://localhost:5000/api/salary-advances \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "month": "2026-08",
    "machineType": "small",
    "advanceAmount": 5000,
    "paymentMode": "gpay",
    "notes": "Festival advance"
  }'
```

`paymentMode`: `cash` | `gpay` | `net_banking` | `cheque`

---

## Materials

### List

```bash
curl "http://localhost:5000/api/materials?machineType=big&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:5000/api/materials?machineType=small&startDate=2026-08-01&endDate=2026-08-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create (JSON)

```bash
curl -X POST http://localhost:5000/api/materials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-15T00:00:00.000Z",
    "type": "Diesel",
    "machineType": "big",
    "quantity": 50,
    "costPerLiter": 95
  }'
```

---

## Dashboard

### Stats (machine-filtered)

```bash
# Big Machine dashboard
curl "http://localhost:5000/api/dashboard/stats?machineType=big" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Small Machine dashboard
curl "http://localhost:5000/api/dashboard/stats?machineType=small" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example response**
```json
{
  "success": true,
  "stats": {
    "totalEmployees": 12,
    "totalBrokers": 5,
    "totalPartners": 2,
    "totalMaterialsCost": 125000,
    "totalBorewellPoints": 48,
    "paidAmount": 890000,
    "pendingAmount": 210000
  }
}
```

### Charts

```bash
curl "http://localhost:5000/api/dashboard/charts?machineType=big" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Activity Logs

Partner / admin only.

```bash
curl "http://localhost:5000/api/activity-logs?machineType=big&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:5000/api/activity-logs?module=points&action=create&startDate=2026-08-01" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Health

```bash
curl http://localhost:5000/api/health
```

```json
{ "success": true, "status": "ok" }
```

---

## Frontend integration notes

After machine selection the app stores:

```text
localStorage.thalacauvery_machine = "big" | "small"
```

List and dashboard calls should always pass the current machine:

```js
api.get('/borewell-points', {
  params: { page: 1, limit: 10, machineType: currentMachine }
})

api.get('/dashboard/stats', {
  params: { machineType: currentMachine }
})
```

---

## Roles

| Role      | Access                               |
|-----------|--------------------------------------|
| `admin`   | Full write + Accounts + Activity Log |
| `partner` | Full write + Accounts + Activity Log |
| `viewer`  | Read-only                            |

Write endpoints return `403` for viewers.
