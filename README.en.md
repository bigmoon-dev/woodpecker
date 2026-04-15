# Woodpecker - Psychological Early-Warning Assist System

A K-12 school-oriented psychological health scale assessment platform. Supports importing scales via Excel, online student testing, automatic scoring, and tiered alerting.

[![CI](https://github.com/bigmoon-dev/woodpecker/actions/workflows/ci.yml/badge.svg)](https://github.com/bigmoon-dev/woodpecker/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-90.23%25-brightgreen)](./src/modules/scoring/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

> The woodpecker is the "forest doctor" — symbolizing early detection and early intervention to safeguard students' mental health.

[中文](./README.md) | English

---

## Features

- **Scale Management** — Create/edit psychological scales; batch import via Excel (.xlsx) templates
- **Automatic Scoring Engine** — Three scoring strategies (sum, weighted, dimension), automatic reverse-score handling, score-to-level range matching
- **Tiered Alerting** — Auto-triggers red/yellow alerts based on assessment results; supports handling, follow-up, and notification workflows
- **Organizational Hierarchy** — Grade → Class → Student three-level structure with batch import
- **RBAC Permissions** — Role-based access control; admins can dynamically configure roles and permission points via UI
- **Informed Consent** — Students must sign a consent form before taking assessments, complying with minor protection regulations
- **Data Desensitization** — Expired student data is automatically hashed (configurable retention period), complying with data security laws
- **Audit Logging** — Global operation audit interceptor recording critical action trails
- **Plugin System** — Core features are non-pluggable; extensions (Excel import, report export) are implemented as plugins
- **Single-Process Deployment** — Frontend Vite build outputs to `public/`; NestJS serves both API and static files in one process

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11 + TypeScript |
| Database | PostgreSQL (TypeORM) |
| Authentication | Passport-JWT + bcrypt |
| Frontend | React 18 + Ant Design 5 + ProComponents |
| Frontend Build | Vite 6 |
| Code Quality | ESLint + Prettier + Jest |

## System Architecture

```
┌─────────────────────────────────────────────┐
│                 NestJS Server                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Auth     │ │ Scale    │ │  Task        │ │
│  │ JWT+RBAC │ │ CRUD     │ │  Test+Score  │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Alert    │ │ Org      │ │ Plugin       │ │
│  │ Workflow │ │ Hierarchy│ │ Management   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Audit    │ │ Consent  │ │ Scoring      │ │
│  │ +Desens. │ │ Check    │ │ 3 Strategies │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│         │ TypeORM │ @nestjs/serve-static    │
│         ▼        ▼                          │
│    PostgreSQL    public/ (React SPA)        │
└─────────────────────────────────────────────┘
```

## Backend Modules

| Module | Path | Responsibility |
|--------|------|----------------|
| `auth` | `src/modules/auth/` | JWT authentication, RBAC guard, data scope filtering |
| `scale` | `src/modules/scale/` | Scale CRUD, Excel import parsing |
| `scoring` | `src/modules/scoring/` | Scoring engine (sum/weighted/dimension), score-range matching |
| `task` | `src/modules/task/` | Assessment task creation, publishing, answer submission |
| `result` | `src/modules/result/` | Result querying, report export |
| `alert` | `src/modules/alert/` | Alert triggering, handling, follow-up |
| `org` | `src/modules/org/` | Grade/class/student hierarchy management |
| `admin` | `src/modules/admin/` | Role/permission/user management |
| `consent` | `src/modules/consent/` | Informed consent signing and verification |
| `audit` | `src/modules/audit/` | Operation audit logging, scheduled data desensitization |
| `plugin` | `src/modules/plugin/` | Plugin registration/enable/disable, hook bus |
| `core` | `src/modules/core/` | Encryption utilities |

## Frontend Pages

| Role | Pages |
|------|-------|
| Login | `/login` |
| Student | Task list, online assessment, my results, informed consent |
| Teacher/Psychologist | Scale management, task management, class/grade results, alert handling |
| Admin | Role management, user management, plugin management, grade/class/student management |

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### Installation

```bash
cd ~/project/psych-scale-server

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Build frontend (outputs to public/)
cd client && npm run build && cd ..
```

### Configuration

Create a `.env` file (or set environment variables):

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=psych_scale
DB_SYNC=false

# JWT
JWT_SECRET=your-jwt-secret-change-in-production

# Data retention (days)
DATA_RETENTION_DAYS=365
```

### Database Migration

```bash
# Run migrations
npm run migration:run

# Or use auto-sync in development
# Set DB_SYNC=true
```

### Running

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Access the application at `http://localhost:3000`.

## API Overview

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | User login |
| `POST /api/auth/refresh` | Refresh token |
| `GET /api/auth/me` | Current user info |
| `CRUD /api/scales` | Scale management |
| `POST /api/scales/import` | Import scale from Excel |
| `CRUD /api/tasks` | Assessment tasks |
| `POST /api/tasks/:id/answers/submit` | Submit answers |
| `POST /api/tasks/:id/publish` | Publish task |
| `GET /api/results/me` | My results |
| `GET /api/results` | Query results by permission scope |
| `CRUD /api/alerts` | Alert management |
| `CRUD /api/admin/grades` | Grade management |
| `CRUD /api/admin/classes` | Class management |
| `CRUD /api/admin/students` | Student management |
| `CRUD /api/admin/roles` | Role management |
| `CRUD /api/admin/users` | User management |
| `GET/POST /api/admin/plugins` | Plugin management |

## Testing

```bash
# Run all unit tests
npm test

# With coverage report
npm run test:cov

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

The scoring engine has >95% test coverage (92 source files, 20 test suites, 120 test cases).

## Code Quality

```bash
# TypeScript type checking
npx tsc --noEmit

# ESLint
npm run lint

# Prettier formatting
npm run format
```

## Plugin Development

Implement the `IPlugin` interface to create a new plugin:

```typescript
import { IPlugin, PluginRoute } from './modules/plugin/plugin.interface';

export class MyPlugin implements IPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My custom plugin';

  getRoutes(): PluginRoute[] {
    return [{ method: 'GET', path: '/api/plugins/my-plugin/hello', handler: 'hello' }];
  }

  getHooks() { return []; }
}
```

Register the plugin instance in `PluginManager.onModuleInit()`.

## Project Structure

```
psych-scale-server/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── layouts/         # Layout components
│   │   ├── router/          # Route configuration
│   │   └── utils/           # Utility functions
│   └── vite.config.ts
├── src/
│   ├── modules/             # Business modules
│   │   ├── admin/           # Admin panel
│   │   ├── alert/           # Alerting
│   │   ├── auth/            # Authentication
│   │   ├── audit/           # Audit logging
│   │   ├── consent/         # Informed consent
│   │   ├── core/            # Core utilities
│   │   ├── org/             # Organization hierarchy
│   │   ├── plugin/          # Plugin system
│   │   ├── result/          # Assessment results
│   │   ├── scale/           # Scale management
│   │   ├── scoring/         # Scoring engine
│   │   └── task/            # Assessment tasks
│   ├── entities/            # TypeORM entities
│   ├── plugins/             # Plugin implementations
│   ├── common/              # Shared utilities
│   ├── migrations/          # Database migrations
│   └── main.ts              # Entry point
├── public/                  # Frontend build output
├── test/                    # E2E tests
└── package.json
```

## Compliance

- **Data Security Law** — Student PII is encrypted at rest; expired data is automatically hashed for desensitization
- **Minors Protection Law** — Informed consent mechanism requires student sign-off before assessment
- **Audit Trail** — Global operation audit logging for traceability of critical actions

## Roadmap

See [ROADMAP.md](./docs/ROADMAP.md) for implemented features and planned work.

## License

[Apache-2.0](./LICENSE)
