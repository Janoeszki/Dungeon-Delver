"use strict";
const x = `backtick` + "double" + 'single';
function foo(a) { return a + 1; }
const obj = { a: 1, b: `x` };
console.log(x, foo(2), obj);
