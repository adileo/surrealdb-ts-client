<h1><img height="20" src="https://github.com/surrealdb/surrealdb/raw/main/img/whatissurreal.svg">&nbsp;&nbsp;SurrealDB Node.js Client</h1>


![](https://img.shields.io/bundlephobia/minzip/@adileo/surrealdb-ts-client)
![](https://img.shields.io/npm/dm/@adileo/surrealdb-ts-client)
![](https://img.shields.io/npm/l/@adileo/surrealdb-ts-client)
![](https://img.shields.io/npm/v/@adileo/surrealdb-ts-client)
<img src="https://img.icons8.com/external-tal-revivo-color-tal-revivo/512/external-typescript-an-open-source-programming-language-developed-and-maintained-by-microsoft-logo-color-tal-revivo.png" height="20">

SurrealDB Typescript client (unofficial) based upon the REST API of SurrealDB.

Features:
* **Typescript Support**
* **Stateless**: Each request can be authenticated with a different user, namespace or database (Especially useful for Serverless API Backends, since the official SDK is keeping a statefull connection to the DB)
* **Typed ORM**: perform the most essential operations with `create`, `findById`, `findMany`, `update`, `delete` methods while still supporting also the powerful SurrealQL language and typed results.
* **DB Schema Generation & Synchronization**: Keep your surreal DB table, fields and indexes in sync with your code. (Best for development purposes)
* **Relationships**: between entities - Embedded, One-To-One, One-To-Many, Many-To-Many
* **Raw Queries**: For more complex usages, with escaped variables support and typed response
* **HTTP2 Support**: for fast communication between the client and DB
* **Lightweight**: only two dependencies `fetch-h2` and `reflect-metadata`
* **Debug Logging**: Optional query debug logging with 🌲 Pino (see the test file to understand how to enable logging)


Please note that this client SDK doesn't support yet real-time connections over Websocket, like the official one, this SDK is meant to be used mostly server-side in a stateless environment. You can also plug-in your network/request layer and potentially 

## How To


### ORM

```typescript
// npm i @adileo/surrealdb-ts-client
import SurrealRESTClient, { Entity, Field, SelectAs, Collection } from "@adileo/surrealdb-ts-client"

const client = new SurrealRESTClient('http://127.0.0.1:8000', {
    // Default values, you can override them on each request
    ns:'base',
    db: 'base',
    user: 'root',
    pass: 'root',
    //token: 'JWTTOKEN',
    //logger: pino
})

@Entity()
class Fruit {
    id!: string;

    @Field({ required: true })
    name?: string;

    @Field()
    isRed?: boolean;

    @Field()
    createdAt?: Date;
}


const fruits  = await client.collection(Fruit)
await fruits.synchronize() // Run this if you want to automatically sync the DB schema

// Insert record
await fruits.create({
    data: {
        name: "apple",
        isRed: true
    }
})
// {id: 'fruit:12345', name: 'apple', isRed: true} : Fruit

// Fetch record by ID
await fruits.findById('fruit:12345', {select:{ name: true }})
// { name: 'pear' } : Fruit

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
### Relationship
```typescript

@Entity()
// @Index(["id", "nickname"]) - create indexes / unique indexes
class Animal {
    id!: string

    @Field({ required: false })
    nickname?: string

    @Field({ required: true })
    name!: string

    @Field()
    worstEnemy?: Animal // Localy Embedded

    @Field({surrealType: 'record(animal)'})
    bestFriendId!: string

    @SelectAs("bestFriendId.*")
    bestFriend?: Animal

    @SelectAs("->eats->fruit.*")
    eats!: Fruit[]

    @SelectAs("->eats->(fruit WHERE isRed = true).*")
    eatsRed!: Fruit[]
}
const animals = await client.collection(Animal)
await animals.synchronize()

const banana = await fruits.create({
    data: {
        name: "Yellow Banana",
    }
})
const redApple = await fruits.create({
    data: {
        name: "Red Apple",
        isRed: true
    }
})

const cow = await animals.create({
    data: {
        name: "Happy Cow",
    }
})

const worstEnemy = new Animal()
worstEnemy.name = "Red Snake"

const monkey = await animals.create({
    data: {
        name: "Hungry Monkey",
        bestFriendId: cow.id,
        worstEnemy: worstEnemy
    }
})

await client.relate(monkey, "eats", banana)
await client.relate(monkey, "eats", redApple)

const results = await animals.findMany({
    select: {
        eats: true,
        bestFriend: true,
        worstEnemy: true,
        eatsRed: true
    },
    matching: {
        id: monkey.id
    }
})
/*
Return -> Animal
{
    "bestFriend": { 
        "id": "animal:p5u8h7q726410em88874",
        "name": "Happy Cow"
    },
    "eats": [
        {
        "id": "fruit:dp0wk75nuzypp09ch5ut",
        "isRed": true,
        "name": "Red Apple"
        },
        {
        "id": "fruit:mbs9xxpxn8lb4j0limih",
        "name": "Yellow Banana"
        }
    ],
    "eatsRed": [
        {
        "id": "fruit:dp0wk75nuzypp09ch5ut",
        "isRed": true,
        "name": "Red Apple"
        }
    ],
    "worstEnemy": {
        "name": "Red Snake"
    }
}
*/
```

### Custom Query

```typescript
// Execute SurrealQL queries with params
await client.queryRaw<Fruit>('SELECT * FROM fruit WHERE name = $fruitName', {
    fruitName: "apple"
})
// [{time:"1ms", status: "OK", result: [{id:'...', name: 'apple'}, {id:'...', ...}]}]

// Get only last statement result
await client.queryLastArray<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
    optionSet: [SDBType.Record(inserted1.id), SDBType.Record(inserted2.id)]
}, {user: 'useroverride', pass: 'passwordoverride'})
// [{id: 'fruit:1234', name: '...'}, {id: 'fruit:1235', name: '...'}] : Fruit[]

// Get only last statement result - first item
const selected = await client.queryLast<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
    optionSet: [inserted1.id, inserted2.id]
}, {ns: 'namespaceoverride123', db: 'dboverride123', token: 'usertokenoverride'})
// {id: 'fruit:1234', name: '...'} : Fruit

```