## Overview

This project is a single-page application built with TypeScript and a custom client-side router.  
The application includes user authentication, transaction management, balance calculation, and basic analytics.

The project is split into a client and a server part and is intended as a learning / test assignment.  
Data is stored in memory only and is not persisted between server restarts.

---

## Architecture

The application follows a simple client–server architecture.

- Client: SPA with a custom router, rendered via HTML templates and JavaScript.
- Server: REST API built with Express and JWT-based authentication.
- State: stored on the client in `localStorage`.
- Data storage: in-memory TAFFY collections without persistence.

---

## Client

The client is built with TypeScript and bundled using Webpack.

HTML templates are located in `client/src/markups`. Components and services are assembled during the build process, and routing is handled on the client side.

### Router

The router (`client/src/router.ts`) works with the History API and loads page templates using `fetch`.  
It hides the navigation bar for guest users. At the same time, it does not initialize `Auth.navigateToPath` and contains an unused `Auth.processUnauthorizedResponse.bind(this)`.

### Services

- `Auth` (`client/src/services/auth.ts`)  
  Stores access and refresh tokens and handles token refresh.
- `Http`  
  Centralizes all `fetch` calls and retries requests after a 401 response.
- `DefaultCategoriesManager`  
  Automatically creates default categories on the user’s first login.
- `Filter` (`client/src/services/filter.ts`)  
  Filters transactions and prepares data for analytics.

### Components

- Login and registration forms (inherit from `UserManager`)
- Tables for transactions and categories (based on `BaseOperations`)
- Transaction creation and editing forms
- Analytics component (`client/src/components/analytics.ts`) built with Chart.js and a custom `Unselect` component

---

## Server

The server is built with Express and runs on Node.js.

### API Routes

Main routes are defined in `server/app.js`:

- `/api/login`, `/api/signup`, `/api/refresh`, `/api/logout`
- `/api/categories/{expense|income}`
- `/api/operations`
- `/api/balance`

Authorization is handled via `MiddlewareUtils.validateUser`.

### Controllers and Data

Controllers perform basic validation and work with TAFFY models.  
The balance is recalculated on every transaction CRUD operation (`server/controllers/operation.controller.js`).

### Authentication

Tokens are issued by `TokenUtils` using a single shared secret.

- Access token lifetime: 15 minutes
- Refresh token lifetime: 1 or 30 days
- Refresh tokens are stored in memory (`server/utils/token.utils.js`)

---

## Tests

Test coverage is minimal.

- One unit test for the signup form (`client/__tests__/components/signup.test.ts`)
- Placeholders for end-to-end tests (Playwright)
- MSW mocks for API stubbing

---

## User Scenarios

First-time registration:  
The user navigates to `/signup`, enters full name, email, and password, confirms registration, and immediately enters the application with default categories already created.

Returning login:  
The user opens `/login`, enters email and password (optionally enabling “Remember me”), and accesses the personal dashboard.

View balance and transactions:  
On the “Transactions” page, the user sees the current balance and a table with all transactions.

Filter transactions by period:  
The user can filter transactions by predefined periods (“Today”, “Week”, “Month”, “Year”, “All”) or by a custom date range.

Create a transaction:  
The user adds an income or expense, fills in the form, saves it, and returns to the list.

Edit or delete a transaction:  
Existing transactions can be edited via the pencil icon or deleted via the trash icon, with balance recalculated automatically.

View analytics:  
The “Analytics” page shows pie charts for income and expenses grouped by category, using the same period filters.

Log out:  
The user logs out via the header menu and is redirected to the login page.

---

## Technical Assignment

### Stage 1

Layout of all pages, including form validation error states.  
Result: all pages match the design mockups and have responsive versions.

### Stage 2

Full implementation of registration and authentication.  
An application shell and core router are introduced.

Result: authentication works fully, while all other pages are rendered as static layouts without internal logic.

Stage 2 includes:
1. Implementation of login and registration pages with client-side validation and visual error states. Authentication uses a standard token exchange flow based on the provided YAML specification and should be tested in Postman before implementation.
2. Implementation of the application core and router. Unauthorized users are redirected to the login page. Authorized users can access all pages except registration. All pages are rendered through the routing mechanism, not by directly opening HTML files.

### Stage 3

Project completion.  
Result: a fully finished application that meets the design and technical requirements.

This stage includes implementation of all remaining functionality according to the specification and design mockups.

---

## Local Development

### Start the server

```bash
cd server
npm install
npm start
```

Start the client
```bash
cd client
npm install
npm run dev
```

The server runs on http://localhost:3000.
The client is available at http://localhost:8080 by default (webpack-dev-server).
