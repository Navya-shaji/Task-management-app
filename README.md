# TaskFlow — Full-Stack Task Management Application

A production-ready task management app built with **Node.js/Express**, **Next.js 14**, and **PostgreSQL**.

## Features

- **Authentication** — JWT-based signup/login, bcrypt password hashing, persisted auth state
- **Task CRUD** — Create, read, update, delete tasks with full validation
- **Filtering & Search** — Filter by status/priority, search by title, sort by date/priority
- **Pagination** — Server-side pagination on all task lists
- **Real-time Updates** — WebSocket connection reflects task changes live
- **Optimistic UI** — Create/update/delete update the UI instantly with rollback on failure
- **File Attachments** — Upload images and documents to tasks
- **Activity Log** — Full history of changes per task
- **Role-based Access** — Admin role can view all users and tasks
- **Dark Mode** — Theme toggle with persisted preference
- **Responsive** — Mobile-first layout
- **Docker** — One-command local setup via `docker-compose`
- **CI** — GitHub Actions pipeline runs tests on every push

---

## Tech Stack

| Layer     | Technology                         |
|-----------|------------------------------------|
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Backend   | Node.js, Express                   |
| Database  | PostgreSQL 16                      |
| Auth      | JWT + bcryptjs                     |
| Real-time | WebSockets (ws)                    |
| Testing   | Jest + Supertest                   |
| DevOps    | Docker, Docker Compose, GitHub Actions |

---

## Quick Start (Docker — Recommended)

```bash
git clone <your-repo-url> taskflow
cd taskflow

# Start everything: PostgreSQL + backend + frontend
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Health: http://localhost:4000/health

---

## Manual Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials

npm install
npm run migrate        # creates tables
npm run dev            # starts on :4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000

npm install
npm run dev            # starts on :3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable         | Description                        | Default                  |
|------------------|------------------------------------|--------------------------|
| `PORT`           | Server port                        | `4000`                   |
| `DATABASE_URL`   | PostgreSQL connection string       | (required)               |
| `JWT_SECRET`     | Secret for signing JWTs            | (required, keep secret)  |
| `JWT_EXPIRES_IN` | Token expiry                       | `7d`                     |
| `FRONTEND_URL`   | CORS allowed origin                | `http://localhost:3000`  |
| `UPLOAD_DIR`     | Directory for file uploads         | `uploads`                |
| `MAX_FILE_SIZE`  | Max upload size in bytes           | `10485760` (10MB)        |

### Frontend (`frontend/.env.local`)

| Variable                | Description             | Default                       |
|-------------------------|-------------------------|-------------------------------|
| `NEXT_PUBLIC_API_URL`   | Backend base URL        | `http://localhost:4000`       |
| `NEXT_PUBLIC_WS_URL`    | WebSocket URL           | `ws://localhost:4000/ws`      |

---

## API Reference

### Auth

| Method | Path           | Auth | Description         |
|--------|----------------|------|---------------------|
| POST   | /auth/signup   | —    | Register new user   |
| POST   | /auth/login    | —    | Login, get JWT      |
| GET    | /auth/me       | JWT  | Get current user    |

### Tasks

| Method | Path                              | Auth  | Description              |
|--------|-----------------------------------|-------|--------------------------|
| POST   | /tasks                            | JWT   | Create task              |
| GET    | /tasks                            | JWT   | List tasks (filter/sort/page) |
| GET    | /tasks/:id                        | JWT   | Get single task          |
| PATCH  | /tasks/:id                        | JWT   | Update task              |
| DELETE | /tasks/:id                        | JWT   | Delete task              |
| POST   | /tasks/:id/attachments            | JWT   | Upload file to task      |
| DELETE | /tasks/:id/attachments/:aid       | JWT   | Remove attachment        |
| GET    | /tasks/:id/activity               | JWT   | Get activity log         |

### Admin (requires admin role)

| Method | Path                     | Description          |
|--------|--------------------------|----------------------|
| GET    | /admin/users             | List all users       |
| GET    | /admin/tasks             | List all tasks       |
| PATCH  | /admin/users/:id/role    | Change user role     |

---

## Running Tests

```bash
cd backend
npm test
```

The test suite covers:
- Auth: signup, login, duplicate email, invalid credentials, token validation
- Tasks: CRUD, validation, authorization, pagination, search
- Validation: error response structure, 404 handling, health check

---

## Project Structure

```
taskflow/
├── backend/
│   ├── src/
│   │   ├── db/          # Pool config and migrations
│   │   ├── middleware/  # auth, validation, error handler
│   │   ├── routes/      # auth, tasks, attachments, admin
│   │   ├── ws/          # WebSocket broadcaster
│   │   ├── tests/       # Jest test suites
│   │   └── server.js    # Entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js App Router pages
│   │   ├── components/  # UI + task-specific components
│   │   ├── contexts/    # Auth + Theme context
│   │   ├── hooks/       # useTasks, useWebSocket
│   │   ├── lib/         # API client, utils
│   │   └── types/       # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .github/workflows/ci.yml
└── README.md
```

---

## Assumptions & Trade-offs

- **File storage is local** — In production, this should be replaced with S3 or similar object storage. The current implementation stores files in the `uploads/` directory.
- **WebSocket auth via query param** — JWT is passed as a query string (`?token=...`) for the WS handshake, which is standard for browser WebSocket connections that can't set custom headers.
- **No refresh tokens** — JWTs expire after 7 days. For a production app, a refresh token mechanism would be added.
- **Admin promotion is manual** — The first admin must be set directly in the database. After that, admins can promote others via the admin panel.
- **No email verification** — Skipped for scope; would be added in production.
- **Optimistic UI with full rollback** — Uses TanStack Query's `onMutate`/`onError` pattern to update the UI instantly and revert if the server call fails.

---

## Author

Built for the Rival.io Full-Stack Developer Assessment.
