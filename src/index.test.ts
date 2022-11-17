import SurrealRESTClient from ".";
import pino from "pino"
import { Entity, Field, SelectAs } from "./decorators";
import Collection from "./collection";

const logger = pino({
    level: 'debug',
}, pino.destination("./logs/debug.log"))

let fruits: Collection<Fruit>;
let animals: Collection<Animal>;

const client = new SurrealRESTClient('http://127.0.0.1:8000', {
    ns: 'base',
    db: 'base',
    user: 'root',
    pass: 'root',
    logger: logger
})

@Entity({
    name: "fruit",
    schemafull: true,
    synchronize: true
})
class Fruit {
    id!: string;

    @Field({ required: true })
    name?: string;

    @Field()
    isRed?: boolean;

    @Field()
    createdAt?: Date;
}

@Entity({
    synchronize: true
})
// @Index(["nickname"])
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

beforeAll(async () => {
    fruits = await client.collection(Fruit)
    await fruits.delete()
    animals = await client.collection(Animal)
    await animals.delete()
});

describe('test client', () => {

    test('test insertion and findMany', async () => {

        const inserted = await fruits.create({
            data: {
                name: "apple",
                isRed: true
            }
        })
        const fetched = await fruits.findMany({
            matching: {
                id: inserted.id,
            }
        })
        expect(inserted.name).toBe(fetched[0].name);
    });
    test('test insertion and change', async () => {
        const inserted = await fruits.create({
            data: {
                name: 'apple2',
                isRed: true
            }
        })
        const updated = await fruits.update({
            matching: {
                id: inserted.id
            },
            data: {
                name: "pear"
            }
        })
        const fetched = await fruits.findById(inserted.id)
        expect(fetched!.name).toBe("pear");
        expect(fetched!.isRed).toBe(true);
    });

    test('test insertion and delete', async () => {
        const inserted = await fruits.create({
            data: {
                name: 'apple3',
                isRed: true
            }
        })
        expect(inserted).not.toBe(null);
        await fruits.delete({
            matching: {
                isRed: true
            }
        })
        const fetched = await fruits.findById(inserted.id)
        expect(fetched).toBe(null);
    });
    test('test SQL with params', async () => {
        const inserted1 = await fruits.create({
            data: {
                name: "banana"
            }
        })
        const inserted2 = await fruits.create({
            data: {
                name: "mango"
            }
        })

        const selected = await client.queryLastArray<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
            optionSet: [inserted1.id, inserted2.id]
        })

        expect(selected.length).toBe(2);
    });

    test('test SQL escaping', async () => {
        const inj1 = await client.queryLast('SELECT * FROM $var', {
            var: 'PIPPO";LET $var = "HACKED'
        })
        expect(inj1).toBe("PIPPO\";LET $var = \"HACKED");
        expect(inj1).not.toBe("HACKED");
    })


    test('test relationships', async () => {

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
        const hungryMonkey = results[0]
        console.log(JSON.stringify(hungryMonkey, null, 2))

        expect(hungryMonkey.bestFriend!.name).toBe("Happy Cow");
        expect(hungryMonkey.eats.length).toBe(2);
        expect(hungryMonkey.eatsRed[0].name).toBe("Red Apple");
        expect(hungryMonkey.worstEnemy!.name).toBe("Red Snake");
    });
    // test('test select with related', async () => {
    //   const inserted1 = await fruits.create({
    //     data: {
    //       name: "banana"
    //     }
    //   })
    //   const inserted2 = await fruits.create({
    //     data: {
    //       name: "mango"
    //     }
    //   })

    //   inserted1.relate()

    //   const selected = await client.queryLastArray<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
    //     optionSet: [inserted1.id, inserted2.id]
    //   })

    //   expect(selected.length).toBe(2);
    // });

});