import "reflect-metadata";
import { EntityMetadata, FieldMetadata, IndexConfigMetadata, IndexKeysMetadata, IndexMetadata, SelectAsMetadata, SurrealDBType } from "./types";

type EntityCollectionItem = {
    target: Function
    config: EntityMetadata | undefined
}
type FieldCollectionItem = {
    target: Function
    propertyName: string
    config: FieldMetadata | undefined
}
type IndexCollectionItem = {
    target: Function
    config: IndexMetadata
}

type SelectAsCollectionItem = {
    target: Function
    propertyName: string
    config: SelectAsMetadata
}
const globalDecoratorCollector: {
    entities: EntityCollectionItem[],
    fields: FieldCollectionItem[],
    indexes: IndexCollectionItem[],
    selectAs: SelectAsCollectionItem[]
} = {
    entities: [],
    fields: [],
    indexes: [],
    selectAs: []
}

// Entities
export function Entity(config?: EntityMetadata): ClassDecorator {
    return function (target) {
        globalDecoratorCollector.entities.push({
            target,
            config
        })
    }
}

export function getEntity(target: Function): EntityCollectionItem | undefined {
    return globalDecoratorCollector.entities.find((e) => e.target === target)
}

// Fields
export function Field(config?: FieldMetadata): PropertyDecorator {
    return function (object: Object, propertyName: string | symbol) {
        let detectedType: string | undefined = Reflect && (Reflect as any).getMetadata ?  (Reflect as any).getMetadata(
            "design:type",
            object,
            propertyName,
        ).name : undefined

        // export type SurrealDBType = "any" | "array" | "bool" | "datetime" | "decimal" | "duration" | "float" | "int" | "number" | "object" | "string" | SurrealDBTypeRecord | SurrealDBTypeGeometry
        const typeMap: Record<string, SurrealDBType> = {
            "Boolean": "bool",
            "Number": "number",
            "Bigint": "number",
            "String": "string",
            "Any": "any",
            "Date": "datetime",
        }
        let type: SurrealDBType | undefined = undefined
        if(detectedType){
            type = typeMap[detectedType]
        }
        if(!type){
            type = "object" // TODO: Possible improvement for objects/recors/arrays
        }
        if(config?.surrealType){
            type = config?.surrealType
        }

        globalDecoratorCollector.fields.push({
            target: object.constructor,
            config: {
                ...(config||{}), 
                surrealType: type,
                detectedType
            },
            propertyName: propertyName as string,
        })
    }
}
export function getFields(target: Function) {
    return globalDecoratorCollector.fields.filter((f) => f.target === target)
}


// Indexes
export function Index(keys: IndexKeysMetadata, config?: IndexConfigMetadata): ClassDecorator {
    return function (target) {
        globalDecoratorCollector.indexes.push({
            target,
            config: { keys, config }
        })
    }
}
export function getIndexes(target: Function) {
    return globalDecoratorCollector.indexes.filter((e) => e.target === target)
}


// Fields
export function SelectAs(def: string): PropertyDecorator {
    return function (object: Object, propertyName: string | symbol) {
        globalDecoratorCollector.selectAs.push({
            target: object.constructor,
            config: {
                definition: def
            },
            propertyName: propertyName as string,
        })
    }
}
export function getSelectAs(target: Function) {
    return globalDecoratorCollector.selectAs.filter((f) => f.target === target)
}