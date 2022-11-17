import { context, Response } from 'fetch-h2'
import Collection from './collection';
import Serializer from './serializer';

import { SurrealRESTClientConstructor, ReturnType, SurrealRESTClientOptions, QueryResult, StatementResponse, LogType, Edge } from './types';

class SurrealRESTClient {
    endpoint: string
    ns?: string
    db?: string

    user?: string
    pass?: string
    token?: string

    fetcher: any
    logger: any

    public constructor(endpoint: string, { ns, db, user, pass, token, fetcher, logger }: SurrealRESTClientConstructor) {
        const ctx = context({
            userAgent: 'surrealdb-ts-client'
        });
        this.endpoint = endpoint
        this.ns = ns
        this.db = db
        this.user = user
        this.pass = pass
        this.token = token
        this.fetcher = fetcher ? fetcher : ctx.fetch
        this.logger = (type: LogType, log: any) => {
            if(logger)
            logger[type](log)
        }
    }
    public async query<T, RR extends ReturnType>(sql: string, variables: any, returnType: ReturnType, opts: SurrealRESTClientOptions = {}): Promise<QueryResult<T,RR>>  {
        // console.log({sql, variables})
        const pre = Object.entries(variables).map(([k, v]) => {
            return "LET $" + k + " = " + Serializer.serialize(v) + ";\n";
        }).join("")
        const query = pre + sql
        this.logger('debug',{method:'query', query, variables})
        const response = await this.fetcher(this.endpoint + "/sql", {
            method: 'POST',
            body: query,
            headers: {
                Accept: 'application/json',
                Authorization: this.getAuthorization(opts),
                NS: (opts.ns ? opts.ns : this.ns) || '',
                DB: (opts.db ? opts.db : this.db) || '',
            }
        })
        return await this.parseResponse<T>(response, returnType) as QueryResult<T,RR>
    }
    public async queryRaw<T>(sql: string, variables: any, opts: SurrealRESTClientOptions = {}) {
        return this.query<T, "raw">(sql, variables, "raw", opts)
    }
    public async queryLast<T>(sql: string, variables: any, opts: SurrealRESTClientOptions = {}) {
        return this.query<T, "lastStatementSingle">(sql, variables, "lastStatementSingle", opts)
    }
    public async queryLastArray<T>(sql: string, variables: any, opts: SurrealRESTClientOptions = {}) {
        return this.query<T, "lastStatementArray">(sql, variables, "lastStatementArray", opts)
    }    
  
  
    
    private async parseResponse<T>(response: Response, returnType: ReturnType): Promise<StatementResponse<T>[] | T | T[] | null> {
        const resp: StatementResponse<T>[] = await response.json()
        this.logger('debug',{method:'parseResponse', response: resp})
        if((resp as any).code){
            throw resp
        }
     
        // Return all JSON response
        if (returnType === "raw")
            return resp
        if (resp.length > 0) {
            if(resp[0].status === "ERR"){
                throw resp[0]
            }
            if(returnType === "lastStatementSingle" && resp[resp.length-1].result !== null){
                if(resp[resp.length-1].result!.length > 0){
                    // Pick last query first result: object
                    return resp[resp.length-1].result![0]
                }else{
                    return null
                }
            }else{
                // Pick last query all results: array
                return resp[resp.length-1].result
            }
        } else {
            return []
        }
    }

    private getAuthorization(opts: SurrealRESTClientOptions) {
        let username = opts.user ? opts.user : this.user
        let password = opts.pass ? opts.pass : this.pass
        let token = opts.token ? opts.token : this.token
        if(token){
            return 'Bearer ' + token
        }else{
            const authorization = Buffer.from(username + ":" + password)
            return 'Basic ' + authorization.toString('base64')
        }
    }

    public async collection<T>(modelClass: new () => T, opts: SurrealRESTClientOptions = {}){
        const c = new Collection(this.logger, modelClass, this, opts)
        await c.synchronize()
        return c
    } 

    private isString(str: any){
        return typeof str === 'string' || str instanceof String
    }

    public async relate<T>(from: any, edge: any, to: any, data?: T, opts: SurrealRESTClientOptions = {}){
        let fromId, toId
        if(this.isString(from) && Serializer.ensureRecordKey(from)){
            fromId = from
        }else{
            if(this.isString(from.id) && Serializer.ensureRecordKey(from.id)){
                fromId = from.id
            }else{
                throw "The 'from' argument should be either an ID or an object with an id field";
            }
        }
        if(this.isString(to) && Serializer.ensureRecordKey(to)){
            toId = to
        }else{
            if(this.isString(to.id) && Serializer.ensureRecordKey(to.id)){
                toId = to.id
            }else{
                throw "The 'to' argument should be either an ID or an object with an id field";
            }
        }
        return this.query<T & Edge, "lastStatementSingle">(`RELATE $fromId -> ${edge} -> $toId CONTENT $data`, {
            fromId,
            toId,
            data: (data || {})
        }, "lastStatementSingle", opts)
    }

}
export default SurrealRESTClient