import fetch from 'cross-fetch';
export class SurrealType {
    type: string
    value: any
    constructor(type: string, value: any) {
        this.type = type
        this.value = value
    }
}
export class SDBType {
    static Record(ref: string) {
        return new SurrealType("record", ref)
    }
}
export type StatementResponse<T = any> = {
    time: string
    status: string
    result: null | Array<T>
}
export class SurrealObject {
    static serialize(obj: any): string {
        if (typeof obj !== 'object' || obj === null || obj instanceof Array) {
            return SurrealObject.value(obj);
        }

        return '{' + Object.keys(obj).map(function (k) {
            return (typeof obj[k] === 'function') ? null : '"' + k + '":' + SurrealObject.value(obj[k]);
        }).filter(function (i) { return i; }) + '}';
    }
    static sanitizeVariable(value: string): string{
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    static value(val: any): string | never {
        switch (typeof val) {
            case 'string':
                return '"' + SurrealObject.sanitizeVariable(val) + '"';
            case 'number':
            case 'boolean':
                return '' + val;
            case 'function':
                return 'null';
            case 'object':
                if (val instanceof Date) return '"' + val.toISOString() + '"';
                if (val instanceof Array) return '[' + val.map(SurrealObject.value).join(',') + ']';
                if (val instanceof SurrealType) {
                    switch (val.type) {
                        case "record":
                            return SurrealObject.sanitizeVariable(val.value)
                        default:
                            throw new Error("Invalid type")
                    }
                }
                if (val === null) return 'null';
                return SurrealObject.serialize(val);
        }
        console.log(val)
        throw new Error("Invalid type")
    }
}

type ReturnType = "lastStatementSingle" | "lastStatementArray" | "raw"

type SurrealRESTClientOptions = {
    ns?: string
    db?: string

    user?: string
    pass?: string
    token?: string // Access token

    logQuery?: boolean
}
type QueryResult<T, RT> = 
RT extends "lastStatementSingle" ? T :
RT extends "raw" ? StatementResponse<T>[] :
RT extends "lastStatementArray" ? T[] : never;

export class SurrealRESTClient {
    endpoint: string
    ns: string
    database: string

    user: string
    pass: string
    token: string

    public constructor(endpoint: string, { namespace, database, user, pass, token }: any) {
        this.endpoint = endpoint
        this.ns = namespace
        this.database = database
        this.user = user
        this.pass = pass
        this.token = token
    }
    public async query<T, RR extends ReturnType>(sql: string, variables: any, returnType: ReturnType, opts: SurrealRESTClientOptions = {}): Promise<QueryResult<T,RR>>  {
        const pre = Object.entries(variables).map(([k, v]) => {
            return "LET $" + k + " = " + SurrealObject.serialize(v) + ";\n";
        }).join("")
        const query = pre + sql
        if(opts.logQuery)
            console.log(query)
        const response = await fetch(this.endpoint + "/sql", {
            method: 'POST',
            body: query,
            headers: {
                Accept: 'application/json',
                Authorization: this.getAuthorization(opts),
                NS: opts.ns ? opts.ns : this.ns,
                DB: opts.db ? opts.db : this.database,
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

    // Create or set (override all) record content
    public async createOrSet<T>(tableOrKey: string, data: any, opts: SurrealRESTClientOptions = {}): Promise<T> {
        const {thing, params} = this.tableOrThing(tableOrKey)
        return this.queryLast<T>(`CREATE ${thing} CONTENT $data;`, {
            ...params,
            data
        }, {...opts})
    }

    // // Select table 
    public async findMany<T>(table: string, opts: SurrealRESTClientOptions = {}): Promise<T[]> {
        const {thing, params, isThing} = this.tableOrThing(table)
        const sql = `SELECT * FROM ${thing};`
        if(isThing){
            throw new Error("Wrong ID")
        }else{
            return this.queryLastArray<T>(sql, {...params}, {...opts})
        }
    }

    public async findById<T>(id: string, opts: SurrealRESTClientOptions = {}): Promise<T> {
        const {thing, params, isThing} = this.tableOrThing(id)
        const sql = `SELECT * FROM ${thing};`
        if(isThing){
            return this.queryLast<T>(sql, {...params}, {...opts})
        }else{
           throw new Error("Wrong ID")
        }
    }

    // Set field (MERGE Mode) into existing record/s
    public async mergeSet<T>(tableOrKey: string, data: any, opts: SurrealRESTClientOptions = {}) {
        const {thing, params, isThing} = this.tableOrThing(tableOrKey)
        const sql = `UPDATE ${thing} MERGE $data RETURN NONE;`
        if(isThing){
            return this.queryLast<T>(sql, {data, ...params}, {...opts})
        }else{
            return this.queryLastArray<T>(sql, {data, ...params}, {...opts})
        }
    }

    private tableOrThing(key: string){
        let split = key.split(":")
        if(split.length == 1){
            return {
                thing: "type::table($table)",
                params: {"table": split[0]},
                isTable: true
            }
        }else if(split.length == 2){
            return {
                thing: "type::thing($table, $itemId)",
                params: {"table": split[0], "itemId": split[1]},
                isThing: true
            }
        }
        throw new Error("Invalid key");
    }
    private async parseResponse<T>(response: Response, returnType: ReturnType): Promise<StatementResponse<T>[] | T | T[] | null> {
        const resp: StatementResponse<T>[] = await response.json()
        if((resp as any).code){
            throw resp
        }
        // Return all JSON response
        if (returnType === "raw")
            return resp
        if (resp.length > 0) {
            if(returnType === "lastStatementSingle" && resp[resp.length-1].result !== null && resp[resp.length-1].result!.length > 0){
                // Pick last query first result: object
                return resp[resp.length-1].result![0]
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

}
export default SurrealRESTClient