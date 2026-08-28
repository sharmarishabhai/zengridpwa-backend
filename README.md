# zengridpwa-backend

Node.js + Express + MongoDB backend starter with auth and roles.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/zengridpwa
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=change_this_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d
```

3. Start the API:

```bash
npm run dev
```

## User Roles

- `admin`
- `lrm`
- `sc`

## User Status

- `active`
- `inactive`
- `blocked`

## API Routes

### Public

- `POST /api/auth/login`
- `POST /api/auth/refresh`

Body:

```json
{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

Refresh body:

```json
{
  "refreshToken": "your_refresh_token_here"
}
```

### Protected

- `GET /api/auth/me`
- `POST /api/users` admin only, creates `lrm` or `sc`
- `GET /api/users` admin only, lists created team users
- `PATCH /api/users/:id` admin only, updates a user

### Health

- `GET /api/health`

## Notes

- Passwords are hashed with `bcryptjs`
- JWT auth uses `Authorization: Bearer <token>`
