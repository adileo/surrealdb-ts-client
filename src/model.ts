import SurrealRESTClient from "."
import Collection from "./collection"
import { SurrealRESTClientOptions } from "./types"

class Model<T> {
    table: string
    constructor(table: string){
        this.table = table
    }
    public collection(client: SurrealRESTClient, opts: SurrealRESTClientOptions = {}){
        return new Collection<T>(this, client, opts)
    }
    public getTable(){
        return this.table
    }
}

export default Model