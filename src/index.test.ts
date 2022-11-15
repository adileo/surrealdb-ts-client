import SurrealRESTClient, { SDBType } from ".";
import Model from "./model";
import pino from "pino"


const logger = pino({
  level: 'debug',
},pino.destination("./logs/debug.log"))
describe('test client', () => {
  const client = new SurrealRESTClient('http://127.0.0.1:8000', {
      ns:'base',
      db: 'base',
      user: 'root',
      pass: 'root',
      logger: logger
  })
  
  type Fruit = {
    id: string,
    name: string
    isRed: boolean
  }
  const fruitModel = new Model<Fruit>('fruit')
  const fruits = fruitModel.collection(client)
 

  test('test insertion and findMany', async () => {

    const inserted = await fruits.createOrSet({
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
    const inserted = await fruits.createOrSet({
      data: {
        name: 'apple',
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
    const inserted = await fruits.createOrSet({
      data: {
        name: 'apple',
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
    const inserted1 = await fruits.createOrSet({
      data: {
        name: "banana"
      }
    })
    const inserted2 = await fruits.createOrSet({
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
      var:'PIPPO";LET $var = "HACKED'
    })
    expect(inj1).toBe("PIPPO\";LET $var = \"HACKED");
    expect(inj1).not.toBe("HACKED");
  })

});