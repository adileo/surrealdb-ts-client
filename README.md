# SurrealDB JS/Typescript Client SDK

Unofficial SurrealDB client based on the REST API of SurrealDB

Advantages over Official SurrealDB Client (as of Nov. 2022):

* Stateless: Each request can be authenticated with a different user, namespace or database (Especially useful for Serverless API Backends)
* Browser and Node.js Support (ES5)
* Only 1 Dependency: Cross-Fetch
* Typescript Support

Please note that this client SDK doesn't support real-time connections (Websocket) like the official one.

## How To

```typescript
// npm i @adileo/surrealdb-ts-client
import SurrealRESTClient, { SDBType } from "@adileo/surrealdb-ts-client"

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

// Insert record
await client.createOrSet<Fruit>('fruit', {
    name: 'apple'
})
// {id: 'fruit:12345', name: 'apple'}

// Replace record
await client.createOrSet<Fruit>('fruit:12345', {
    name: 'pear'
})
// {id: 'fruit:12345', name: 'pear'}

// Fetch record by ID
await client.findById<Fruit>('fruit:12345')
// {id: 'fruit:12345', name: 'pear'}

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
    optionSet: [SDBType.Record(inserted1.id), SDBType.Record(inserted2.id)]
}, {logQuery: true, ns: 'namespaceoverride123', db: 'dboverride123', token: 'usertokenoverride'})
// {id: 'fruit:1234', name: '...'} : Fruit

```