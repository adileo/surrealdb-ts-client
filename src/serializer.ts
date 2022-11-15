import { SurrealType } from "./types";

class Serializer {
    static serialize(obj: any): string {
        if (typeof obj !== 'object' || obj === null || obj instanceof Array) {
            return Serializer.value(obj);
        }

        return '{' + Object.keys(obj).map(function (k) {
            return (typeof obj[k] === 'function') ? null : '"' + k + '":' + Serializer.value(obj[k]);
        }).filter(function (i) { return i; }) + '}';
    }
    static serializeSetStatement(obj: any): string {
        if (typeof obj !== 'object' || obj === null || obj instanceof Array) {
            return Serializer.value(obj);
        }

        return Object.keys(obj).map(function (k) {
            return (typeof obj[k] === 'function') ? null : ' ' + k + ' = ' + Serializer.value(obj[k]);
        }).filter(function (i) { return i; }) + '';
    }
    static sanitizeVariable(value: string): string{
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    
    
    static ensureRecordKey(k: string){
        if(!k.match(/^[0-9a-z-A-Z_]+\:[0-9a-z-A-Z_]+$/)){
            throw new Error("Invalid Key: " + k);
        }
        return k
    }
    static ensureKey(k: string){
        if(!k.match(/^[0-9a-z-A-Z_]+$/)){
            throw new Error("Invalid Key: " + k);
        }
        return k
    }
    static value(val: any): string | never {
        switch (typeof val) {
            case 'string':
                return '"' + Serializer.sanitizeVariable(val) + '"';
            case 'number':
            case 'boolean':
                return '' + val;
            case 'function':
                return 'null';
            case 'object':
                if (val instanceof Date) return '"' + val.toISOString() + '"';
                if (val instanceof Array) return '[' + val.map(Serializer.value).join(',') + ']';
                if (val instanceof SurrealType) {
                    switch (val.type) {
                        case "record":
                            return Serializer.sanitizeVariable(val.value)
                        default:
                            throw new Error("Invalid type")
                    }
                }
                if (val === null) return 'null';
                return Serializer.serialize(val);
        }
        console.log(val)
        throw new Error("Invalid type")
    }
}

export default Serializer