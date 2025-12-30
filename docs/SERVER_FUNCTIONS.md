# Server Functions in SolidJS

Server Functions are a core primitive in Solid Start that allow you to run code exclusively on the server while calling it seamlessly from the client. They form the backbone of data fetching and mutation in Solid apps, bridging the network gap with RPC-style calls that handle serialization automatically.

## Basic Syntax

Server functions are standard JavaScript functions marked with the `"use server"` directive. They must be **asynchronous** (return a Promise).

### 1. Function Scope

You can mark individual functions as server-only. This is useful for co-locating server logic inside components or utility files.

```typescript
import { db } from './db'

async function toggleTodo(id: number) {
  'use server' // <--- This function runs only on the server
  console.log('Toggling todo on server:', id)
  return await db.todo.update({ where: { id }, data: { done: true } })
}
```

### 2. Module Scope

You can mark an entire file as server-only by placing the directive at the very top. All exported functions in this file become server functions.

**Important:** Only use module-scope `'use server'` for modules that are **not imported by client code**

If you export “server-only helpers” (like `requireDb()` returning a DB client), SolidStart can treat them as *client-callable* server functions. When those helpers return non-serializable values, SolidStart will crash while serializing the `/_server` response (often surfacing as a 503 HTML error page in dev, which then causes `Malformed server function stream header: !DOCTYPE h` on the client).

```typescript
// src/server/actions.ts
'use server'

import { db } from './db'

export async function getServerData() {
  return await db.query('...')
}
```

---

## Data Fetching: `query` and `createAsync`

For fetching data, wrap your server function in `query`. This integrates it with Solid Router's caching and deduplication mechanisms.

### Definition

```typescript
import { query } from '@solidjs/router'
import { db } from './db'

// 1. Define the server logic
const getUser = query(async (id: string) => {
  'use server'
  const user = await db.users.findUnique({ where: { id } })
  if (!user)
    throw new Error('User not found')
  return user
}, 'user') // <--- Unique key for caching
```

### Usage in Components

Use `createAsync` to consume the query. This integrates with `<Suspense>` and handles server-side streaming automatically.

```tsx
import { createAsync } from '@solidjs/router'
import { getUser } from './server-funcs'

export default function UserProfile(props: { id: string }) {
  // 2. Consume the data
  const user = createAsync(() => getUser(props.id))

  return (
    <div>
      <h1>
        Hello,
        {user()?.name}
      </h1>
    </div>
  )
}
```

---

## Data Mutation: `action`

For modifying data, wrap your server function in `action`. Actions provide lifecycle tracking (pending/error states) and integrate with HTML Forms for progressive enhancement.

### Definition

```typescript
import { action, redirect } from '@solidjs/router'
import { db } from './db'

const updateUser = action(async (formData: FormData) => {
  'use server'
  const id = String(formData.get('id'))
  const name = String(formData.get('name'))

  await db.users.update({ where: { id }, data: { name } })

  // Redirects thrown on the server are handled automatically
  throw redirect(`/users/${id}`)
}, 'update-user')
```

### Usage: Programmatic (`useAction`)

To use the action, use `useAction`.

```tsx
import { useAction } from '@solidjs/router'
import { toggleLike } from './actions'

export default function LikeButton(props: { id: string }) {
  const like = useAction(toggleLike)

  return (
    <button onClick={() => like(props.id)}>
      Like
    </button>
  )
}
```

### Usage: Argument Binding (`.with`)

You can curry arguments to actions using `.with()`. This is safer than hidden inputs for IDs.

```tsx
// Server Action
const deleteItem = action(async (id: string, formData: FormData) => {
  'use server'
  await db.delete(id)
})

// Component
<form action={deleteItem.with(props.id)} method="post">
  <button>Delete</button>
</form>
```

---

## Single Flight Mutations

SolidStart has a unique performance feature called **Single Flight Mutations**.

Normally, when a user submits a form, the browser:

1. Sends a POST request (mutation).
2. Receives a redirect.
3. Sends a GET request to the new page (fetching new data).

With Single Flight Mutations, if the destination route has a `preload` function, SolidStart will:

1. Execute the action (server function).
2. Catch the redirect on the server.
3. **Immediately run the `preload` function of the destination page on the server.**
4. Stream the HTML/data of the new page back in the *same* HTTP response.

**Requirement:** You must export a `preload` function in your route definition.

```typescript
// src/routes/users/[id].tsx
import { query } from '@solidjs/router'
import { getUser } from '~/server/api'

// 1. Define the data requirement
const userQuery = query(id => getUser(id), 'user')

// 2. Export a preload function
export const route = {
  preload: ({ params }) => userQuery(params.id)
}

export default function UserPage(props) {
  // ... component logic
}
```

---

## Revalidation

When an `action` completes successfully, Solid Router automatically revalidates all active `query` resources on the current page to ensure data is stale-free.

### Manual Revalidation

You can manually trigger revalidation using the `revalidate` function and the keys exposed by your queries.

```typescript
import { revalidate } from '@solidjs/router'
import { getUser } from './queries'

// In an event handler or effect
function handleRefresh() {
  // Revalidate all calls to this query
  revalidate(getUser.key)

  // OR revalidate only specific arguments
  revalidate(getUser.keyFor('user-123'))
}
```

---

## Type Safety and Serialization

### Serialization (Seroval)

Solid uses **Seroval** for serialization across the network. This supports far more types than standard JSON:

- `Date`, `BigInt`, `Set`, `Map`, `RegExp`
- `Promise`
- `Error` instances

### TypeScript

Since Server Functions are just functions, arguments and return values remain fully typed.

```typescript
// The return type Promise<User> is inferred automatically on the client
const user = await getUser('123')
```

---

## Server Context

To access request-specific information (headers, cookies, etc.) within a server function, use the helpers provided by `vinxi/http` or `solid-start/server`.

```typescript
import { getRequestEvent } from 'solid-js/web'
import { getCookie } from 'vinxi/http'

async function protectedAction() {
  'use server'
  const event = getRequestEvent() // Access standard request event
  const token = getCookie('auth_token') // Access cookies

  if (!token)
    throw new Error('Unauthorized')
  // ...
}
```

---

## Gotchas

### 1) “Helper server functions” can become real RPC endpoints

We hit a subtle failure mode when we put module-scope `'use server'` on a utilities file and exported helpers like:
- `requireUser()` → returns a user object (fine)
- `requireDb()` → returns the Drizzle DB instance (**not serializable**)

Because the module was `'use server'`, SolidStart treated these exports as server functions, so the client ended up calling them via `POST /_server` as separate RPC hops. The `requireDb()` response then tried to serialize the DB client and Seroval crashed.

### 2) Symptoms you’ll see when Seroval crashes

- **Network**: `POST /_server` returns **503** with an **HTML error page** (in dev).
- **Browser console**: `Malformed server function stream header: !DOCTYPE h`
  - This is a *secondary* error: it means the client expected the server-function stream format, but got HTML instead.

### 3) The safe pattern

- **Prefer function-scope `'use server'`** inside your `query(async () => { ... })` / `action(async () => { ... })` callbacks.
- Keep **server-only helpers** (especially anything that returns a DB client) in modules **without** module-scope `'use server'`, and only call them *inside* your server functions.
- Return **plain objects** across the server-function boundary; keep non-serializable things (DB clients, adapters, etc.) strictly on the server side.
