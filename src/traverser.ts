// Copyright (c) 2016 Segment.io, Inc. (friends@segment.com)
// https://github.com/segmentio/isodate-traverse

var matcher = /^(\d{4})(?:-?(\d{2})(?:-?(\d{2}))?)?(?:([ T])(\d{2}):?(\d{2})(?::?(\d{2})(?:[,\.](\d{1,}))?)?(?:(Z)|([+\-])(\d{2})(?::?(\d{2}))?)?)?$/;

function isoParse(iso: string) {
    var numericKeys = [1, 5, 6, 7, 11, 12];
    var arr: any = matcher.exec(iso);
    var offset = 0;
  
    // fallback to native parsing
    if (!arr) {
      return new Date(iso);
    }
  
    /* eslint-disable no-cond-assign */
    // remove undefined values
    for (var i = 0, val; val = numericKeys[i]; i++) {
      arr[val] = parseInt(arr[val], 10) || 0;
    }
    /* eslint-enable no-cond-assign */
  
    // allow undefined days and months
    arr[2] = parseInt(arr[2], 10) || 1;
    arr[3] = parseInt(arr[3], 10) || 1;
  
    // month is 0-11
    arr[2]--;
  
    // allow abitrary sub-second precision
    arr[8] = arr[8] ? (arr[8] + '00').substring(0, 3) : 0;
  
    // apply timezone if one exists
    if (arr[4] === ' ') {
      offset = new Date().getTimezoneOffset();
    } else if (arr[9] !== 'Z' && arr[10]) {
      offset = arr[11] * 60 + arr[12];
      if (arr[10] === '+') {
        offset = 0 - offset;
      }
    }
  
    var millis = Date.UTC(arr[1], arr[2], arr[3], arr[5], arr[6] + offset, arr[7], arr[8]);
    return new Date(millis);
};
function isISOdate(string: string, strict: boolean) {
    if (typeof string !== 'string') {
      return false;
    }
    if (strict && (/^\d{4}-\d{2}-\d{2}/).test(string) === false) {
      return false;
    }
    return matcher.test(string);
  };
export function traverse(input: any, strict: boolean): any {
    if (strict === undefined) strict = true;
    if (input && typeof input === 'object') {
      return traverseObject(input, strict);
    } else if (Array.isArray(input)) {
      return traverseArray(input, strict);
    } else if (isISOdate(input, strict)) {
      return isoParse(input);
    }
    return input;
}
function traverseObject(obj: any, strict: boolean) {
    Object.keys(obj).forEach(function(key) {
        obj[key] = traverse(obj[key], strict);
    });
    return obj;
}
function traverseArray(arr: any, strict: boolean) {
    arr.forEach(function(value: any, index: any) {
        arr[index] = traverse(value, strict);
    });
    return arr;
}