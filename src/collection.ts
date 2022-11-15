import SurrealRESTClient from "."
import Model from "./model"
import Serializer from "./serializer"
import { CollectionQueryParamsCreateOrSet, CollectionQueryParamsDelete, CollectionQueryParamsFindMany, CollectionQueryParamsUpdate, MatchingClause, SurrealRESTClientOptions } from "./types"


class Collection<T> {
    table: string
    client: SurrealRESTClient
    opts: SurrealRESTClientOptions
    
    constructor(model: Model<T>, client: SurrealRESTClient, opts: SurrealRESTClientOptions = {}){
        this.table = model.getTable()
        this.client = client
        this.opts = opts
    }

    // Create or set (override all) record content
    public async createOrSet({data, opts}: CollectionQueryParamsCreateOrSet<T>): Promise<T> {
        let thing = this.table
        if(data.id){
            if(data.id.split(":")[0] !== this.table){
                throw new Error("Wrong table specified in the identifier");
            }
            Serializer.ensureRecordKey(data.id)
            thing = data.id
        }
        return this.client.queryLast<T>(`CREATE ${thing} CONTENT $data`, { data }, {...this.opts,...(opts||{})}) as T
    }

    // Select table 
    public async findMany({select, matching, where, vars, orderBy, opts, limit, start, fetch}: CollectionQueryParamsFindMany<T>): Promise<T[]> {
        let selectStatement = "*"
        if(select){
            selectStatement = Object.entries(select).map(([k, v]) => {
                if(typeof v === "boolean"){
                    return k
                }
                if(typeof v === "string"){
                    return v + " AS " + k
                }
                return null
            }).filter((v) => v).join(", ")
        }
        let whereClause = this.buildWhereClause(matching, where)
        let orderClause = ""
        if(orderBy){
            orderClause += " ORDER BY "
            orderClause += Object.entries(orderBy).map(([k,v]) => {
                return k + ' ' + (v === 1 ? 'ASC' : 'DESC')
            }).join(", ")
        }
        let limitClause = ""
        if(limit){
            limitClause = " LIMIT " + parseInt(limit+"") 
        }
        let startClause = ""
        if(start){
            startClause = " START " + parseInt(start+"") 
        }
        let fetchClause = ""
        if(fetch){
            fetchClause = " FETCH " + Object.entries(fetch).map(([k,v]) => v ? k : null).filter(v => v).join(", ")
        }
        const sql = `SELECT ${selectStatement} FROM ${this.table}${whereClause}${orderClause}${limitClause}${startClause}${fetchClause}`
        return this.client.queryLastArray<T>(sql, {...(vars||{})}, {...this.opts,...(opts||{})})
    }

    public async findById(id: string, opts: SurrealRESTClientOptions = {}): Promise<T | null> {
        if(id.split(":")[0] !== this.table){
            throw new Error("Wrong table specified in the identifier");
        }
        const items = await this.findMany({matching: {id: id}, limit: 1, opts: {...this.opts,...(opts||{})}})
        if(items.length === 0){
            return null
        }
        return items[0]
    }
    private buildWhereClause(matching: MatchingClause<T> | undefined, where: string | undefined){
        let whereClause = ""
        if(matching || where){
            whereClause += " WHERE "

            let parts: string[] = []
            if(matching)
            parts = Object.entries(matching).map(([k,v]) => {
                return k + ' = ' + Serializer.value(v)
            })

            if(where)
            parts.push(where)

            whereClause += parts.join(" AND ")
        }
        return whereClause
    }
    public async delete({matching, where, opts}: CollectionQueryParamsDelete<T>): Promise<T[]> {
        const whereClause = this.buildWhereClause(matching, where)
        const sql = `DELETE ${this.table} ${whereClause} RETURN BEFORE;`
        return this.client.queryLastArray<T>(sql, {}, {...this.opts,...(opts||{})})
    }

    // 
    public async update({matching, where,data, replace, opts}: CollectionQueryParamsUpdate<T>): Promise<T[]> {
        const whereClause = this.buildWhereClause(matching, where)
        let method = replace ? 'CONTENT' : 'MERGE'
        const sql = `UPDATE ${this.table} ${method} $data ${whereClause} RETURN AFTER;`
        return this.client.queryLastArray<T>(sql, {data}, {...this.opts,...(opts||{})})
    }
}

export default Collection