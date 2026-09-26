const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const events = {}, toolbarEvents = {}, labels = [], frames = [];
const status = { textContent: "" }, buttons = [{}, {}, {}];
const segments = [];
let lastPoint;
const drawing = {
 beginPath() { lastPoint = null; },
 moveTo(x, y) { lastPoint = [x, y]; },
 lineTo(x, y) {
   if (lastPoint) segments.push({ from: lastPoint, to: [x, y] });
   lastPoint = [x, y];
 }
};
const ctx = new Proxy(drawing, { get: (target, key) => target[key] || (key === "fillText"
  ? (text) => labels.push(text) : () => {}), set: (target,key,value) => (target[key]=value,true) });
const captures = new Set();
const canvas = {
  id: "test", getContext: () => ctx,
  getBoundingClientRect: () => ({left:0,top:0,width:400,height:300}),
  closest: () => ({getBoundingClientRect:()=>({left:0,top:0,width:400,height:300})}),
  addEventListener: (type, listener) => events[type] = listener,
  setPointerCapture: id => captures.add(id), hasPointerCapture:id=>captures.has(id),
  releasePointerCapture:id=>captures.delete(id),
};
const selector = {value:"both", addEventListener:(_, listener)=>{selector.change=listener;}};
const toolbar = { querySelector:(key)=>key === ".chart-series-select" ? selector : status, querySelectorAll:()=>buttons,
  addEventListener:(type,listener)=>toolbarEvents[type]=listener };
const tooltip = { classList:{remove(){}},style:{},replaceChildren(...children){this.children=children;} };
const sandbox = { window:{}, document:{querySelector:()=>toolbar,createElement:()=>({})},
  requestAnimationFrame: callback => { frames.push(callback);return frames.length; } };
vm.runInNewContext(fs.readFileSync("chart-zoom.js","utf8"),sandbox);
const api=sandbox.window.GreenhouseChartZoom;
let v=api.zoomWindow({start:0,end:1},2,.5);
assert.equal(v.start,.25);assert.equal(v.end,.75);
v=api.panWindow(v,-100);assert.equal(v.end,1);
v=api.panWindow(v,100);assert.equal(v.start,0);
v=api.zoomWindow(v,1e9,.5);assert.equal(v.end-v.start,1/256);
v=api.zoomWindow(v,1e-9,.5);assert.equal(v.start,0);assert.equal(v.end,1);
let data=[
 {time:new Date(2026,8,23,8),temperature:28,humidity:80},
 {time:new Date(2026,8,24,8),temperature:30,humidity:82}
];
assert.equal(api.lowerBound(data,+data[0].time+1),1);
const panel=api.attach(canvas,()=>data,tooltip);
const flush=()=>{while(frames.length)frames.shift()();};
panel.draw();assert(labels.some(text=>text.includes("23")));assert(!buttons[0].disabled);
toolbarEvents.click({target:{closest:()=>({dataset:{zoom:"in"}})}});flush();assert.equal(status.textContent,"Zoom 2.0×");
events.pointerdown({button:0,pointerId:1,clientX:170,clientY:130});
events.pointermove({pointerId:1,clientX:120,clientY:130});flush();
events.pointerup({pointerId:1,type:"pointerup",clientX:120,clientY:130});assert.equal(captures.size,0);
events.keydown({key:"0",preventDefault(){}});flush();assert.equal(status.textContent,"Zoom 1.0×");
events.pointerdown({button:0,pointerId:1,clientX:120,clientY:130});
events.pointerdown({button:0,pointerId:2,clientX:220,clientY:130});
events.pointermove({pointerId:2,clientX:320,clientY:130});flush();assert.equal(status.textContent,"Zoom 2.0×");
events.pointercancel({pointerId:1,type:"pointercancel"});events.pointercancel({pointerId:2,type:"pointercancel"});
panel.reset();flush();assert.equal(status.textContent,"Zoom 1.0×");
data = [
 {time:new Date(2026,8,23,8),temperature:30,humidity:80},
 {time:new Date(2026,8,23,9),temperature:0,humidity:0},
 {time:new Date(2026,8,23,10),temperature:28,humidity:70}
];
segments.length = 0;
panel.draw();
assert(segments.every(segment => segment.from[0] === segment.to[0] || segment.from[1] === segment.to[1]), 'no diagonal transitions');
assert(segments.some(segment => segment.from[1] === 252 && segment.to[1] === 252 && segment.to[0] > segment.from[0]), 'zero interval stays on plot floor');
assert(labels.some(text => text.startsWith('0') && text.endsWith('/ 0%')), 'axis starts at zero');
selector.value = "temperature"; selector.change(); flush();
assert(labels.at(-1) !== undefined);
assert(labels.includes("40"+String.fromCharCode(176)+"C"));
selector.value = "humidity"; selector.change(); flush();
assert(labels.includes("100%"));
data=[];panel.draw();assert(buttons.every(x=>x.disabled));
console.log("PASS bounded zoom, pan, pinch, reset, time labels and empty data");
