# SurrealDB Node.js Typescript Client

Unofficial Node.js SurrealDB client based on the REST API of SurrealDB.

Advantages over the current official SurrealDB Client (as of Nov. 2022):

* Stateless: Each request can be authenticated with a different user, namespace or database (Especially useful for Serverless API Backends)
* Typescript Support
* Typed ORM: perform most basic operations with `create`, `findById`, `findMany`, `update`, `delete` operations
* Raw Query - with escaped variables
* HTTP2 Support
* Only 1 Dependency: fetch-h2
* Optional query debug logging with Pino (see the test file to enable logging)

Please note that this client SDK doesn't support real-time connections (Websocket) like the official one, this SDK is meant to be used mostly server-side in a stateless environment.

## How To


### ORM

```typescript
// npm i @adileo/surrealdb-ts-client
import SurrealRESTClient from "@adileo/surrealdb-ts-client"

const client = new SurrealRESTClient('http://127.0.0.1:8000', {
    // Default values, you can override them on each request
    ns:'base',
    db: 'base',
    user: 'root',
    pass: 'root',
    //token: 'JWTTOKEN',
})

type Fruit = {
  id: string,
  name: string
  isRed: boolean
}
const fruitModel = new Model<Fruit>('fruit')
const fruits = fruitModel.collection(client)

// Insert record
await fruits.createOrSet({
    data: {
        name: "apple",
        isRed: true
    }
})
// {id: 'fruit:12345', name: 'apple', isRed: true} : Fruit

// Replace record
await fruits.createOrSet({
    data: {
        id: "fruit:12345",
        name: "pear"
    }
})
// {id: 'fruit:12345', name: 'pear'} : Fruit

// Fetch record by ID
await fruits.findById('fruit:12345')
// {id: 'fruit:12345', name: 'pear'} : Fruit

// Find multiple records
await fruits.findMany({
    matching: {
        name: "apple",
        isRed: true
    }
})
// [{...}, {...}] : Fruit[]

// Update Record
await fruits.update({
    matching: {
        id: inserted.id
    },
    data: {
        name: "pear"
    },
    opts: {
        ns: 'namespace1',
        db: 'db123',
        token: 'JWTTOKEN'
    }
})
// [{...}, {...}] : Fruit[]

// Delete records, if no items inside matching clause it will delete all the table
await fruits.delete({
    matching: {
        id: 'fruit:12345'
    }
})
```

### Custom Query

```typescript
// Execute SurrealQL queries with params
await client.queryRaw<Fruit>('SELECT * FROM fruit WHERE name = $fruitName', {
    fruitName: "apple"
}, {logQuery: true})
// [{time:"1ms", status: "OK", result: [{id:'...', name: 'apple'}, {id:'...', ...}]}]

// Get only last statement result
await client.queryLastArray<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
    optionSet: [SDBType.Record(inserted1.id), SDBType.Record(inserted2.id)]
}, {logQuery: true, user: 'useroverride', pass: 'passwordoverride'})
// [{id: 'fruit:1234', name: '...'}, {id: 'fruit:1235', name: '...'}] : Fruit[]

// Get only last statement result - first item
const selected = await client.queryLast<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
    optionSet: [inserted1.id, inserted2.id]
}, {logQuery: true, ns: 'namespaceoverride123', db: 'dboverride123', token: 'usertokenoverride'})
// {id: 'fruit:1234', name: '...'} : Fruit

```