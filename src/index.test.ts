import SurrealRESTClient, { SDBType } from ".";

type Fruit = {
  id: string,
  name: string
  isRed: boolean
}
const LOG_QUERIES = false
describe('test client', () => {
  const client = new SurrealRESTClient('http://127.0.0.1:8000', {
      namespace:'base',
      database: 'base',
      user: 'root',
      pass: 'root'
    })

  test('test insertion and fetch', async () => {
    const inserted = await client.createOrSet<Fruit>('fruit', {
      name: 'apple'
    }, {logQuery: LOG_QUERIES})
    const fetched = await client.findById<Fruit>(inserted.id,{})
    expect(inserted.name).toBe(fetched!.name);
  });
  test('test insertion and change', async () => {
    const inserted = await client.createOrSet<Fruit>('fruit', {
      name: 'apple',
      isRed: true
    }, {logQuery: LOG_QUERIES})
    const updated = await client.mergeSet(inserted.id, {
      name: 'pear'
    }, {logQuery: LOG_QUERIES})
    const fetched = await client.findById<Fruit>(inserted.id, {logQuery: LOG_QUERIES})
    expect(fetched!.name).toBe("pear");
    expect(fetched!.isRed).toBe(true);
  });
  test('test SQL with params', async () => {
    const inserted1 = await client.createOrSet<Fruit>('fruit', {
      id:"apple"
    }, {logQuery: LOG_QUERIES})
    const inserted2 = await client.createOrSet<Fruit>('fruit', {
      id:"pear"
    }, {logQuery: LOG_QUERIES})

    const selected = await client.queryLastArray<Fruit>('SELECT * FROM fruit WHERE id ∈ $optionSet', {
      optionSet: [SDBType.Record(inserted1.id), SDBType.Record(inserted2.id)]
    }, {logQuery: LOG_QUERIES})

    expect(selected.length).toBe(2);
  });

  test('test SQL injections', async () => {
    const inj1 = await client.queryLast('SELECT * FROM $var', {
      var:'PIPPO";LET $var = "HACKED'
    }, {logQuery: true})
    expect(inj1).toBe("PIPPO\";LET $var = \"HACKED");
    expect(inj1).not.toBe("HACKED");
  })

});