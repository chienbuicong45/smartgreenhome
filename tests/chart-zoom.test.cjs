const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const events = {}, toolbarEvents = {}, labels = [], frames = [];
const status = { textContent: "" }, buttons = [{}, {}, {}];
const ctx = new Proxy({}, { get: (target, key) => target[key] || (key === "fillText"
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
const toolbar = { querySelector:()=>status, querySelectorAll:()=>buttons,
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
data=[];panel.draw();assert(buttons.every(x=>x.disabled));
console.log("PASS bounded zoom, pan, pinch, reset, time labels and empty data");
