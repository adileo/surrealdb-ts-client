import SurrealRESTClient from "."
import { getEntity, getFields, getIndexes, getSelectAs } from "./decorators"
import Serializer from "./serializer"
import { CollectionQueryParamsCreateOrSet, CollectionQueryParamsDelete, CollectionQueryParamsFindById, CollectionQueryParamsFindMany, CollectionQueryParamsUpdate, EntityMetadata, FieldMetadata, IndexMetadata, Logger, MatchingClause, PermissionsMetatada, SelectAsMetadata, SurrealRESTClientOptions } from "./types"


class Collection<T> {
    table: string
    client: SurrealRESTClient
    opts: SurrealRESTClientOptions
    logger: Logger

    // Model related Metadata
    modelClass: new () => T
    entity: EntityMetadata | undefined
    fields: Record<string, FieldMetadata> = {}
    indexes: Record<string, IndexMetadata> = {}
    selectAs: Record<string, SelectAsMetadata> = {}

    // indexes: Record<string, Index> = {}
    constructor(logger: Logger, modelClass: new () => T, client: SurrealRESTClient, opts: SurrealRESTClientOptions = {}){
        this.modelClass = modelClass
        this.logger = logger
        const entity = getEntity(modelClass)!
        if(!entity){
            throw "The specified class is not an Entity, please use the @Entity decorator"
        }
        this.entity = entity.config

        const fields = getFields(modelClass)
        if(fields.length == 0){
            throw "Please specify at least one @Field in your @Entity class"
        }
        this.fields = fields.reduce((a,b) => ({...a, [b.propertyName]: b.config}), {})
        const indexes = getIndexes(modelClass)
        this.indexes = indexes.reduce((a,b) => ({...a, [b.config.config && b.config.config?.name ? b.config.config?.name : b.config.keys.join("__")]: b.config}),{})

        const selectAs = getSelectAs(modelClass)
        this.selectAs = selectAs.reduce((a,b) => ({...a, [b.propertyName]: b.config}), {})

        this.table = this.entity && this.entity.name ? this.entity.name : modelClass.name.toLocaleLowerCase()
        this.client = client
        this.opts = opts
    }

    private getOpts(overrideOpts?: SurrealRESTClientOptions){
        return {...this.opts,...(overrideOpts||{})};
    }
    public async synchronize(){
        this.logger("debug", "SYNCHRONIZE ENTITY "+ this.table)
        // this.logger("info", this.buildTableStatement())
        // this.logger("info", this.buildFieldStatements())
        // this.logger("info", this.buildIndexStatements())
        const sql = [this.buildTableStatement(), this.buildFieldStatements(), this.buildIndexStatements()].join("\n")
        await this.client.queryRaw(sql, {})
    }
    private buildPermissionStatement(permObj: PermissionsMetatada | undefined){
        let permissions = ""
        if(permObj){
            permissions = " PERMISSIONS"
            if(permObj === "FULL"){
                permissions += " FULL"
            }else if(permObj === "NONE"){
                permissions += " NONE"
            }else{
                permissions += ` FOR select ${permObj.select || "FULL"}, FOR create ${permObj.create || "FULL"}, FOR update ${permObj.update || "FULL"}, FOR delete ${permObj.delete || "FULL"}`
            }
        }
        return permissions
    }
    public buildTableStatement(): string{
        const name = this.table
        const drop = this.entity && this.entity.drop ? " DROP" : ""
        const schema = this.entity && this.entity.schemafull ? " SCHEMAFULL" : " SCHEMALESS"
        const as = this.entity && this.entity.as ? " AS "+ this.entity.as.trim() : ""
        let permissions = this.buildPermissionStatement(this.entity?.permissions)
        let statement = `DEFINE TABLE ${name}${drop}${schema}${as}${permissions}`.trimEnd()+";"
        return statement
    }
    public buildFieldStatements(){
        const statements = Object.entries(this.fields).map(([tsField, conf]) => {
            const name = conf.name ? conf.name : tsField
            const type = conf.surrealType ? " TYPE "+conf.surrealType : undefined
            if(!type){
                throw `Unable to infer type on field ${tsField}`;
            }
            let value = conf.value ? " VALUE " + conf.value : ""
            let assert = conf.assert ? " ASSERT " + conf.assert : ""
            let permissions = this.buildPermissionStatement(conf.permissions)
            let statement = `DEFINE FIELD ${name} ON ${this.table}${type}${value}${assert}${permissions}`.trimEnd()+";"
            return statement;
        }).join("\n")
        return statements
    }
    public buildIndexStatements(){
        const statements = Object.entries(this.indexes).map(([name, conf]) => {
            let statement = `DEFINE INDEX ${name} ON ${this.table} FIELDS ${conf.keys.join(", ")}${conf.config && conf.config?.unique ? " UNIQUE" : ""}`.trimEnd()+";"
            return statement;
        }).join("\n")
        return statements
    }

    // Create or set (override all) record content
    public async create({data, opts}: CollectionQueryParamsCreateOrSet<T>): Promise<T> {
        let thing = this.table
        if(data.id){
            if(data.id.split(":")[0] !== this.table){
                throw new Error("Wrong table specified in the identifier");
            }
            Serializer.ensureRecordKey(data.id)
            thing = data.id
        }
        const promise = await this.client.queryLast<T>(`CREATE ${thing} CONTENT $data`, { data }, this.getOpts(opts)) as T
        return this.buildObject(promise)
    }

    // Select table 
    public async findMany({select, matching, where, vars, orderBy, opts, limit, start, fetch}: CollectionQueryParamsFindMany<T>): Promise<T[]> {
        let selectStatement = "*"
        if(select){
            // TODO: map db name from Field definition
            selectStatement = Object.entries(select).map(([k, v]) => {
                if(typeof v === "boolean"){
                    if(k in this.selectAs){
                        // Remote selection
                        return this.selectAs[k].definition + " AS " + k
                    }else{
                        // Simple selection
                        return k
                    }
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

        const promsise = await this.client.queryLastArray<T>(sql, {...(vars||{})}, this.getOpts(opts))
        return promsise.map(v => this.buildObject(v))
    }

    public async findById(id: string, {select ,opts}: CollectionQueryParamsFindById<T> = {}): Promise<T | null> {
        if(id.split(":")[0] !== this.table){
            throw new Error("Wrong table specified in the identifier");
        }
        const items = await this.findMany({matching: {id: id}, select, limit: 1, opts: this.getOpts(opts)})
        if(items.length === 0){
            return null
        }
        return this.buildObject(items[0])
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
    public async delete({matching, where, opts}: CollectionQueryParamsDelete<T> = {}): Promise<T[]> {
        const whereClause = this.buildWhereClause(matching, where)
        const sql = `DELETE ${this.table} ${whereClause} RETURN BEFORE;`
        const promsise = await this.client.queryLastArray<T>(sql, {}, this.getOpts(opts))
        return promsise.map(v => this.buildObject(v))
    }

    // 
    public async update({matching, where,data, replace, opts}: CollectionQueryParamsUpdate<T>): Promise<T[]> {
        const whereClause = this.buildWhereClause(matching, where)
        let method = replace ? 'CONTENT' : 'MERGE'
        const sql = `UPDATE ${this.table} ${method} $data ${whereClause} RETURN AFTER;`
        const promsise = await this.client.queryLastArray<T>(sql, {data}, this.getOpts(opts))
        return promsise.map(v => this.buildObject(v))
    }

    private buildObject(data: any): T{
        const obj: T = new this.modelClass()
        Object.assign(obj as any, data)
        return obj
    }
}

export default Collection