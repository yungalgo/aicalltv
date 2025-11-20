Overview –
TanStack Start Overview
TanStack Start is a full-stack React framework powered by TanStack Router. It provides a full-document SSR, streaming, server functions, bundling, and more. Thanks to Vite, it's ready to develop and deploy to any hosting provider or runtime you want!

Learn the Basics –
Learn the Basics
This guide will help you learn the basics behind how TanStack Start works, regardless of how you set up your project.

Dependencies
TanStack Start is powered by Vite and TanStack Router.

TanStack Router: A router for building web applications.

Vite: A build tool for bundling your application.

It all "Starts" with the Router
This is the file that will dictate the behavior of TanStack Router used within Start. Here, you can configure everything
from the default preloading functionality to caching staleness.

// src/router.tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
const router = createTanStackRouter({
routeTree,
scrollRestoration: true,
})

return router
}

declare module '@tanstack/react-router' {
interface Register {
router: ReturnType<typeof createRouter>
}
}
Notice the scrollRestoration property. This is used to restore the scroll position of the page when navigating between routes.

Route Generation
The routeTree.gen.ts file is generated when you run TanStack Start (via npm run dev or npm run start) for the first time. This file contains the generated route tree and a handful of TS utilities that make TanStack Start fully type-safe.

The Server Entry Point (Optional)
[!NOTE]
The server entry point is optional out of the box. If not provided, TanStack Start will automatically handle the server entry point for you using the below as a default.

This is done via the src/server.ts file:

// src/server.ts
import {
createStartHandler,
defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
createRouter,
})(defaultStreamHandler)
Whether we are statically generating our app or serving it dynamically, the server.ts file is the entry point for doing all SSR-related work.

It's important that a new router is created for each request. This ensures that any data handled by the router is unique to the request.

The defaultStreamHandler function is used to render our application to a stream, allowing us to take advantage of streaming HTML to the client. (This is the default handler, but you can also use other handlers like defaultRenderHandler, or even build your own)

The Client Entry Point (Optional)
[!NOTE]
The client entry point is optional out of the box. If not provided, TanStack Start will automatically handle the client entry point for you using the below as a default.

Getting our html to the client is only half the battle. Once there, we need to hydrate our client-side JavaScript once the route resolves to the client. We do this by hydrating the root of our application with the StartClient component:

// src/client.tsx
import { StartClient } from '@tanstack/react-start'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(
document,
<StrictMode>
<StartClient router={router} />
</StrictMode>,
)
This enables us to kick off client-side routing once the user's initial server request has fulfilled.

The Root of Your Application
Other than the client entry point (which is optional by default), the \_\_root route of your application is the entry point for your application. The code in this file will wrap all other routes in the app, including your home page. It behaves like a pathless layout route for your whole application.

Because it is always rendered, it is the perfect place to construct your application shell and take care of any global logic.

// src/routes/\_\_root.tsx
import {
Outlet,
createRootRoute,
HeadContent,
Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
head: () => ({
meta: [
{
charSet: 'utf-8',
},
{
name: 'viewport',
content: 'width=device-width, initial-scale=1',
},
{
title: 'TanStack Start Starter',
},
],
}),
component: RootComponent,
})

function RootComponent() {
return (
<RootDocument>
<Outlet />
</RootDocument>
)
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
return (

<html>
<head>
<HeadContent />
</head>
<body>
{children}
<Scripts />
</body>
</html>
)
}
This layout may change in the future as we roll out SPA mode, which allows the root route to render the SPA shell without any page-specific content.

Notice the Scripts component. This is used to load all of the client-side JavaScript for the application.

Routes
Routes are an extensive feature of TanStack Router, and are covered thoroughly in the Routing Guide. As a summary:

Routes are defined using the createFileRoute function.

Routes are automatically code-split and lazy-loaded.

Critical data fetching is coordinated from a Route's loader

Much more!

// src/routes/index.tsx
import \* as fs from 'node:fs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const filePath = 'count.txt'

async function readCount() {
return parseInt(
await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
)
}

const getCount = createServerFn({
method: 'GET',
}).handler(() => {
return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
.validator((d: number) => d)
.handler(async ({ data }) => {
const count = await readCount()
await fs.promises.writeFile(filePath, `${count + data}`)
})

export const Route = createFileRoute('/')({
component: Home,
loader: async () => await getCount(),
})

function Home() {
const router = useRouter()
const state = Route.useLoaderData()

return (
<button
type="button"
onClick={() => {
updateCount({ data: 1 }).then(() => {
router.invalidate()
})
}} >
Add 1 to {state}?
</button>
)
}
Navigation
TanStack Start builds 100% on top of TanStack Router, so all of the navigation features of TanStack Router are available to you. In summary:

Use the Link component to navigate to a new route.

Use the useNavigate hook to navigate imperatively.

Use the useRouter hook anywhere in your application to access the router instance and perform invalidations.

Every router hook that returns state is reactive, meaning it will automatically re-run when the appropriate state changes.

Here's a quick example of how you can use the Link component to navigate to a new route:

import { Link } from '@tanstack/react-router'

function Home() {
return <Link to="/about">About</Link>
}
For more in-depth information on navigation, check out the navigation guide.

Server Functions (RPCs)
You may have noticed the server function we created above using createServerFn. This is one of TanStack's most powerful features, allowing you to create server-side functions that can be called from both the server during SSR and the client!

Here's a quick overview of how server functions work:

Server functions are created using the createServerFn function.

They can be called from both the server during SSR and the client.

They can be used to fetch data from the server, or to perform other server-side actions.

Here's a quick example of how you can use server functions to fetch and return data from the server:

import { createServerFn } from '@tanstack/react-start'
import \* as fs from 'node:fs'
import { z } from 'zod'

const getUserById = createServerFn({ method: 'GET' })
// Always validate data sent to the function, here we use Zod
.validator(z.string())
// The handler function is where you perform the server-side logic
.handler(async ({ data }) => {
return db.query.users.findFirst({ where: eq(users.id, data) })
})

// Somewhere else in your application
const user = await getUserById({ data: '1' })
To learn more about server functions, check out the server functions guide.

Mutations
Server Functions can also be used to perform mutations on the server. This is also done using the same createServerFn function, but with the additional requirement that you invalidate any data on the client that was affected by the mutation.

If you're using TanStack Router only, you can use the router.invalidate() method to invalidate all router data and re-fetch it.

If you're using TanStack Query, you can use the queryClient.invalidateQueries() method to invalidate data, among other more specific methods to target specific queries.

Here's a quick example of how you can use server functions to perform a mutation on the server and invalidate the data on the client:

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { dbUpdateUser } from '...'

const UserSchema = z.object({
id: z.string(),
name: z.string(),
})
export type User = z.infer<typeof UserSchema>

export const updateUser = createServerFn({ method: 'POST' })
.validator(UserSchema)
.handler(({ data }) => dbUpdateUser(data))

// Somewhere else in your application
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { updateUser, type User } from '...'

export function useUpdateUser() {
const router = useRouter()
const queryClient = useQueryClient()
const \_updateUser = useServerFn(updateUser)

return useCallback(
async (user: User) => {
const result = await \_updateUser({ data: user })

      router.invalidate()
      queryClient.invalidateQueries({
        queryKey: ['users', 'updateUser', user.id],
      })

      return result
    },
    [router, queryClient, _updateUser],

)
}

// Somewhere else in your application
import { useUpdateUser } from '...'

function MyComponent() {
const updateUser = useUpdateUser()
const onClick = useCallback(async () => {
await updateUser({ id: '1', name: 'John' })
console.log('Updated user')
}, [updateUser])

return <button onClick={onClick}>Click Me</button>
}
To learn more about mutations, check out the mutations guide.

Data Loading
Another powerful feature of TanStack Router is data loading. This allows you to fetch data for SSR and preload route data before it is rendered. This is done using the loader function of a route.

Here's a quick overview of how data loading works:

Data loading is done using the loader function of a route.

Data loaders are isomorphic, meaning they are executed on both the server and the client.

For performing server-only logic, call a server function from within the loader.

Similar to TanStack Query, data loaders are cached on the client and are re-used and even re-fetched in the background when the data is stale.

To learn more about data loading, check out the data loading guide.

Server Functions –
Server Functions
What are Server Functions?
Server functions allow you to specify logic that can be invoked almost anywhere (even the client), but run only on the server. In fact, they are not so different from an API Route, but with a few key differences:

They do not have stable public URL.

They can be called from anywhere in your application, including loaders, hooks, components, server routes etc.

However, they are similar to regular API Routes in that:

They have access to the request context, allowing you to read headers, set cookies, and more

They can access sensitive information, such as environment variables, without exposing them to the client

They can be used to perform any kind of server-side logic, such as fetching data from a database, sending emails, or interacting with other services

They can return any value, including primitives, JSON-serializable objects, and even raw Response objects

They can throw errors, including redirects and notFounds, which can be handled automatically by the router

How are server functions different from "React Server Functions"?

TanStack Server Functions are not tied to a specific front-end framework, and can be used with any front-end framework or none at all.

TanStack Server Functions are backed by standard HTTP requests and can be called as often as you like without suffering from serial-execution bottlenecks.

How do they work?
Server functions can be defined anywhere in your application, but must be defined at the top level of a file. They can be called throughout your application, including loaders, hooks, etc. Traditionally, this pattern is known as a Remote Procedure Call (RPC), but due to the isomorphic nature of these functions, we refer to them as server functions.

On the server bundle, server functions logic is left alone. Nothing needs to be done since they are already in the correct place.

On the client, server functions will be removed; they exist only on the server. Any calls to the server function on the client will be replaced with a fetch request to the server to execute the server function, and send the response back to the client.

Server Function Middleware
Server functions can use middleware to share logic, context, common operations, prerequisites, and much more. To learn more about server function middleware, be sure to read about them in the Middleware guide.

Defining Server Functions
We'd like to thank the tRPC team for both the inspiration of TanStack Start's server function design and guidance while implementing it. We love (and recommend) using tRPC for API Routes so much that we insisted on server functions getting the same 1st class treatment and developer experience. Thank you!

Server functions are defined with the createServerFn function, from the @tanstack/react-start package. This function takes an optional options argument for specifying configuration like the HTTP method and response type, and allows you to chain off the result to define things like the body of the server function, input validation, middleware, etc. Here's a simple example:

// getServerTime.ts
import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn().handler(async () => {
// Wait for 1 second
await new Promise((resolve) => setTimeout(resolve, 1000))
// Return the current time
return new Date().toISOString()
})
Configuration Options
When creating a server function, you can provide configuration options to customize its behavior:

import { createServerFn } from '@tanstack/react-start'

export const getData = createServerFn({
method: 'GET', // HTTP method to use
response: 'data', // Response handling mode
}).handler(async () => {
// Function implementation
})
Available Options
method

Specifies the HTTP method for the server function request:

method?: 'GET' | 'POST'
By default, server functions use GET if not specified.

response

Controls how responses are processed and returned:

response?: 'data' | 'full' | 'raw'
'data' (default): Automatically parses JSON responses and returns just the data

'full': Returns a response object with result data, error information, and context

'raw': Returns the raw Response object directly, enabling streaming responses and custom headers

Where can I call server functions?
From server-side code

From client-side code

From other server functions

[!WARNING]
Server functions cannot be called from API Routes. If you need to share business logic between server functions and API Routes, extract the shared logic into utility functions that can be imported by both.

Accepting Parameters
Server functions accept a single parameter, which can be a variety of types:

Standard JavaScript types

string

number

boolean

null

Array

Object

FormData

ReadableStream (of any of the above)

Promise (of any of the above)

Here's an example of a server function that accepts a simple string parameter:

import { createServerFn } from '@tanstack/react-start'

export const greet = createServerFn({
method: 'GET',
})
.validator((data: string) => data)
.handler(async (ctx) => {
return `Hello, ${ctx.data}!`
})

greet({
data: 'John',
})
Runtime Input Validation / Type Safety
Server functions can be configured to validate their input data at runtime, while adding type safety. This is useful for ensuring the input is of the correct type before executing the server function, and providing more friendly error messages.

This is done with the validator method. It will accept whatever input is passed to the server function. The value (and type) you return from this function will become the input passed to the actual server function handler.

Validators also integrate seamlessly with external validators, if you want to use something like Zod.

Basic Validation
Here's a simple example of a server function that validates the input parameter:

import { createServerFn } from '@tanstack/react-start'

type Person = {
name: string
}

export const greet = createServerFn({ method: 'GET' })
.validator((person: unknown): Person => {
if (typeof person !== 'object' || person === null) {
throw new Error('Person must be an object')
}

    if ('name' in person && typeof person.name !== 'string') {
      throw new Error('Person.name must be a string')
    }

    return person as Person

})
.handler(async ({ data }) => {
return `Hello, ${data.name}!`
})
Using a Validation Library
Validation libraries like Zod can be used like so:

import { createServerFn } from '@tanstack/react-start'

import { z } from 'zod'

const Person = z.object({
name: z.string(),
})

export const greet = createServerFn({ method: 'GET' })
.validator((person: unknown) => {
return Person.parse(person)
})
.handler(async (ctx) => {
return `Hello, ${ctx.data.name}!`
})

greet({
data: {
name: 'John',
},
})
Type Safety
Since server-functions cross the network boundary, it's important to ensure the data being passed to them is not only the right type, but also validated at runtime. This is especially important when dealing with user input, as it can be unpredictable. To ensure developers validate their I/O data, types are reliant on validation. The return type of the validator function will be the input to the server function's handler.

import { createServerFn } from '@tanstack/react-start'

type Person = {
name: string
}

export const greet = createServerFn({ method: 'GET' })
.validator((person: unknown): Person => {
if (typeof person !== 'object' || person === null) {
throw new Error('Person must be an object')
}

    if ('name' in person && typeof person.name !== 'string') {
      throw new Error('Person.name must be a string')
    }

    return person as Person

})
.handler(
async ({
data, // Person
}) => {
return `Hello, ${data.name}!`
},
)

function test() {
greet({ data: { name: 'John' } }) // OK
greet({ data: { name: 123 } }) // Error: Argument of type '{ name: number; }' is not assignable to parameter of type 'Person'.
}
Inference
Server functions infer their input, and output types based on the input to the validator, and return value of handler functions, respectively. In fact, the validator you define can even have its own separate input/output types, which can be useful if your validator performs transformations on the input data.

To illustrate this, let's take a look at an example using the zod validation library:

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const transactionSchema = z.object({
amount: z.string().transform((val) => parseInt(val, 10)),
})

const createTransaction = createServerFn()
.validator(transactionSchema)
.handler(({ data }) => {
return data.amount // Returns a number
})

createTransaction({
data: {
amount: '123', // Accepts a string
},
})
Non-Validated Inference
While we highly recommend using a validation library to validate your network I/O data, you may, for whatever reason not want to validate your data, but still have type safety. To do this, provide type information to the server function using an identity function as the validator, that types the input, and or output to the correct types:

import { createServerFn } from '@tanstack/react-start'

type Person = {
name: string
}

export const greet = createServerFn({ method: 'GET' })
.validator((d: Person) => d)
.handler(async (ctx) => {
return `Hello, ${ctx.data.name}!`
})

greet({
data: {
name: 'John',
},
})
JSON Parameters
Server functions can accept JSON-serializable objects as parameters. This is useful for passing complex data structures to the server:

import { createServerFn } from '@tanstack/react-start'

type Person = {
name: string
age: number
}

export const greet = createServerFn({ method: 'GET' })
.validator((data: Person) => data)
.handler(async ({ data }) => {
return `Hello, ${data.name}! You are ${data.age} years old.`
})

greet({
data: {
name: 'John',
age: 34,
},
})
FormData Parameters
Server functions can accept FormData objects as parameters

import { createServerFn } from '@tanstack/react-start'

export const greetUser = createServerFn({ method: 'POST' })
.validator((data) => {
if (!(data instanceof FormData)) {
throw new Error('Invalid form data')
}
const name = data.get('name')
const age = data.get('age')

    if (!name || !age) {
      throw new Error('Name and age are required')
    }

    return {
      name: name.toString(),
      age: parseInt(age.toString(), 10),
    }

})
.handler(async ({ data: { name, age } }) => {
return `Hello, ${name}! You are ${age} years old.`
})

// Usage
function Test() {
return (

<form
onSubmit={async (event) => {
event.preventDefault()
const formData = new FormData(event.currentTarget)
const response = await greetUser({ data: formData })
console.log(response)
}} >
<input name="name" />
<input name="age" />
<button type="submit">Submit</button>
</form>
)
}
Server Function Context
In addition to the single parameter that server functions accept, you can also access server request context from within any server function using utilities from @tanstack/react-start/server. Under the hood, we use Unjs's h3 package to perform cross-platform HTTP requests.

There are many context functions available to you for things like:

Accessing the request context

Accessing/setting headers

Accessing/setting sessions/cookies

Setting response status codes and status messages

Dealing with multi-part form data

Reading/Setting custom server context properties

For a full list of available context functions, see all of the available h3 Methods or inspect the @tanstack/start-server-core Source Code.

For starters, here are a few examples:

Accessing the Request Context
Let's use the getWebRequest function to access the request itself from within a server function:

import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
const request = getWebRequest()

    console.log(request.method) // GET

    console.log(request.headers.get('User-Agent')) // Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3

},
)
Accessing Headers
Use the getHeaders function to access all headers from within a server function:

import { createServerFn } from '@tanstack/react-start'
import { getHeaders } from '@tanstack/react-start/server'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
console.log(getHeaders())
// {
// "accept": "_/_",
// "accept-encoding": "gzip, deflate, br",
// "accept-language": "en-US,en;q=0.9",
// "connection": "keep-alive",
// "host": "localhost:3000",
// ...
// }
},
)
You can also access individual headers using the getHeader function:

import { createServerFn } from '@tanstack/react-start'
import { getHeader } from '@tanstack/react-start/server'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
console.log(getHeader('User-Agent')) // Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3
},
)
Returning Values
Server functions can return a few different types of values:

Primitives

JSON-serializable objects

redirect errors (can also be thrown)

notFound errors (can also be thrown)

Raw Response objects

Returning Primitives and JSON
To return any primitive or JSON-serializable object, simply return the value from the server function:

import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
return new Date().toISOString()
},
)

export const getServerData = createServerFn({ method: 'GET' }).handler(
async () => {
return {
message: 'Hello, World!',
}
},
)
By default, server functions assume that any non-Response object returned is either a primitive or JSON-serializable object.

Responding with Custom Headers
To respond with custom headers, you can use the setHeader function:

import { createServerFn } from '@tanstack/react-start'
import { setHeader } from '@tanstack/react-start/server'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
setHeader('X-Custom-Header', 'value')
return new Date().toISOString()
},
)
Responding with Custom Status Codes
To respond with a custom status code, you can use the setResponseStatus function:

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

export const getServerTime = createServerFn({ method: 'GET' }).handler(
async () => {
setResponseStatus(201)
return new Date().toISOString()
},
)
Returning Raw Response objects
To return a raw Response object, return a Response object from the server function and set response: 'raw':

import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn({
method: 'GET',
response: 'raw',
}).handler(async () => {
// Read a file from s3
return fetch('https://example.com/time.txt')
})
The response: 'raw' option also allows for streaming responses among other things:

import { createServerFn } from '@tanstack/react-start'

export const streamEvents = createServerFn({
method: 'GET',
response: 'raw',
}).handler(async ({ signal }) => {
// Create a ReadableStream to send chunks of data
const stream = new ReadableStream({
async start(controller) {
// Send initial response immediately
controller.enqueue(new TextEncoder().encode('Connection established\n'))

      let count = 0
      const interval = setInterval(() => {
        // Check if the client disconnected
        if (signal.aborted) {
          clearInterval(interval)
          controller.close()
          return
        }

        // Send a data chunk
        controller.enqueue(
          new TextEncoder().encode(
            `Event ${++count}: ${new Date().toISOString()}\n`,
          ),
        )

        // End after 10 events
        if (count >= 10) {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)

      // Ensure we clean up if the request is aborted
      signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },

})

// Return a streaming response
return new Response(stream, {
headers: {
'Content-Type': 'text/event-stream',
'Cache-Control': 'no-cache',
Connection: 'keep-alive',
},
})
})
The response: 'raw' option is particularly useful for:

Streaming APIs where data is sent incrementally

Server-sent events

Long-polling responses

Custom content types and binary data

Throwing Errors
Aside from special redirect and notFound errors, server functions can throw any custom error. These errors will be serialized and sent to the client as a JSON response along with a 500 status code.

import { createServerFn } from '@tanstack/react-start'

export const doStuff = createServerFn({ method: 'GET' }).handler(async () => {
throw new Error('Something went wrong!')
})

// Usage
function Test() {
try {
await doStuff()
} catch (error) {
console.error(error)
// {
// message: "Something went wrong!",
// stack: "Error: Something went wrong!\n at doStuff (file:///path/to/file.ts:3:3)"
// }
}
}
Cancellation
On the client, server function calls can be cancelled via an AbortSignal.
On the server, an AbortSignal will notify if the request closed before execution finished.

import { createServerFn } from '@tanstack/react-start'

export const abortableServerFn = createServerFn().handler(
async ({ signal }) => {
return new Promise<string>((resolve, reject) => {
if (signal.aborted) {
return reject(new Error('Aborted before start'))
}
const timerId = setTimeout(() => {
console.log('server function finished')
resolve('server function result')
}, 1000)
const onAbort = () => {
clearTimeout(timerId)
console.log('server function aborted')
reject(new Error('Aborted'))
}
signal.addEventListener('abort', onAbort, { once: true })
})
},
)

// Usage
function Test() {
const controller = new AbortController()
const serverFnPromise = abortableServerFn({
signal: controller.signal,
})
await new Promise((resolve) => setTimeout(resolve, 500))
controller.abort()
try {
const serverFnResult = await serverFnPromise
console.log(serverFnResult) // should never get here
} catch (error) {
console.error(error) // "signal is aborted without reason"
}
}
Calling server functions from within route lifecycles
Server functions can be called normally from route loaders, beforeLoads, or any other router-controlled APIs. These APIs are equipped to handle errors, redirects, and notFounds thrown by server functions automatically.

import { getServerTime } from './getServerTime'

export const Route = createFileRoute('/time')({
loader: async () => {
const time = await getServerTime()

    return {
      time,
    }

},
})
Calling server functions from hooks and components
Server functions can throw redirects or notFounds and while not required, it is recommended to catch these errors and handle them appropriately. To make this easier, the @tanstack/react-start package exports a useServerFn hook that can be used to bind server functions to components and hooks:

import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getServerTime } from './getServerTime'

export function Time() {
const getTime = useServerFn(getServerTime)

const timeQuery = useQuery({
queryKey: 'time',
queryFn: () => getTime(),
})
}
Calling server functions anywhere else
When using server functions, be aware that redirects and notFounds they throw will only be handled automatically when called from:

Route lifecycles

Components using the useServerFn hook

For other usage locations, you'll need to handle these cases manually.

Redirects
Server functions can throw a redirect error to redirect the user to a different URL. This is useful for handling authentication, authorization, or other scenarios where you need to redirect the user to a different page.

During SSR, redirects are handled by sending a 302 response to the client with the new location

On the client, redirects are handled by the router automatically from within a route lifecycle or a component that uses the useServerFn hook. If you call a server function from anywhere else, redirects will not be handled automatically.

To throw a redirect, you can use the redirect function exported from the @tanstack/react-router package:

import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const doStuff = createServerFn({ method: 'GET' }).handler(async () => {
// Redirect the user to the home page
throw redirect({
to: '/',
})
})
Redirects can utilize all of the same options as router.navigate, useNavigate() and <Link> components. So feel free to also pass:

Path Params

Search Params

Hash

Redirects can also set the status code of the response by passing a status option:

import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const doStuff = createServerFn({ method: 'GET' }).handler(async () => {
// Redirect the user to the home page with a 301 status code
throw redirect({
to: '/',
status: 301,
})
})
You can also redirect to an external target using href:

import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const auth = createServerFn({ method: 'GET' }).handler(async () => {
// Redirect the user to the auth provider
throw redirect({
href: 'https://authprovider.com/login',
})
})
⚠️ Do not use @tanstack/react-start/server's sendRedirect function to send soft redirects from within server functions. This will send the redirect using the Location header and will force a full page hard navigation on the client.

Redirect Headers
You can also set custom headers on a redirect by passing a headers option:

import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const doStuff = createServerFn({ method: 'GET' }).handler(async () => {
// Redirect the user to the home page with a custom header
throw redirect({
to: '/',
headers: {
'X-Custom-Header': 'value',
},
})
})
Not Found
While calling a server function from a loader or beforeLoad route lifecycle, a special notFound error can be thrown to indicate to the router that the requested resource was not found. This is more useful than a simple 404 status code, as it allows you to render a custom 404 page, or handle the error in a custom way. If notFound is thrown from a server function used outside of a route lifecycle, it will not be handled automatically.

To throw a notFound, you can use the notFound function exported from the @tanstack/react-router package:

import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getStuff = createServerFn({ method: 'GET' }).handler(async () => {
// Randomly return a not found error
if (Math.random() < 0.5) {
throw notFound()
}

// Or return some stuff
return {
stuff: 'stuff',
}
})

export const Route = createFileRoute('/stuff')({
loader: async () => {
const stuff = await getStuff()

    return {
      stuff,
    }

},
})
Not found errors are a core feature of TanStack Router,

Handling Errors
If a server function throws a (non-redirect/non-notFound) error, it will be serialized and sent to the client as a JSON response along with a 500 status code. This is useful for debugging, but you may want to handle these errors in a more user-friendly way. You can do this by catching the error and handling it in your route lifecycle, component, or hook as you normally would.

import { createServerFn } from '@tanstack/react-start'

export const doStuff = createServerFn({ method: 'GET' }).handler(async () => {
undefined.foo()
})

export const Route = createFileRoute('/stuff')({
loader: async () => {
try {
await doStuff()
} catch (error) {
// Handle the error:
// error === {
// message: "Cannot read property 'foo' of undefined",
// stack: "TypeError: Cannot read property 'foo' of undefined\n at doStuff (file:///path/to/file.ts:3:3)"
}
},
})
No-JS Server Functions
Without JavaScript enabled, there's only one way to execute server functions: by submitting a form.

This is done by adding a form element to the page
with the HTML attribute action.

Notice that we mentioned the HTML attribute action. This attribute only accepts a string in HTML, just like all
other attributes.

While React 19
added support for passing a function to action,
it's
a React-specific feature and not part of the HTML standard.

The action attribute tells the browser where to send the form data when the form is submitted. In this case, we want
to send the form data to the server function.

To do this, we can utilize the url property of the server function:

const yourFn = createServerFn({ method: 'POST' })
.validator((formData) => {
if (!(formData instanceof FormData)) {
throw new Error('Invalid form data')
}

    const name = formData.get('name')

    if (!name) {
      throw new Error('Name is required')
    }

    return name

})
.handler(async ({ data: name }) => {
console.log(name) // 'John'
})

console.info(yourFn.url)
And pass this to the action attribute of the form:

function Component() {
return (

<form action={yourFn.url} method="POST">
<input name="name" defaultValue="John" />
<button type="submit">Click me!</button>
</form>
)
}
When the form is submitted, the server function will be executed.

No-JS Server Function Arguments
To pass arguments to a server function when submitting a form, you can use the input element with the name attribute
to attach the argument to the FormData passed to your
server function:

const yourFn = createServerFn({ method: 'POST' })
.validator((formData) => {
if (!(formData instanceof FormData)) {
throw new Error('Invalid form data')
}

    const age = formData.get('age')

    if (!age) {
      throw new Error('age is required')
    }

    return age.toString()

})
.handler(async ({ data: formData }) => {
// `age` will be '123'
const age = formData.get('age')
// ...
})

function Component() {
return (
// We need to tell the server that our data type is `multipart/form-data` by setting the `encType` attribute on the form.

<form action={yourFn.url} method="POST" encType="multipart/form-data">
<input name="age" defaultValue="34" />
<button type="submit">Click me!</button>
</form>
)
}
When the form is submitted, the server function will be executed with the form's data as an argument.

No-JS Server Function Return Value
Regardless of whether JavaScript is enabled, the server function will return a response to the HTTP request made from
the client.

When JavaScript is enabled, this response can be accessed as the return value of the server function in the client's
JavaScript code.

const yourFn = createServerFn().handler(async () => {
return 'Hello, world!'
})

// `.then` is not available when JavaScript is disabled
yourFn().then(console.log)
However, when JavaScript is disabled, there is no way to access the return value of the server function in the client's
JavaScript code.

Instead, the server function can provide a response to the client, telling the browser to navigate in a certain way.

When combined with a loader from TanStack Router, we're able to provide an experience similar to a single-page application, even when
JavaScript is disabled;
all by telling the browser to reload the current page with new data piped through the loader:

import \* as fs from 'fs'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const filePath = 'count.txt'

async function readCount() {
return parseInt(
await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
)
}

const getCount = createServerFn({
method: 'GET',
}).handler(() => {
return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
.validator((formData) => {
if (!(formData instanceof FormData)) {
throw new Error('Invalid form data')
}

    const addBy = formData.get('addBy')

    if (!addBy) {
      throw new Error('addBy is required')
    }

    return parseInt(addBy.toString())

})
.handler(async ({ data: addByAmount }) => {
const count = await readCount()
await fs.promises.writeFile(filePath, `${count + addByAmount}`)
// Reload the page to trigger the loader again
return new Response('ok', { status: 301, headers: { Location: '/' } })
})

export const Route = createFileRoute('/')({
component: Home,
loader: async () => await getCount(),
})

function Home() {
const state = Route.useLoaderData()

return (

<div>
<form
        action={updateCount.url}
        method="POST"
        encType="multipart/form-data"
      >
<input type="number" name="addBy" defaultValue="1" />
<button type="submit">Add</button>
</form>
<pre>{state}</pre>
</div>
)
}
Static Server Functions
When using prerendering/static-generation, server functions can also be "static", which enables their results to be cached at build time and served as static assets.

Learn all about this pattern on the Static Server Functions page.

How are server functions compiled?
Under the hood, server functions are extracted out of the client bundle and into a separate server bundle. On the server, they are executed as-is, and the result is sent back to the client. On the client, server functions proxy the request to the server, which executes the function and sends the result back to the client, all via fetch.

The process looks like this:

When createServerFn is found in a file, the inner function is checked for a use server directive

If the use server directive is missing, it is added to the top of the function

On the client, the inner function is extracted out of the client bundle and into a separate server bundle

The client-side server function is replaced with a proxy function that sends a request to the server to execute the function that was extracted

On the server, the server function is not extracted, and is executed as-is

After extraction occurs, each bundle applies a dead-code elimination process to remove any unused code from each bundle.

Static Server Functions –
Static Server Functions
What are Static Server Functions?
Static server functions are server functions that are executed at build time and cached as static assets when using prerendering/static-generation. They can be set to "static" mode by passing the type: 'static' option to createServerFn:

const myServerFn = createServerFn({ type: 'static' }).handler(async () => {
return 'Hello, world!'
})
This pattern goes as follows:

Build-time

During build-time prerendering, a server function with type: 'static' is executed

The result is cached with your build output as a static JSON file under a derived key (function ID + params/payload hash)

The result is returned as normal during prerendering/static-generation and used to prerender the page

Runtime

Initially, the prerendered page's html is served and the server function data is embedded in the html

When the client mounts, the embedded server function data is hydrated

For future client-side invocations, the server function is replaced with a fetch call to the static JSON file

Customizing the Server Functions Static Cache
By default, the static server function cache implementation stores and retrieves static data in the build output directory via node's fs module and likewise fetches the data at runtime using a fetch call to the same static file.

This interface can be customized by importing and calling the createServerFnStaticCache function to create a custom cache implementation and then calling setServerFnStaticCache to set it:

import {
createServerFnStaticCache,
setServerFnStaticCache,
} from '@tanstack/react-start/client'

const myCustomStaticCache = createServerFnStaticCache({
setItem: async (ctx, data) => {
// Store the static data in your custom cache
},
getItem: async (ctx) => {
// Retrieve the static data from your custom cache
},
fetchItem: async (ctx) => {
// During runtime, fetch the static data from your custom cache
},
})

setServerFnStaticCache(myCustomStaticCache)

Middleware –
Middleware
What is Server Function Middleware?
Middleware allows you to customize the behavior of server functions created with createServerFn with things like shared validation, context, and much more. Middleware can even depend on other middleware to create a chain of operations that are executed hierarchically and in order.

What kinds of things can I do with Middleware in my Server Functions?
Authentication: Verify a user's identity before executing a server function.

Authorization: Check if a user has the necessary permissions to execute a server function.

Logging: Log requests, responses, and errors.

Observability: Collect metrics, traces, and logs.

Provide Context: Attach data to the request object for use in other middleware or server functions.

Error Handling: Handle errors in a consistent way.

And many more! The possibilities are up to you!

Defining Middleware for Server Functions
Middleware is defined using the createMiddleware function. This function returns a Middleware object that can be used to continue customizing the middleware with methods like middleware, validator, server, and client.

import { createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware({ type: 'function' }).server(
async ({ next, data }) => {
console.log('Request received:', data)
const result = await next()
console.log('Response processed:', result)
return result
},
)
Using Middleware in Your Server Functions
Once you've defined your middleware, you can use it in combination with the createServerFn function to customize the behavior of your server functions.

import { createServerFn } from '@tanstack/react-start'
import { loggingMiddleware } from './middleware'

const fn = createServerFn()
.middleware([loggingMiddleware])
.handler(async () => {
// ...
})
Middleware Methods
Several methods are available to customize the middleware. If you are (hopefully) using TypeScript, the order of these methods is enforced by the type system to ensure maximum inference and type safety.

middleware: Add a middleware to the chain.

validator: Modify the data object before it is passed to this middleware and any nested middleware.

server: Define server-side logic that the middleware will execute before any nested middleware and ultimately a server function, and also provide the result to the next middleware.

client: Define client-side logic that the middleware will execute before any nested middleware and ultimately the client-side RPC function (or the server-side function), and also provide the result to the next middleware.

The middleware method
The middleware method is used to dependency middleware to the chain that will executed before the current middleware. Just call the middleware method with an array of middleware objects.

import { createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware({ type: 'function' }).middleware([
authMiddleware,
loggingMiddleware,
])
Type-safe context and payload validation are also inherited from parent middlewares!

The validator method
The validator method is used to modify the data object before it is passed to this middleware, nested middleware, and ultimately the server function. This method should receive a function that takes the data object and returns a validated (and optionally modified) data object. It's common to use a validation library like zod to do this. Here is an example:

import { createMiddleware } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const mySchema = z.object({
workspaceId: z.string(),
})

const workspaceMiddleware = createMiddleware({ type: 'function' })
.validator(zodValidator(mySchema))
.server(({ next, data }) => {
console.log('Workspace ID:', data.workspaceId)
return next()
})
The server method
The server method is used to define server-side logic that the middleware will execute both before and after any nested middleware and ultimately a server function. This method receives an object with the following properties:

next: A function that, when called, will execute the next middleware in the chain.

data: The data object that was passed to the server function.

context: An object that stores data from parent middleware. It can be extended with additional data that will be passed to child middleware.

Returning the required result from next
The next function is used to execute the next middleware in the chain. You must await and return (or return directly) the result of the next function provided to you for the chain to continue executing.

import { createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware({ type: 'function' }).server(
async ({ next }) => {
console.log('Request received')
const result = await next()
console.log('Response processed')
return result
},
)
Providing context to the next middleware via next
The next function can be optionally called with an object that has a context property with an object value. Whatever properties you pass to this context value will be merged into the parent context and provided to the next middleware.

import { createMiddleware } from '@tanstack/react-start'

const awesomeMiddleware = createMiddleware({ type: 'function' }).server(
({ next }) => {
return next({
context: {
isAwesome: Math.random() > 0.5,
},
})
},
)

const loggingMiddleware = createMiddleware({ type: 'function' })
.middleware([awesomeMiddleware])
.server(async ({ next, context }) => {
console.log('Is awesome?', context.isAwesome)
return next()
})
Client-Side Logic
Despite server functions being mostly server-side bound operations, there is still plenty of client-side logic surrounding the outgoing RPC request from the client. This means that we can also define client-side logic in middleware that will execute on the client side around any nested middleware and ultimately the RPC function and its response to the client.

Client-side Payload Validation
By default, middleware validation is only performed on the server to keep the client bundle size small. However, you may also choose to validate data on the client side by passing the validateClient: true option to the createMiddleware function. This will cause the data to be validated on the client side before being sent to the server, potentially saving a round trip.

Why can't I pass a different validation schema for the client?

The client-side validation schema is derived from the server-side schema. This is because the client-side validation schema is used to validate the data before it is sent to the server. If the client-side schema were different from the server-side schema, the server would receive data that it did not expect, which could lead to unexpected behavior.

import { createMiddleware } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const workspaceMiddleware = createMiddleware({ validateClient: true })
.validator(zodValidator(mySchema))
.server(({ next, data }) => {
console.log('Workspace ID:', data.workspaceId)
return next()
})
The client method
Client middleware logic is defined using the client method on a Middleware object. This method is used to define client-side logic that the middleware will execute both before and after any nested middleware and ultimately the client-side RPC function (or the server-side function if you're doing SSR or calling this function from another server function).

Client-side middleware logic shares much of the same API as logic created with the server method, but it is executed on the client side. This includes:

Requiring the next function to be called to continue the chain.

The ability to provide context to the next client middleware via the next function.

The ability to modify the data object before it is passed to the next client middleware.

Similar to the server function, it also receives an object with the following properties:

next: A function that, when called, will execute the next client middleware in the chain.

data: The data object that was passed to the client function.

context: An object that stores data from parent middleware. It can be extended with additional data that will be passed to child middleware.

const loggingMiddleware = createMiddleware({ type: 'function' }).client(
async ({ next }) => {
console.log('Request sent')
const result = await next()
console.log('Response received')
return result
},
)
Sending client context to the server
Client context is NOT sent to the server by default since this could end up unintentionally sending large payloads to the server. If you need to send client context to the server, you must call the next function with a sendContext property and object to transmit any data to the server. Any properties passed to sendContext will be merged, serialized and sent to the server along with the data and will be available on the normal context object of any nested server middleware.

const requestLogger = createMiddleware({ type: 'function' })
.client(async ({ next, context }) => {
return next({
sendContext: {
// Send the workspace ID to the server
workspaceId: context.workspaceId,
},
})
})
.server(async ({ next, data, context }) => {
// Woah! We have the workspace ID from the client!
console.log('Workspace ID:', context.workspaceId)
return next()
})
Client-Sent Context Security
You may have noticed that in the example above that while client-sent context is type-safe, it is is not required to be validated at runtime. If you pass dynamic user-generated data via context, that could pose a security concern, so if you are sending dynamic data from the client to the server via context, you should validate it in the server-side middleware before using it. Here's an example:

import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const requestLogger = createMiddleware({ type: 'function' })
.client(async ({ next, context }) => {
return next({
sendContext: {
workspaceId: context.workspaceId,
},
})
})
.server(async ({ next, data, context }) => {
// Validate the workspace ID before using it
const workspaceId = zodValidator(z.number()).parse(context.workspaceId)
console.log('Workspace ID:', workspaceId)
return next()
})
Sending server context to the client
Similar to sending client context to the server, you can also send server context to the client by calling the next function with a sendContext property and object to transmit any data to the client. Any properties passed to sendContext will be merged, serialized and sent to the client along with the response and will be available on the normal context object of any nested client middleware. The returned object of calling next in client contains the context sent from server to the client and is type-safe. Middleware is able to infer the context sent from the server to the client from previous middleware chained from the middleware function.

[!WARNING]
The return type of next in client can only be inferred from middleware known in the current middleware chain. Therefore the most accurate return type of next is in middleware at the end of the middleware chain

const serverTimer = createMiddleware({ type: 'function' }).server(
async ({ next }) => {
return next({
sendContext: {
// Send the current time to the client
timeFromServer: new Date(),
},
})
},
)

const requestLogger = createMiddleware({ type: 'function' })
.middleware([serverTimer])
.client(async ({ next }) => {
const result = await next()
// Woah! We have the time from the server!
console.log('Time from the server:', result.context.timeFromServer)

    return result

})
Reading/Modifying the Server Response
Middleware that uses the server method executes in the same context as server functions, so you can follow the exact same Server Function Context Utilities to read and modify anything about the request headers, status codes, etc.

Modifying the Client Request
Middleware that uses the client method executes in a completely different client-side context than server functions, so you can't use the same utilities to read and modify the request. However, you can still modify the request returning additional properties when calling the next function. Currently supported properties are:

headers: An object containing headers to be added to the request.

Here's an example of adding an Authorization header any request using this middleware:

import { getToken } from 'my-auth-library'

const authMiddleware = createMiddleware({ type: 'function' }).client(
async ({ next }) => {
return next({
headers: {
Authorization: `Bearer ${getToken()}`,
},
})
},
)
Using Middleware
Middleware can be used in two different ways:

Global Middleware: Middleware that should be executed for every request.

Server Function Middleware: Middleware that should be executed for a specific server function.

Global Middleware
Global middleware runs automatically for every server function in your application. This is useful for functionality like authentication, logging, and monitoring that should apply to all requests.

To use global middleware, create a global-middleware.ts file in your project (typically at app/global-middleware.ts). This file runs in both client and server environments and is where you register global middleware.

Here's how to register global middleware:

// app/global-middleware.ts
import { registerGlobalMiddleware } from '@tanstack/react-start'
import { authMiddleware } from './middleware'

registerGlobalMiddleware({
middleware: [authMiddleware],
})
Global Middleware Type Safety
Global middleware types are inherently detached from server functions themselves. This means that if a global middleware supplies additional context to server functions or other server function specific middleware, the types will not be automatically passed through to the server function or other server function specific middleware.

// app/global-middleware.ts
registerGlobalMiddleware({
middleware: [authMiddleware],
})
// authMiddleware.ts
const authMiddleware = createMiddleware({ type: 'function' }).server(
({ next, context }) => {
console.log(context.user) // <-- This will not be typed!
// ...
},
)
To solve this, add the global middleware you are trying to reference to the server function's middleware array. The global middleware will be deduped to a single entry (the global instance), and your server function will receive the correct types.

Here's an example of how this works:

import { authMiddleware } from './authMiddleware'

const fn = createServerFn()
.middleware([authMiddleware])
.handler(async ({ context }) => {
console.log(context.user)
// ...
})
Middleware Execution Order
Middleware is executed dependency-first, starting with global middleware, followed by server function middleware. The following example will log the following in this order:

globalMiddleware1

globalMiddleware2

a

b

c

d

const globalMiddleware1 = createMiddleware({ type: 'function' }).server(
async ({ next }) => {
console.log('globalMiddleware1')
return next()
},
)

const globalMiddleware2 = createMiddleware({ type: 'function' }).server(
async ({ next }) => {
console.log('globalMiddleware2')
return next()
},
)

registerGlobalMiddleware({
middleware: [globalMiddleware1, globalMiddleware2],
})

const a = createMiddleware({ type: 'function' }).server(async ({ next }) => {
console.log('a')
return next()
})

const b = createMiddleware({ type: 'function' })
.middleware([a])
.server(async ({ next }) => {
console.log('b')
return next()
})

const c = createMiddleware({ type: 'function' })
.middleware()
.server(async ({ next }) => {
console.log('c')
return next()
})

const d = createMiddleware({ type: 'function' })
.middleware([b, c])
.server(async () => {
console.log('d')
})

const fn = createServerFn()
.middleware([d])
.server(async () => {
console.log('fn')
})
Environment Tree Shaking
Middleware functionality is tree-shaken based on the environment for each bundle produced.

On the server, nothing is tree-shaken, so all code used in middleware will be included in the server bundle.

On the client, all server-specific code is removed from the client bundle. This means any code used in the server method is always removed from the client bundle. If validateClient is set to true, the client-side validation code will be included in the client bundle, otherwise data validation code will also be removed.

Server Routes –
Server Routes
Server routes are a powerful feature of TanStack Start that allow you to create server-side endpoints in your application and are useful for handling raw HTTP requests, form submissions, user authentication, and much more.

Server routes can be defined in your ./src/routes directory of your project right alongside your TanStack Router routes and are automatically handled by the TanStack Start server.

Here's what a simple server route looks like:

// routes/hello.ts

export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return new Response('Hello, World!')
},
})
Server Routes and App Routes
Because server routes can be defined in the same directory as your app routes, you can even use the same file for both!

// routes/hello.tsx

export const ServerRoute = createServerFileRoute().methods({
POST: async ({ request }) => {
const body = await request.json()
return new Response(JSON.stringify({ message: `Hello, ${body.name}!` }))
},
})

export const Route = createFileRoute('/hello')({
component: HelloComponent,
})

function HelloComponent() {
const [reply, setReply] = useState('')

return (

<div>
<button
onClick={() => {
fetch('/hello', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ name: 'Tanner' }),
})
.then((res) => res.json())
.then((data) => setReply(data.message))
}} >
Say Hello
</button>
</div>
)
}
File Route Conventions
Server routes in TanStack Start, follow the same file-based routing conventions as TanStack Router. This means that each file in your routes directory with a ServerRoute export will be treated as an API route. Here are a few examples:

/routes/users.ts will create an API route at /users

/routes/users.index.ts will also create an API route at /users (but will error if duplicate methods are defined)

/routes/users/$id.ts will create an API route at /users/$id

/routes/users/$id/posts.ts will create an API route at /users/$id/posts

/routes/users.$id.posts.ts will create an API route at /users/$id/posts

/routes/api/file/$.ts will create an API route at /api/file/$

/routes/my-script[.]js.ts will create an API route at /my-script.js

Unique Route Paths
Each route can only have a single handler file associated with it. So, if you have a file named routes/users.ts which'd equal the request path of /users, you cannot have other files that'd also resolve to the same route. For example, the following files would all resolve to the same route and would error:

/routes/users.index.ts

/routes/users.ts

/routes/users/index.ts

Escaped Matching
Just as with normal routes, server routes can match on escaped characters. For example, a file named routes/users[.]json.ts will create an API route at /users.json.

Pathless Layout Routes and Break-out Routes
Because of the unified routing system, pathless layout routes and break-out routes are supported for similar functionality around server route middleware.

Pathless layout routes can be used to add middleware to a group of routes

Break-out routes can be used to "break out" of parent middleware

Nested Directories vs File-names
In the examples above, you may have noticed that the file naming conventions are flexible and allow you to mix and match directories and file names. This is intentional and allows you to organize your Server routes in a way that makes sense for your application. You can read more about this in the TanStack Router File-based Routing Guide.

Handling Server Route Requests
Server route requests are handled by Start's createStartHandler in your server.ts entry file.

// server.ts
import {
createStartHandler,
defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
createRouter,
})(defaultStreamHandler)
The start handler is responsible for matching an incoming request to a server route and executing the appropriate middleware and handler.

Remember, if you need to customize the server handler, you can do so by creating a custom handler and then passing the event to the start handler:

// server.ts
import { createStartHandler } from '@tanstack/react-start/server'

export default defineHandler((event) => {
const startHandler = createStartHandler({
createRouter,
})(defaultStreamHandler)

return startHandler(event)
})
Defining a Server Route
Server routes are created by exporting a ServerRoute from a route file. The ServerRoute export should be created by calling the createServerFileRoute function. The resulting builder object can then be used to:

Add route-level middleware

Define handlers for each HTTP method

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return new Response('Hello, World! from ' + request.url)
},
})
Defining a Server Route Handler
There are two ways to define a handler for a server route.

Provide a handler function directly to the method

By calling the handler method on the method builder object for more advanced use cases

Providing a handler function directly to the method
For simple use cases, you can provide a handler function directly to the method.

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return new Response('Hello, World! from ' + request.url)
},
})
Providing a handler function via the method builder object
For more complex use cases, you can provide a handler function via the method builder object. This allows you to add middleware to the method.

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods((api) => ({
GET: api.middleware([loggerMiddleware]).handler(async ({ request }) => {
return new Response('Hello, World! from ' + request.url)
}),
}))
Handler Context
Each HTTP method handler receives an object with the following properties:

request: The incoming request object. You can read more about the Request object in the MDN Web Docs.

params: An object containing the dynamic path parameters of the route. For example, if the route path is /users/$id, and the request is made to /users/123, then params will be { id: '123' }. We'll cover dynamic path parameters and wildcard parameters later in this guide.

context: An object containing the context of the request. This is useful for passing data between middleware.

Once you've processed the request, you can return a Response object or Promise<Response> or even use any of the helpers from @tanstack/react-start to manipulate the response.

Dynamic Path Params
Server routes support dynamic path parameters in the same way as TanStack Router. For example, a file named routes/users/$id.ts will create an API route at /users/$id that accepts a dynamic id parameter.

// routes/users/$id.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ params }) => {
const { id } = params
return new Response(`User ID: ${id}`)
},
})

// Visit /users/123 to see the response
// User ID: 123
You can also have multiple dynamic path parameters in a single route. For example, a file named routes/users/$id/posts/$postId.ts will create an API route at /users/$id/posts/$postId that accepts two dynamic parameters.

// routes/users/$id/posts/$postId.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ params }) => {
const { id, postId } = params
return new Response(`User ID: ${id}, Post ID: ${postId}`)
},
})

// Visit /users/123/posts/456 to see the response
// User ID: 123, Post ID: 456
Wildcard/Splat Param
Server routes also support wildcard parameters at the end of the path, which are denoted by a $ followed by nothing. For example, a file named routes/file/$.ts will create an API route at /file/$ that accepts a wildcard parameter.

// routes/file/$.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ params }) => {
const { \_splat } = params
return new Response(`File: ${_splat}`)
},
})

// Visit /file/hello.txt to see the response
// File: hello.txt
Handling requests with a body
To handle POST requests,you can add a POST handler to the route object. The handler will receive the request object as the first argument, and you can access the request body using the request.json() method.

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods({
POST: async ({ request }) => {
const body = await request.json()
return new Response(`Hello, ${body.name}!`)
},
})

// Send a POST request to /hello with a JSON body like { "name": "Tanner" }
// Hello, Tanner!
This also applies to other HTTP methods like PUT, PATCH, and DELETE. You can add handlers for these methods in the route object and access the request body using the appropriate method.

It's important to remember that the request.json() method returns a Promise that resolves to the parsed JSON body of the request. You need to await the result to access the body.

This is a common pattern for handling POST requests in Server routes/ You can also use other methods like request.text() or request.formData() to access the body of the request.

Responding with JSON
When returning JSON using a Response object, this is a common pattern:

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return new Response(JSON.stringify({ message: 'Hello, World!' }), {
headers: {
'Content-Type': 'application/json',
},
})
},
})

// Visit /hello to see the response
// {"message":"Hello, World!"}
Using the json helper function
Or you can use the json helper function to automatically set the Content-Type header to application/json and serialize the JSON object for you.

// routes/hello.ts
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return json({ message: 'Hello, World!' })
},
})

// Visit /hello to see the response
// {"message":"Hello, World!"}
Responding with a status code
You can set the status code of the response by either:

Passing it as a property of the second argument to the Response constructor

// routes/hello.ts
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request, params }) => {
const user = await findUser(params.id)
if (!user) {
return new Response('User not found', {
status: 404,
})
}
return json(user)
},
})
Using the setResponseStatus helper function from @tanstack/react-start/server

// routes/hello.ts
import { json } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request, params }) => {
const user = await findUser(params.id)
if (!user) {
setResponseStatus(404)
return new Response('User not found')
}
return json(user)
},
})
In this example, we're returning a 404 status code if the user is not found. You can set any valid HTTP status code using this method.

Setting headers in the response
Sometimes you may need to set headers in the response. You can do this by either:

Passing an object as the second argument to the Response constructor.

// routes/hello.ts
export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
return new Response('Hello, World!', {
headers: {
'Content-Type': 'text/plain',
},
})
},
})

// Visit /hello to see the response
// Hello, World!
Or using the setHeaders helper function from @tanstack/react-start/server.

// routes/hello.ts
import { setHeaders } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute().methods({
GET: async ({ request }) => {
setHeaders({
'Content-Type': 'text/plain',
})
return new Response('Hello, World!')
},
})

Selective SSR –
Selective Server-Side Rendering (SSR)
What is Selective SSR?
In TanStack Start, routes matching the initial request are rendered on the server by default. This means beforeLoad and loader are executed on the server, followed by rendering the route components. The resulting HTML is sent to the client, which hydrates the markup into a fully interactive application.

However, there are cases where you might want to disable SSR for certain routes or all routes, such as:

When beforeLoad or loader requires browser-only APIs (e.g., localStorage).

When the route component depends on browser-only APIs (e.g., canvas).

TanStack Start's Selective SSR feature lets you configure:

Which routes should execute beforeLoad or loader on the server.

Which route components should be rendered on the server.

How does this compare to SPA mode?
TanStack Start's SPA mode completely disables server-side execution of beforeLoad and loader, as well as server-side rendering of route components. Selective SSR allows you to configure server-side handling on a per-route basis, either statically or dynamically.

Configuration
You can control how a route is handled during the initial server request using the ssr property. If this property is not set, it defaults to true. You can change this default using the defaultSsr option in createRouter:

// src/router.tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
const router = createTanStackRouter({
routeTree,
scrollRestoration: true,
defaultPendingComponent: () => <div>Loading...</div>,
// Disable SSR by default
defaultSsr: false,
})

return router
}
ssr: true
This is the default behavior unless otherwise configured. On the initial request, it will:

Run beforeLoad on the server and send the resulting context to the client.

Run loader on the server and send the loader data to the client.

Render the component on the server and send the HTML markup to the client.

// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
ssr: true,
beforeLoad: () => {
console.log('Executes on the server during the initial request')
console.log('Executes on the client for subsequent navigation')
},
loader: () => {
console.log('Executes on the server during the initial request')
console.log('Executes on the client for subsequent navigation')
},
component: () => <div>This component is rendered on the server</div>,
})
ssr: false
This disables server-side:

Execution of the route's beforeLoad and loader.

Rendering of the route component.

// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
ssr: false,
beforeLoad: () => {
console.log('Executes on the client during hydration')
},
loader: () => {
console.log('Executes on the client during hydration')
},
component: () => <div>This component is rendered on the client</div>,
})
ssr: 'data-only'
This hybrid option will:

Run beforeLoad on the server and send the resulting context to the client.

Run loader on the server and send the loader data to the client.

Disable server-side rendering of the route component.

// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
ssr: 'data-only',
beforeLoad: () => {
console.log('Executes on the server during the initial request')
console.log('Executes on the client for subsequent navigation')
},
loader: () => {
console.log('Executes on the server during the initial request')
console.log('Executes on the client for subsequent navigation')
},
component: () => <div>This component is rendered on the client</div>,
})
Functional Form
For more flexibility, you can use the functional form of the ssr property to decide at runtime whether to SSR a route:

// src/routes/docs/$docType/$docId.tsx
export const Route = createFileRoute('/docs/$docType/$docId')({
validateSearch: z.object({ details: z.boolean().optional() }),
ssr: ({ params, search }) => {
if (params.status === 'success' && params.value.docType === 'sheet') {
return false
}
if (search.status === 'success' && search.value.details) {
return 'data-only'
}
},
beforeLoad: () => {
console.log('Executes on the server depending on the result of ssr()')
},
loader: () => {
console.log('Executes on the server depending on the result of ssr()')
},
component: () => <div>This component is rendered on the client</div>,
})
The ssr function runs only on the server during the initial request and is stripped from the client bundle.

search and params are passed in after validation as a discriminated union:

params:
| { status: 'success'; value: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>> }
| { status: 'error'; error: unknown }
search:
| { status: 'success'; value: Expand<ResolveFullSearchSchema<TParentRoute, TSearchValidator>> }
| { status: 'error'; error: unknown }
If validation fails, status will be error and error will contain the failure details. Otherwise, status will be success and value will contain the validated data.

Inheritance
At runtime, a child route inherits the Selective SSR configuration of its parent. However, the inherited value can only be changed to be more restrictive (i.e. true to data-only or false and data-only to false). For example:

root { ssr: undefined }
posts { ssr: false }
$postId { ssr: true }
root defaults to ssr: true.

posts explicitly sets ssr: false, so neither beforeLoad nor loader will run on the server, and the route component won't be rendered on the server.

$postId sets ssr: true, but inherits ssr: false from its parent. Because the inherited value can only be changed to be more restrictive, ssr: true has no effect and the inherited ssr: false will remain.

Another example:

root { ssr: undefined }
posts { ssr: 'data-only' }
$postId { ssr: true }
details { ssr: false }
root defaults to ssr: true.

posts sets ssr: 'data-only', so beforeLoad and loader run on the server, but the route component isn't rendered on the server.

$postId sets ssr: true, but inherits ssr: 'data-only' from its parent.

details sets ssr: false, so neither beforeLoad nor loader will run on the server, and the route component won't be rendered on the server. Here the inherited value is changed to be more restrictive, and therefore, the ssr: false will override the inherited value.

Fallback Rendering
For the first route with ssr: false or ssr: 'data-only', the server will render the route's pendingComponent as a fallback. If pendingComponent isn't configured, the defaultPendingComponent will be rendered. If neither is configured, no fallback will be rendered.

On the client during hydration, this fallback will be displayed for at least minPendingMs (or defaultPendingMinMs if not configured), even if the route doesn't have beforeLoad or loader defined.

SPA Mode –
SPA mode
What the heck is SPA mode?
For applications that do not require SSR for either SEO, crawlers, or performance reasons, it may be desirable to ship static HTML to your users containing the "shell" of your application (or even prerendered HTML for specific routes) that contain the necessary html, head, and body tags to bootstrap your application only on the client.

Why use Start without SSR?
No SSR doesn't mean giving up server-side features! SPA modes actually pair very nicely with server-side features like server functions and/or server routes or even other external APIs. It simply means that the initial document will not contain the fully rendered HTML of your application until it has been rendered on the client using JavaScript.

Benefits of SPA mode
Easier to deploy - A CDN that can serve static assets is all you need.

Cheaper to host - CDNs are cheap compared to Lambda functions or long-running processes.

Client-side Only is simpler - No SSR means less to go wrong with hydration, rendering, and routing.

Caveats of SPA mode
Slower time to full content - Time to full content is longer since all JS must download and execute before anything below the shell can be rendered.

Less SEO friendly - Robots, crawlers and link unfurlers may have a harder time indexing your application unless they are configured to execute JS and your application can render within a reasonable amount of time.

How does it work?
After enabling the SPA mode, running a Start build will have an additional prerendering step afterwards to generate the shell. This is done by:

Prerendering your application's root route only

Where your application would normally render your matched routes, your router's configured pending fallback component is rendered instead.

The resulting HTML is stored to a static HTML page called /\_shell.html (configurable)

Default rewrites are configured to redirect all 404 requests to the SPA mode shell

[!NOTE]
Other routes may also be prerendered and it is recommended to prerender as much as you can in SPA mode, but this is not required for SPA mode to work.

Configuring SPA mode
To configure SPA mode, there are a few options you can add to your Start plugin's options:

// vite.config.ts
export default defineConfig({
plugins: [
TanStackStart({
spa: {
enabled: true,
},
}),
],
})
Use Necessary Redirects
Deploying a purely client-side SPA to a host or CDN often requires the use of redirects to ensure that urls are properly rewritten to the SPA shell. The goal of any deployment should include these priorities in this order:

Ensure that static assets will always be served if they exist, e.g. /about.html. This is usually the default behavior for most CDNs

(Optional) Allow-list specific subpaths to be routed through to any dynamic server handlers, e.g. /api/\*\* (More on this below)

Ensure that all 404 requests are rewritten to the SPA shell, e.g. a catch-all redirect to /\_shell.html (or if you have configured your shell output path to be something custom, use that instead)

Basic Redirects Example
Let's use Netlify's \_redirects file to rewrite all 404 requests to the SPA shell.

# Catch all other 404 requests and rewrite them to the SPA shell

/\* /\_shell.html 200
Allowing Server Functions and Server Routes
Again, using Netlify's \_redirects file, we can allow-list specific subpaths to be routed through to the server.

# Allow requests to /\_serverFn/\* to be routed through to the server (If you have configured your server function base path to be something other than /\_serverFn, use that instead)

/\_serverFn/\* /\_serverFn/:splat 200

# Allow any requests to /api/\* to be routed through to the server (Server routes can be created at any path, so you must ensure that any server routes you want to use are under this path, or simply add additional redirects for each server route base you want to expose)

/api/\* /api/:splat 200

# Catch all other 404 requests and rewrite them to the SPA shell

/\* /\_shell.html 200
Shell Mask Path
The default pathname used to generate the SPA shell is /. We call this the shell mask path. Since matched routes are not included, the pathname used to generate the shell is mostly irrelevant, but it's still configurable.

[!NOTE]
It's recommended to keep the default value of / as the shell mask path.

// vite.config.ts
export default defineConfig({
plugins: [
tanstackStart({
spa: {
maskPath: '/app',
},
}),
],
})
Prerendering Options
The prerender option is used to configure the prerendering behavior of the SPA shell, and accepts the same prerender options as found in our prerendering guide.

By default, the following prerender options are set:

outputPath: /\_shell.html

crawlLinks: false

retryCount: 0

This means that by default, the shell will not be crawled for links to follow for additional prerendering, and will not retry prerendering fails.

You can always override these options by providing your own prerender options:

// vite.config.ts
export default defineConfig({
plugins: [
TanStackStart({
spa: {
prerender: {
outputPath: '/custom-shell',
crawlLinks: true,
retryCount: 3,
},
},
}),
],
})
Customized rendering in SPA mode
Customizing the HTML output of the SPA shell can be useful if you want to:

Provide generic head tags for SPA routes

Provide a custom pending fallback component

Change literally anything about the shell's HTML, CSS, and JS

To make this process simple, an isShell() function can be found on the router instance:

// src/routes/root.tsx
export default function Root() {
const isShell = useRouter().isShell()

if (isShell) console.log('Rendering the shell!')
}
You can use this boolean to conditionally render different UI based on whether the current route is a shell or not, but keep in mind that after hydrating the shell, the router will immediately navigate to the first route and isShell() will return false. This could produce flashes of unstyled content if not handled properly.

Dynamic Data in your Shell
Since the shell is prerendered using the SSR build of your application, any loaders, or server-specific functionality defined on your Root Route will run during the prerendering process and the data will be included in the shell.

This means that you can use dynamic data in your shell by using a loader or server-specific functionality.

// src/routes/\_\_root.tsx

export const RootRoute = createRootRoute({
loader: async () => {
return {
name: 'Tanner',
}
},
component: Root,
})

export default function Root() {
const { name } = useLoaderData()

return (

<html>
<body>
<h1>Hello, {name}!</h1>
<Outlet />
</body>
</html>
)
}

Static Prerendering –
Static Prerendering
Static prerendering is the process of generating static HTML files for your application. This can be useful for either improving the performance of your application, as it allows you to serve pre-rendered HTML files to users without having to generate them on the fly or for deploying static sites to platforms that do not support server-side rendering.

Prerendering
TanStack Start can prerender your application to static HTML files, which can then be served to users without having to generate them on the fly. To prerender your application, you can add the prerender option to your tanstackStart configuration in vite.config.ts file:

// vite.config.ts

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
plugins: [
tanstackStart({
prerender: {
// Enable prerendering
enabled: true,

        // Enable if you need pages to be at `/page/index.html` instead of `/page.html`
        autoSubfolderIndex: true,

        // How many prerender jobs to run at once
        concurrency: 14,

        // Whether to extract links from the HTML and prerender them also
        crawlLinks: true,

        // Filter function takes the page object and returns whether it should prerender
        filter: ({ path }) => !path.startsWith('/do-not-render-me'),

        // Number of times to retry a failed prerender job
        retryCount: 2,

        // Delay between retries in milliseconds
        retryDelay: 1000,

        // Callback when page is successfully rendered
        onSuccess: (page) => {
          console.log(`Rendered ${page.path}!`)
        },
      },
      // Optional configuration for specific pages (without this it will still automatically
      // prerender all routes)
      pages: [
        {
          path: '/my-page',
          prerender: { enabled: true, outputPath: '/my-page/index.html' },
        },
      ],
    }),

],
})

Path Aliases –
Path Aliases
Path aliases are a useful feature of TypeScript that allows you to define a shortcut for a path that could be distant in your project's directory structure. This can help you avoid long relative imports in your code and make it easier to refactor your project's structure. This is especially useful for avoiding long relative imports in your code.

By default, TanStack Start does not include path aliases. However, you can easily add them to your project by updating your tsconfig.json file in the root of your project and adding the following configuration:

{
"compilerOptions": {
"baseUrl": ".",
"paths": {
"~/_": ["./src/_"]
}
}
}
In this example, we've defined the path alias ~/_ that maps to the ./src/_ directory. This means that you can now import files from the src directory using the ~ prefix.

After updating your tsconfig.json file, you'll need to install the vite-tsconfig-paths plugin to enable path aliases in your TanStack Start project. You can do this by running the following command:

npm install -D vite-tsconfig-paths
Now, you'll need to update your app.config.ts file to include the following:

// app.config.ts
import { defineConfig } from '@tanstack/react-start/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
vite: {
plugins: [
// this is the plugin that enables path aliases
viteTsConfigPaths({
projects: ['./tsconfig.json'],
}),
],
},
})
Once this configuration has completed, you'll now be able to import files using the path alias like so:

// app/routes/posts/$postId/edit.tsx
import { Input } from '~/components/ui/input'

// instead of

import { Input } from '../../../components/ui/input'

Tailwind CSS Integration

Tailwind CSS Integration
So you want to use Tailwind CSS in your TanStack Start project?

This guide will help you use Tailwind CSS in your TanStack Start project.

Tailwind CSS Version 4 (Latest)
The latest version of Tailwind CSS is 4. And it has some configuration changes that majorly differ from Tailwind CSS Version 3. It's easier and recommended to set up Tailwind CSS Version 4 in a TanStack Start project, as TanStack Start uses Vite as its build tool.

Install Tailwind CSS
Install Tailwind CSS and it's Vite plugin.

shell

npm install tailwindcss @tailwindcss/vite
Configure The Vite Plugin
Add the @tailwindcss/vite plugin to your Vite configuration.

ts

// vite.config.ts
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
server: {
port: 3000,
},
plugins: [tsConfigPaths(), tanstackStart(), tailwindcss()],
})
Import Tailwind in your CSS file
You need to create a CSS file to configure Tailwind CSS instead of the configuration file in version 4. You can do this by creating a src/styles/app.css file or name it whatever you want.

css

/_ src/styles/app.css _/
@import 'tailwindcss';
Import the CSS file in your **root.tsx file
Import the CSS file in your **root.tsx file with the ?url query and make sure to add the triple slash directive to the top of the file.

tsx

// src/routes/\_\_root.tsx
/// <reference types="vite/client" />
// other imports...

import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
head: () => ({
meta: [
// your meta tags and site config
],
links: [{ rel: 'stylesheet', href: appCss }],
// other head config
}),
component: RootComponent,
})
Use Tailwind CSS anywhere in your project
You can now use Tailwind CSS anywhere in your project.

tsx

// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
component: Home,
})

function Home() {
return <div className="bg-red-500 text-white p-4">Hello World</div>
}
That's it! You can now use Tailwind CSS anywhere in your project 🎉.

Tailwind CSS Version 3 (Legacy)
If you are want to use Tailwind CSS Version 3, you can use the following steps.

Install Tailwind CSS
Install Tailwind CSS and it's peer dependencies.

shell

npm install -D tailwindcss@3 postcss autoprefixer
Then generate the Tailwind and PostCSS configuration files.

shell

npx tailwindcss init -p
Configure your template paths
Add the paths to all of your template files in the tailwind.config.js file.

js

// tailwind.config.js
/** @type {import('tailwindcss').Config} \*/
export default {
content: ['./src/**/\*.{js,ts,jsx,tsx}'],
theme: {
extend: {},
},
plugins: [],
}
Add the Tailwind directives to your CSS file
Add the @tailwind directives for each of Tailwind's layers to your src/styles/app.css file.

css

/_ src/styles/app.css _/
@tailwind base;
@tailwind components;
@tailwind utilities;
Note

Jump to Import the CSS file in your **root.tsx file to see how to import the CSS file in your **root.tsx file.
