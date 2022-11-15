export type SurrealRESTClientConstructor = {
    ns?: string
    db?: string
    user?: string
    pass?: string
    token?: string

    fetcher?: (url: string, params: any) => any
    logger?: any
}

export type ReturnType = "lastStatementSingle" | "lastStatementArray" | "raw"

export type SurrealRESTClientOptions = {
    ns?: string
    db?: string

    user?: string
    pass?: string
    token?: string // Access token
}
export type QueryResult<T, RT> = 
RT extends "lastStatementSingle" ? T | null :
RT extends "raw" ? StatementResponse<T>[] :
RT extends "lastStatementArray" ? T[] : never;

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


export type ReturnStatementOptions = "none" | "diff" | "before" | "after" | string 

export type RecordBasic = {
    id: string
}
export type RecordCreate = {
    id?: string
}

export type SelectFilter<T> = {
    [k in (keyof T | string)]: boolean | string;
}

export type WhereLogicalOperators = "AND" | "OR"

export type StringFilter = {

} & string
export type MatchingClause<T> = {
    [key in keyof T]?: T[key] | any;
} & RecordCreate
export type OrderClause<T> = {
    [key in keyof T]?: 1 | -1;
}
export type FetchClause<T> = {
    [key in keyof T | string]?: boolean;
}

export type CollectionQueryParamsBase = {
    opts?: SurrealRESTClientOptions
}

export type CollectionQueryParamsCreateOrSet<T> = CollectionQueryParamsBase & {
    data: RecordCreate & Partial<T>
}

export type CollectionQueryParamsFindMany<T> = CollectionQueryParamsBase & {
    select?: SelectFilter<T>
    matching?: MatchingClause<T>
    where?: string
    vars?: any
    orderBy?: OrderClause<T>
    limit?: number
    start?: number
    fetch?: FetchClause<T>
}

export type CollectionQueryParamsDelete<T> = CollectionQueryParamsBase & {
    matching?: MatchingClause<T>
    where?: string
    vars?: any
}

export type CollectionQueryParamsUpdate<T> = CollectionQueryParamsBase & {
    matching?: MatchingClause<T>
    where?: string
    data: RecordCreate & Partial<T>
    replace?: boolean
    vars?: any
}

export type LogType = "debug" | "info" | "warn" | "error" | "fatal"