"use strict";(()=>{var Ve=Object.create;var Y=Object.defineProperty;var Je=Object.getOwnPropertyDescriptor;var Ke=Object.getOwnPropertyNames;var Ye=Object.getPrototypeOf,Xe=Object.prototype.hasOwnProperty;var l=(e,t)=>Y(e,"name",{value:t,configurable:!0}),S=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')});var Qe=(e,t,r,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of Ke(t))!Xe.call(e,s)&&s!==r&&Y(e,s,{get:()=>t[s],enumerable:!(o=Je(t,s))||o.enumerable});return e};var P=(e,t,r)=>(r=e!=null?Ve(Ye(e)):{},Qe(t||!e||!e.__esModule?Y(r,"default",{value:e,enumerable:!0}):r,e));var X="https://evn-notebook.invalid/pyodide/",D=class extends Error{static{l(this,"NetworkBlocked")}constructor(t){super(`NetworkBlocked: ${t} is blocked: the notebook makes no network requests`),this.name="NetworkBlocked"}toString(){return this.message}},Ze=["fetch","XMLHttpRequest","WebSocket","EventSource","WebTransport","importScripts","Worker","SharedWorker","FontFace"],U=l(e=>String(e&&typeof e=="object"&&"url"in e?e.url:e),"urlOf");function Q(e,t){let r=l(function(o){throw new D(t&&o!==void 0?`${e}(${U(o)})`:e)},"f");return Object.defineProperty(r,"name",{value:e}),r}l(Q,"blocker");function de(){let e={};for(let t of Ze)e[t]=Q(t,t!=="XMLHttpRequest");return e}l(de,"blockingStubs");function fe(e){let t={},r,o=de(),s=l(c=>{let g=typeof c.body=="string"||c.body instanceof Uint8Array?c.body:new Uint8Array(c.body);return new Response(g,{status:200,headers:{"Content-Type":c.type}})},"respond"),n=l(function(g){let _=U(g);if(_.startsWith(X)){let w=_.slice(X.length),F=t[w];if(F)return Promise.resolve(s(F));let O=r?.(w);if(O)return O.then(s)}throw new D(`fetch(${_})`)},"fetch"),i=[];for(let c=Object.getPrototypeOf(e);c&&c!==Object.prototype;c=Object.getPrototypeOf(c))i.push(c);let f=l((c,g,_)=>{try{Object.defineProperty(c,g,{value:_,writable:!1,configurable:!1,enumerable:!1})}catch{try{c[g]=_}catch{}}},"defineOn"),p=l((c,g)=>{f(e,c,g);for(let _ of i)Object.prototype.hasOwnProperty.call(_,c)&&f(_,c,g)},"define"),u=typeof e.importScripts=="function"?e.importScripts.bind(e):void 0;p("fetch",n);for(let c of["XMLHttpRequest","WebSocket","EventSource","WebTransport","Worker","SharedWorker","FontFace"])p(c,o[c]);if("fonts"in e){let c={add:Q("fonts.add",!1),load:Q("fonts.load",!1),check:l(()=>!1,"check")};p("fonts",c)}let m=e.Cache;if(m&&m.prototype){let c=l(w=>U(w).startsWith(X),"ownUrl"),g=m.prototype.add,_=m.prototype.addAll;typeof g=="function"&&(m.prototype.add=function(w){return c(w)?g.call(this,w):Promise.reject(new D(`Cache.add(${U(w)})`))}),typeof _=="function"&&(m.prototype.addAll=function(w){let F=Array.from(w||[]).find(O=>!c(O));return F!==void 0?Promise.reject(new D(`Cache.addAll(${U(F)})`)):_.call(this,w)})}return{serve(c){Object.assign(t,c)},provide(c){r=c},closeImportScripts(){u&&p("importScripts",o.importScripts)},importScripts:u}}l(fe,"installNetworkGuard");function pe(e){let t=["setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","Array","Object","Date","WeakRef","Math","JSON","console","eval","Promise","Error","TypeError","RangeError","Symbol","Number","String","Boolean","BigInt","Map","Set","WeakMap","Reflect","Proxy","ArrayBuffer","DataView","Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array","BigInt64Array","BigUint64Array","TextEncoder","TextDecoder","FinalizationRegistry","AbortController","AbortSignal","Headers","Request","Response","Blob","URL","performance","structuredClone","isNaN","isFinite","parseInt","parseFloat"],r={};for(let o of t)e[o]!==void 0&&(r[o]=typeof e[o]=="function"&&/^[a-z]/.test(o)&&o!=="eval"?e[o].bind(e):e[o]);return Object.assign(r,de()),r}l(pe,"jsGlobals");var M=fe(globalThis);var et=Object.defineProperty,d=l((e,t)=>et(e,"name",{value:t,configurable:!0}),"o"),me=(e=>typeof S<"u"?S:typeof Proxy<"u"?new Proxy(e,{get:l((t,r)=>(typeof S<"u"?S:t)[r],"get")}):e)(function(e){if(typeof S<"u")return S.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),tt=(()=>{for(var e=new Uint8Array(128),t=0;t<64;t++)e[t<26?t+65:t<52?t+71:t<62?t-4:t*4-205]=t;return r=>{for(var o=r.length,s=new Uint8Array((o-(r[o-1]=="=")-(r[o-2]=="="))*3/4|0),n=0,i=0;n<o;){var f=e[r.charCodeAt(n++)],p=e[r.charCodeAt(n++)],u=e[r.charCodeAt(n++)],m=e[r.charCodeAt(n++)];s[i++]=f<<2|p>>4,s[i++]=p<<4|u>>2,s[i++]=u<<6|m}return s}})();function he(e){return!isNaN(parseFloat(e))&&isFinite(e)}l(he,"se");d(he,"_isNumber");function I(e){return e.charAt(0).toUpperCase()+e.substring(1)}l(I,"S");d(I,"_capitalize");function J(e){return function(){return this[e]}}l(J,"L");d(J,"_getter");var C=["isConstructor","isEval","isNative","isToplevel"],L=["columnNumber","lineNumber"],z=["fileName","functionName","source"],rt=["args"],nt=["evalOrigin"],V=C.concat(L,z,rt,nt);function N(e){if(e)for(var t=0;t<V.length;t++)e[V[t]]!==void 0&&this["set"+I(V[t])](e[V[t]])}l(N,"p");d(N,"StackFrame");N.prototype={getArgs:d(function(){return this.args},"getArgs"),setArgs:d(function(e){if(Object.prototype.toString.call(e)!=="[object Array]")throw new TypeError("Args must be an Array");this.args=e},"setArgs"),getEvalOrigin:d(function(){return this.evalOrigin},"getEvalOrigin"),setEvalOrigin:d(function(e){if(e instanceof N)this.evalOrigin=e;else if(e instanceof Object)this.evalOrigin=new N(e);else throw new TypeError("Eval Origin must be an Object or StackFrame")},"setEvalOrigin"),toString:d(function(){var e=this.getFileName()||"",t=this.getLineNumber()||"",r=this.getColumnNumber()||"",o=this.getFunctionName()||"";return this.getIsEval()?e?"[eval] ("+e+":"+t+":"+r+")":"[eval]:"+t+":"+r:o?o+" ("+e+":"+t+":"+r+")":e+":"+t+":"+r},"toString")};N.fromString=d(function(e){var t=e.indexOf("("),r=e.lastIndexOf(")"),o=e.substring(0,t),s=e.substring(t+1,r).split(","),n=e.substring(r+1);if(n.indexOf("@")===0)var i=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(n,""),f=i[1],p=i[2],u=i[3];return new N({functionName:o,args:s||void 0,fileName:f,lineNumber:p||void 0,columnNumber:u||void 0})},"StackFrame$$fromString");for(R=0;R<C.length;R++)N.prototype["get"+I(C[R])]=J(C[R]),N.prototype["set"+I(C[R])]=(function(e){return function(t){this[e]=!!t}})(C[R]);var R;for(T=0;T<L.length;T++)N.prototype["get"+I(L[T])]=J(L[T]),N.prototype["set"+I(L[T])]=(function(e){return function(t){if(!he(t))throw new TypeError(e+" must be a Number");this[e]=Number(t)}})(L[T]);var T;for(B=0;B<z.length;B++)N.prototype["get"+I(z[B])]=J(z[B]),N.prototype["set"+I(z[B])]=(function(e){return function(t){this[e]=String(t)}})(z[B]);var B,Z=N;function ge(){var e=/^\s*at .*(\S+:\d+|\(native\))/m,t=/^(eval@)?(\[native code])?$/;return{parse:d(function(r){if(r.stack&&r.stack.match(e))return this.parseV8OrIE(r);if(r.stack)return this.parseFFOrSafari(r);throw new Error("Cannot parse given Error object")},"ErrorStackParser$$parse"),extractLocation:d(function(r){if(r.indexOf(":")===-1)return[r];var o=/(.+?)(?::(\d+))?(?::(\d+))?$/,s=o.exec(r.replace(/[()]/g,""));return[s[1],s[2]||void 0,s[3]||void 0]},"ErrorStackParser$$extractLocation"),parseV8OrIE:d(function(r){var o=r.stack.split(`
`).filter(function(s){return!!s.match(e)},this);return o.map(function(s){s.indexOf("(eval ")>-1&&(s=s.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(,.*$)/g,""));var n=s.replace(/^\s+/,"").replace(/\(eval code/g,"(").replace(/^.*?\s+/,""),i=n.match(/ (\(.+\)$)/);n=i?n.replace(i[0],""):n;var f=this.extractLocation(i?i[1]:n),p=i&&n||void 0,u=["eval","<anonymous>"].indexOf(f[0])>-1?void 0:f[0];return new Z({functionName:p,fileName:u,lineNumber:f[1],columnNumber:f[2],source:s})},this)},"ErrorStackParser$$parseV8OrIE"),parseFFOrSafari:d(function(r){var o=r.stack.split(`
`).filter(function(s){return!s.match(t)},this);return o.map(function(s){if(s.indexOf(" > eval")>-1&&(s=s.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),s.indexOf("@")===-1&&s.indexOf(":")===-1)return new Z({functionName:s});var n=/((.*".+"[^@]*)?[^@]*)(?:@)/,i=s.match(n),f=i&&i[1]?i[1]:void 0,p=this.extractLocation(s.replace(n,""));return new Z({functionName:f,fileName:p[0],lineNumber:p[1],columnNumber:p[2],source:s})},this)},"ErrorStackParser$$parseFFOrSafari")}}l(ge,"le");d(ge,"ErrorStackParser");var st=new ge,it=st,A=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser,ye=A&&typeof module<"u"&&typeof module.exports<"u"&&typeof me<"u"&&typeof __dirname<"u",at=A&&!ye,vt=typeof globalThis.Bun<"u",ot=typeof Deno<"u",_e=!A&&!ot,lt=_e&&typeof window=="object"&&typeof document=="object"&&typeof document.createElement=="function"&&"sessionStorage"in window&&typeof importScripts!="function",ct=_e&&typeof importScripts=="function"&&typeof self=="object",kt=typeof navigator=="object"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome")==-1&&navigator.userAgent.indexOf("Safari")>-1,K=typeof read=="function"&&typeof load=="function",be,te,we,ue,re;async function ne(){if(!A||(be=(await import("node:url")).default,ue=await import("node:fs"),re=await import("node:fs/promises"),we=(await import("node:vm")).default,te=await import("node:path"),se=te.sep,typeof me<"u"))return;let e=ue,t=await import("node:crypto"),r=await import("ws"),o=await import("node:child_process"),s={fs:e,crypto:t,ws:r,child_process:o};globalThis.require=function(n){return s[n]}}l(ne,"C");d(ne,"initNodeModules");function ve(e,t){return te.resolve(t||".",e)}l(ve,"fe");d(ve,"node_resolvePath");function ke(e,t){return t===void 0&&(t=location),new URL(e,t).toString()}l(ke,"me");d(ke,"browser_resolvePath");var q;A?q=ve:K?q=d(e=>e,"resolvePath"):q=ke;var se;A||(se="/");function xe(e,t){return e.startsWith("file://")&&(e=e.slice(7)),e.includes("://")?{response:fetch(e)}:{binary:re.readFile(e).then(r=>new Uint8Array(r.buffer,r.byteOffset,r.byteLength))}}l(xe,"pe");d(xe,"node_getBinaryResponse");function Se(e,t){if(e.startsWith("file://")&&(e=e.slice(7)),e.includes("://"))throw new Error("Shell cannot fetch urls");return{binary:Promise.resolve(new Uint8Array(readbuffer(e)))}}l(Se,"ge");d(Se,"shell_getBinaryResponse");function Ee(e,t){let r=new URL(e,location);return{response:fetch(r,t?{integrity:t}:{})}}l(Ee,"ye");d(Ee,"browser_getBinaryResponse");var H;A?H=xe:K?H=Se:H=Ee;async function Ne(e,t){let{response:r,binary:o}=H(e,t);if(o)return o;let s=await r;if(!s.ok)throw new Error(`Failed to load '${e}': request failed.`);return new Uint8Array(await s.arrayBuffer())}l(Ne,"K");d(Ne,"loadBinaryFile");var W;if(lt)W=d(async e=>await import(e),"loadScript");else if(ct)W=d(async e=>{try{globalThis.importScripts(e)}catch(t){if(t instanceof TypeError)await import(e);else throw t}},"loadScript");else if(A)W=Fe;else if(K)W=load;else throw new Error("Cannot determine runtime environment");async function Fe(e){e.startsWith("file://")&&(e=e.slice(7)),e.includes("://")?we.runInThisContext(await(await fetch(e)).text()):await import(be.pathToFileURL(e).href)}l(Fe,"be");d(Fe,"nodeLoadScript");async function je(e){if(A){await ne();let t=await re.readFile(e,{encoding:"utf8"});return JSON.parse(t)}else if(K){let t=read(e);return JSON.parse(t)}else return await(await fetch(e)).json()}l(je,"G");d(je,"loadLockFile");async function Pe(){if(ye)return __dirname;let e;try{throw new Error}catch(o){e=o}let t=it.parse(e)[0].fileName;if(A&&!t.startsWith("file://")&&(t=`file://${t}`),at){let o=await import("node:path");return(await import("node:url")).fileURLToPath(o.dirname(t))}let r=t.lastIndexOf(se);if(r===-1)throw new Error("Could not extract indexURL path from pyodide module location");return t.slice(0,r)}l(Pe,"X");d(Pe,"calculateDirname");function Ae(e){return e.substring(0,e.lastIndexOf("/")+1)||globalThis.location?.toString()||"."}l(Ae,"Q");d(Ae,"calculateInstallBaseUrl");function Oe(e){let t=e.FS,r=e.FS.filesystems.MEMFS,o=e.PATH,s={DIR_MODE:16895,FILE_MODE:33279,mount:d(function(n){if(!n.opts.fileSystemHandle)throw new Error("opts.fileSystemHandle is required");return r.mount.apply(null,arguments)},"mount"),syncfs:d(async(n,i,f)=>{try{let p=s.getLocalSet(n),u=await s.getRemoteSet(n),m=i?u:p,c=i?p:u;await s.reconcile(n,m,c),f(null)}catch(p){f(p)}},"syncfs"),getLocalSet:d(n=>{let i=Object.create(null);function f(m){return m!=="."&&m!==".."}l(f,"c"),d(f,"isRealDir");function p(m){return c=>o.join2(m,c)}l(p,"l"),d(p,"toAbsolute");let u=t.readdir(n.mountpoint).filter(f).map(p(n.mountpoint));for(;u.length;){let m=u.pop(),c=t.stat(m);t.isDir(c.mode)&&u.push.apply(u,t.readdir(m).filter(f).map(p(m))),i[m]={timestamp:c.mtime,mode:c.mode}}return{type:"local",entries:i}},"getLocalSet"),getRemoteSet:d(async n=>{let i=Object.create(null),f=await dt(n.opts.fileSystemHandle);for(let[p,u]of f)p!=="."&&(i[o.join2(n.mountpoint,p)]={timestamp:u.kind==="file"?new Date((await u.getFile()).lastModified):new Date,mode:u.kind==="file"?s.FILE_MODE:s.DIR_MODE});return{type:"remote",entries:i,handles:f}},"getRemoteSet"),loadLocalEntry:d(n=>{let i=t.lookupPath(n).node,f=t.stat(n);if(t.isDir(f.mode))return{timestamp:f.mtime,mode:f.mode};if(t.isFile(f.mode))return i.contents=r.getFileDataAsTypedArray(i),{timestamp:f.mtime,mode:f.mode,contents:i.contents};throw new Error("node type not supported")},"loadLocalEntry"),storeLocalEntry:d((n,i)=>{if(t.isDir(i.mode))t.mkdirTree(n,i.mode);else if(t.isFile(i.mode))t.writeFile(n,i.contents,{canOwn:!0});else throw new Error("node type not supported");t.chmod(n,i.mode),t.utime(n,i.timestamp,i.timestamp)},"storeLocalEntry"),removeLocalEntry:d(n=>{var i=t.stat(n);t.isDir(i.mode)?t.rmdir(n):t.isFile(i.mode)&&t.unlink(n)},"removeLocalEntry"),loadRemoteEntry:d(async n=>{if(n.kind==="file"){let i=await n.getFile();return{contents:new Uint8Array(await i.arrayBuffer()),mode:s.FILE_MODE,timestamp:new Date(i.lastModified)}}else{if(n.kind==="directory")return{mode:s.DIR_MODE,timestamp:new Date};throw new Error("unknown kind: "+n.kind)}},"loadRemoteEntry"),storeRemoteEntry:d(async(n,i,f)=>{let p=n.get(o.dirname(i)),u=t.isFile(f.mode)?await p.getFileHandle(o.basename(i),{create:!0}):await p.getDirectoryHandle(o.basename(i),{create:!0});if(u.kind==="file"){let m=await u.createWritable();await m.write(f.contents),await m.close()}n.set(i,u)},"storeRemoteEntry"),removeRemoteEntry:d(async(n,i)=>{await n.get(o.dirname(i)).removeEntry(o.basename(i)),n.delete(i)},"removeRemoteEntry"),reconcile:d(async(n,i,f)=>{let p=0,u=[];Object.keys(i.entries).forEach(function(g){let _=i.entries[g],w=f.entries[g];(!w||t.isFile(_.mode)&&_.timestamp.getTime()>w.timestamp.getTime())&&(u.push(g),p++)}),u.sort();let m=[];if(Object.keys(f.entries).forEach(function(g){i.entries[g]||(m.push(g),p++)}),m.sort().reverse(),!p)return;let c=i.type==="remote"?i.handles:f.handles;for(let g of u){let _=o.normalize(g.replace(n.mountpoint,"/")).substring(1);if(f.type==="local"){let w=c.get(_),F=await s.loadRemoteEntry(w);s.storeLocalEntry(g,F)}else{let w=s.loadLocalEntry(g);await s.storeRemoteEntry(c,_,w)}}for(let g of m)if(f.type==="local")s.removeLocalEntry(g);else{let _=o.normalize(g.replace(n.mountpoint,"/")).substring(1);await s.removeRemoteEntry(c,_)}},"reconcile")};e.FS.filesystems.NATIVEFS_ASYNC=s}l(Oe,"Z");d(Oe,"initializeNativeFS");var dt=d(async e=>{let t=[];async function r(s){for await(let n of s.values())t.push(n),n.kind==="directory"&&await r(n)}l(r,"r"),d(r,"collect"),await r(e);let o=new Map;o.set(".",e);for(let s of t){let n=(await e.resolve(s)).join("/");o.set(n,s)}return o},"getFsHandles"),ft=tt("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECByECD2NyZWF0ZV9zZW50aW5lbAAAC2lzX3NlbnRpbmVsAAEKEwIHAPsBAPsbCwkAIAD7GvsUAAs="),pt=(async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&typeof navigator.maxTouchPoints<"u"&&navigator.maxTouchPoints>1)))try{let e=await WebAssembly.compile(ft);return await WebAssembly.instantiate(e)}catch(e){if(e instanceof WebAssembly.CompileError)return;throw e}})();async function Ie(){let e=await pt;if(e)return e.exports;let t=Symbol("error marker");return{create_sentinel:d(()=>t,"create_sentinel"),is_sentinel:d(r=>r===t,"is_sentinel")}}l(Ie,"te");d(Ie,"getSentinelImport");function $e(e){let t={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:Ce(e),print:e.stdout,printErr:e.stderr,onExit(r){t.exitCode=r},thisProgram:e._sysExecutable,arguments:e.args,API:{config:e},locateFile:d(r=>e.indexURL+r,"locateFile"),instantiateWasm:Le(e.indexURL)};return t}l($e,"ne");d($e,"createSettings");function Re(e){return function(t){let r="/";try{t.FS.mkdirTree(e)}catch(o){console.error(`Error occurred while making a home directory '${e}':`),console.error(o),console.error(`Using '${r}' for a home directory instead`),e=r}t.FS.chdir(e)}}l(Re,"we");d(Re,"createHomeDirectory");function Te(e){return function(t){Object.assign(t.ENV,e)}}l(Te,"Ee");d(Te,"setEnvironment");function Be(e){return e?[async t=>{t.addRunDependency("fsInitHook");try{await e(t.FS,{sitePackages:t.API.sitePackages})}finally{t.removeRunDependency("fsInitHook")}}]:[]}l(Be,"Pe");d(Be,"callFsInitHook");function De(e){let t=e.HEAPU32[e._Py_Version>>>2],r=t>>>24&255,o=t>>>16&255,s=t>>>8&255;return[r,o,s]}l(De,"ke");d(De,"computeVersionTuple");function Me(e){let t=Ne(e);return async r=>{r.API.pyVersionTuple=De(r);let[o,s]=r.API.pyVersionTuple;r.FS.mkdirTree("/lib"),r.API.sitePackages=`/lib/python${o}.${s}/site-packages`,r.FS.mkdirTree(r.API.sitePackages),r.addRunDependency("install-stdlib");try{let n=await t;r.FS.writeFile(`/lib/python${o}${s}.zip`,n)}catch(n){console.error("Error occurred while installing the standard library:"),console.error(n)}finally{r.removeRunDependency("install-stdlib")}}}l(Me,"Ie");d(Me,"installStdlib");function Ce(e){let t;return e.stdLibURL!=null?t=e.stdLibURL:t=e.indexURL+"python_stdlib.zip",[Me(t),Re(e.env.HOME),Te(e.env),Oe,...Be(e.fsInit)]}l(Ce,"Ne");d(Ce,"getFileSystemInitializationFuncs");function Le(e){if(typeof WasmOffsetConverter<"u")return;let{binary:t,response:r}=H(e+"pyodide.asm.wasm"),o=Ie();return function(s,n){return(async function(){s.sentinel=await o;try{let i;r?i=await WebAssembly.instantiateStreaming(r,s):i=await WebAssembly.instantiate(await t,s);let{instance:f,module:p}=i;n(f,p)}catch(i){console.warn("wasm instantiation failed!"),console.warn(i)}})(),{}}}l(Le,"Fe");d(Le,"getInstantiateWasmFunc");var ut="0.28.3";function G(e){return e===void 0||e.endsWith("/")?e:e+"/"}l(G,"_");d(G,"withTrailingSlash");var ee=ut;async function ie(e={}){if(e.lockFileContents&&e.lockFileURL)throw new Error("Can't pass both lockFileContents and lockFileURL");await ne();let t=e.indexURL||await Pe();t=G(q(t));let r=e;if(r.packageBaseUrl=G(r.packageBaseUrl),r.cdnUrl=G(r.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v${ee}/full/`),!e.lockFileContents){let c=e.lockFileURL??t+"pyodide-lock.json";r.lockFileContents=je(c),r.packageBaseUrl??=Ae(c)}r.indexURL=t,r.packageCacheDir&&(r.packageCacheDir=G(q(r.packageCacheDir)));let o={fullStdLib:!1,jsglobals:globalThis,stdin:globalThis.prompt?globalThis.prompt:void 0,args:[],env:{},packages:[],packageCacheDir:r.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:"cc7a4bb4c6f36f12592fef0934292b5fddb0e313ca5dc4a5a9519bb7610c67e3"},s=Object.assign(o,r);s.env.HOME??="/home/pyodide",s.env.PYTHONINSPECT??="1";let n=$e(s),i=n.API;if(i.lockFilePromise=Promise.resolve(r.lockFileContents),typeof _createPyodideModule!="function"){let c=`${s.indexURL}pyodide.asm.js`;await W(c)}let f;if(e._loadSnapshot){let c=await e._loadSnapshot;ArrayBuffer.isView(c)?f=c:f=new Uint8Array(c),n.noInitialRun=!0,n.INITIAL_MEMORY=f.length}let p=await _createPyodideModule(n);if(n.exitCode!==void 0)throw new p.ExitStatus(n.exitCode);if(e.pyproxyToStringRepr&&i.setPyProxyToStringMethod(!0),e.convertNullToNone&&i.setCompatNullToNone(!0),i.version!==ee&&s.checkAPIVersion)throw new Error(`Pyodide version does not match: '${ee}' <==> '${i.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);p.locateFile=c=>{throw c.endsWith(".so")?new Error(`Failed to find dynamic library "${c}"`):new Error(`Unexpected call to locateFile("${c}")`)};let u;f&&(u=i.restoreSnapshot(f));let m=i.finalizeBootstrap(u,e._snapshotDeserializer);return i.sys.path.insert(0,""),i._pyodide.set_excepthook(),await i.packageIndexReady,i.initializeStreams(s.stdin,s.stdout,s.stderr),m}l(ie,"at");d(ie,"loadPyodide");var ze=String.raw`
import sys, os, builtins, linecache, traceback, importlib.util, json as _json
# a worker has no page to draw on (§3.7): Matplotlib's agg backend, set before any learner cell can import it
os.environ['MPLBACKEND'] = 'agg'
# review nb3_r1 S2: plt.show() under agg warns "FigureCanvasAgg is non-interactive"; the notebook shows every open
# figure after the cell, as Jupyter's inline backend does, so show() is quiet here
import warnings as _warnings
_warnings.filterwarnings('ignore', message='FigureCanvasAgg is non-interactive')
# the probe machinery's own modules (§3.8 "Isolation"), captured here before any learner cell, from the standard
# library: a learner's json.py, copy.py or random.py in the working folder cannot change a probe's reply
import io as _io, contextlib as _contextlib, copy as _copy, base64 as _base64, math as _math, random as _random
# the worker's own routes (kernelWorker.ts): mask() defers a Stop's SIGINT until the worker takes control back
import _evn_nb_host as _host
from pyodide.code import eval_code_async as _eval_code_async, find_imports as _find_imports

import sysconfig as _sysconfig
# where loadPackage installs the notebook packages (NB-3; sysconfig gives '//lib/...', which normpath keeps): their modules
# are never dropped after a probe (_restore)
_SITE = tuple(sorted(set('/' + os.path.normpath(p).lstrip('/') + '/' for p in (_sysconfig.get_paths()['purelib'], _sysconfig.get_paths()['platlib']))))


def _package_module(m):
    f = getattr(m, '__file__', None)
    return isinstance(f, str) and f.startswith(_SITE)


# the interpreter's own library (review nb3_r2 R2-S1): the standard library (its zip, lib/python3.13, lib-dynload) and
# site-packages, read here before any learner cell can change sys.path
_LIB = tuple(sorted(set('/' + os.path.normpath(p).lstrip('/') + '/' for p in
                        [_sysconfig.get_paths()[k] for k in ('stdlib', 'platstdlib', 'purelib', 'platlib')]
                        + [q for q in sys.path if q.startswith('/lib/')])))


def _library_module(m):
    """a module of the interpreter's own library: built in, frozen, or read from under _LIB (a namespace package: every
    folder of it under _LIB). Anything else - a learner's file anywhere, a module made in a cell, a namespace package in
    the learner's folders - is not"""
    spec = getattr(m, '__spec__', None)
    origin = getattr(spec, 'origin', None) if spec is not None else getattr(m, '__file__', None)
    if origin in ('built-in', 'frozen'):
        return True
    if isinstance(origin, str):
        return origin.startswith(_LIB)
    locs = list(getattr(spec, 'submodule_search_locations', None) or []) if spec is not None else []
    return bool(locs) and all(isinstance(q, str) and q.startswith(_LIB) for q in locs)


# ---- figures (§3.7, NB-3) ------------------------------------------------------------------------------------------
_FIG_ROWS = 2000           # a series' rows in the data table; a longer one is stated as cut


def _num(v):
    """a value for the alt text: 4 significant figures"""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if f != f:
        return 'nan'
    if _math.isinf(f):
        return 'infinity' if f > 0 else 'minus infinity'
    return '{:.4g}'.format(f)


def _cell(v):
    """a value for the data table: exact (repr), whole numbers without a point, nan as an empty cell"""
    try:
        f = float(v)
    except (TypeError, ValueError):
        t = str(v)
        return '"' + t.replace('"', '""') + '"' if (',' in t or '"' in t or '\n' in t) else t
    if f != f:
        return ''
    if f.is_integer() and abs(f) < 1e15:
        return str(int(f))
    return repr(f)


def _py(o):
    """review nb3_r1 B1: every value bound for the reply as a plain Python value - a NumPy scalar (int32 heights on
    wasm32, bool, float32) as its Python number, a tuple or array as a list, nan and infinity as None (the client's
    JSON.parse refuses NaN)"""
    if o is None or isinstance(o, (str, bool)):
        return o
    if isinstance(o, dict):
        return {str(k): _py(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_py(v) for v in o]
    item = getattr(o, 'item', None)
    if callable(item) and getattr(o, 'ndim', 1) == 0:
        o = item()
        if isinstance(o, (str, bool)) or o is None:
            return o
    if hasattr(o, 'tolist'):
        return _py(o.tolist())
    if isinstance(o, int):
        return int(o)
    try:
        f = float(o)
    except (TypeError, ValueError):
        return str(o)
    return f if _math.isfinite(f) else None


def _range(vals):
    """[min, max] of the finite values (NumPy's nanmin / nanmax over an array: review nb3_r1 S4), None when none"""
    import numpy as np
    try:
        a = np.asarray(vals, dtype=float).ravel()
    except (TypeError, ValueError):
        a = np.asarray([v for v in vals if isinstance(v, (int, float))], dtype=float)
    a = a[np.isfinite(a)]
    return [float(a.min()), float(a.max())] if a.size else None


def _date(v):
    """a Matplotlib date number as the date it is (review nb3_r2 R2-S3): a whole day as YYYY-MM-DD, else with the time"""
    from matplotlib.dates import num2date
    f = float(v)
    if not _math.isfinite(f):
        return _num(f)
    d = num2date(f)
    return d.strftime('%Y-%m-%d') if f.is_integer() else d.strftime('%Y-%m-%d %H:%M:%S')


def _is_date_axis(axis):
    """True when the axis' units converter is Matplotlib's date converter (datetime, date, datetime64 data)"""
    conv = axis.get_converter() if hasattr(axis, 'get_converter') else getattr(axis, 'converter', None)
    return conv is not None and type(conv).__module__ == 'matplotlib.dates'


def _span(r, date=False):
    f = _date if date else _num
    return (f(r[0]) + ' to ' + f(r[1])) if r else 'no values'


def _label(text):
    t = str(text or '')
    return None if not t or t.startswith('_') else t


def _join_ranges(rs):
    rs = [r for r in rs if r]
    return [min(r[0] for r in rs), max(r[1] for r in rs)] if rs else None


def _xy_rows(xy):
    """the first rows of an (n, 2) array, as lists (review nb3_r1 S4: never all of a long series)"""
    return xy[:_FIG_ROWS + 1].tolist()


def _grid_rows(arr):
    """the first cells of a 2-D array as [row, column, value] (review nb3_r1 S4: never the whole grid)"""
    w = int(arr.shape[1])
    flat = arr.ravel()
    return [[i // w, i % w, flat[i]] for i in range(min(flat.size, _FIG_ROWS + 1))]


def _describe_axes(ax):
    """the axes' artists: [{kind, label, n, x, y, ...}], each with its table rows (_cols, _rows), and the names of the
    parts this description does not cover"""
    import numpy as np
    import matplotlib.patches as mpatches
    from matplotlib.collections import PathCollection, PolyCollection, QuadMesh
    from matplotlib.container import BarContainer
    arts, other, in_bars = [], [], set()
    for ln in ax.get_lines():
        if not ln.get_visible():
            continue
        xy = np.asarray(ln.get_xydata(), dtype=float).reshape(-1, 2)
        arts.append({'kind': 'line', 'label': _label(ln.get_label()), 'n': int(len(xy)),
                     'x': _range(xy[:, 0]), 'y': _range(xy[:, 1]), '_cols': ('x', 'y'), '_rows': _xy_rows(xy), '_total': len(xy)})
    for c in ax.containers:
        if not isinstance(c, BarContainer) or not len(c.patches):
            continue
        in_bars.update(id(p) for p in c.patches)
        horiz = getattr(c, 'orientation', 'vertical') == 'horizontal'
        ps = list(c.patches)
        start = [float(p.get_y() if horiz else p.get_x()) for p in ps]
        width = [float(p.get_height() if horiz else p.get_width()) for p in ps]
        value = [float(p.get_width() if horiz else p.get_height()) for p in ps]
        edges_meet = len(ps) > 1 and all(abs(start[j] + width[j] - start[j + 1]) <= 1e-9 * max(1.0, abs(start[j + 1]))
                                         for j in range(len(ps) - 1))
        # review nb3_r2 R2-S2: the tallest among the finite heights (max() with a nan key keeps the first index); the
        # bars whose height is nan or infinite are named apart
        finite = [j for j in range(len(ps)) if _math.isfinite(value[j])]
        top = max(finite, key=lambda j: value[j]) if finite else None
        # hist(label=...) labels the bars, not their container
        a = {'label': _label(c.get_label()) or _label(ps[0].get_label()), 'n': len(ps), 'values': _range(value)}
        if edges_meet:
            a.update({'kind': 'histogram', 'bins': len(ps), 'range': [start[0], start[-1] + width[-1]],
                      'tallest': [start[top], start[top] + width[top], value[top]] if top is not None else None,
                      '_cols': ('bin_start', 'bin_end', 'count'),
                      '_rows': [[start[j], start[j] + width[j], value[j]] for j in range(len(ps))]})
        else:
            mid = [start[j] + width[j] / 2 for j in range(len(ps))]
            a.update({'kind': 'bars', 'tallest': [mid[top], value[top]] if top is not None else None, '_cols': ('y' if horiz else 'x', 'value'),
                      '_rows': [[mid[j], value[j]] for j in range(len(ps))]})
            # a categorical axis (bar(['a', 'b'], ...)): its units' mapping (Matplotlib's category UnitData) names the bars
            mapping = getattr((ax.yaxis if horiz else ax.xaxis).get_units(), '_mapping', None) or {}
            names = {round(float(v), 9): str(k) for k, v in dict(mapping).items()}
            cats = [names.get(round(m, 9)) for m in mid]
            if names and all(cats):
                a['categories'] = cats
                a['_cols'] = ('category', 'value')
                a['_rows'] = [[cats[j], value[j]] for j in range(len(ps))]
                a['tallest'] = [cats[top], value[top]] if top is not None else None
        a['_total'] = len(ps)
        a['horizontal'] = horiz
        bad = [j for j in range(len(ps)) if j not in finite]
        if bad:
            where_ = (a.get('categories') or [None] * len(ps)) if not edges_meet else [None] * len(ps)
            pos_ = [start[j] + width[j] / 2 for j in range(len(ps))]
            a['not_finite'] = [[where_[j] if where_[j] is not None else pos_[j], 'nan' if value[j] != value[j] else ('infinity' if value[j] > 0 else 'minus infinity')]
                               for j in bad]
        pos = _range([start[0], start[-1] + width[-1]])
        vals = _join_ranges([[0.0, 0.0], a['values']])
        a['x'], a['y'] = (vals, pos) if horiz else (pos, vals)
        arts.append(a)
    for p in ax.patches:
        if id(p) in in_bars or not p.get_visible():
            continue
        if isinstance(p, mpatches.Wedge):
            continue                                   # a pie: below, all its wedges together
        if isinstance(p, mpatches.Polygon):
            xy = np.asarray(p.get_xy(), dtype=float).reshape(-1, 2)
            arts.append({'kind': 'area' if p.get_fill() else 'outline', 'label': _label(p.get_label()), 'n': int(len(xy)),
                         'x': _range(xy[:, 0]), 'y': _range(xy[:, 1]), '_cols': ('x', 'y'), '_rows': _xy_rows(xy), '_total': len(xy)})
        else:
            other.append(type(p).__name__)
    wedges = [p for p in ax.patches if isinstance(p, mpatches.Wedge) and p.get_visible()]
    if wedges:
        frac = [(float(w.theta2) - float(w.theta1)) / 360.0 for w in wedges]
        names = [_label(w.get_label()) or 'wedge %d' % (i + 1) for i, w in enumerate(wedges)]
        top = max(range(len(wedges)), key=lambda j: frac[j])
        arts.append({'kind': 'pie', 'label': None, 'n': len(wedges), 'largest': [names[top], frac[top]],
                     '_cols': ('wedge', 'fraction'), '_rows': [[names[j], frac[j]] for j in range(len(wedges))], '_total': len(wedges)})
    for coll in ax.collections:
        if not coll.get_visible():
            continue
        if isinstance(coll, QuadMesh):
            arr = np.ma.filled(np.ma.asarray(coll.get_array(), dtype=float), np.nan)
            coords = np.asarray(coll.get_coordinates(), dtype=float)
            h, w = (int(coords.shape[0]) - 1, int(coords.shape[1]) - 1) if coords.ndim == 3 else (1, int(arr.size))
            grid = arr.reshape(h, w) if arr.size == h * w else arr.reshape(1, -1)
            arts.append({'kind': 'mesh', 'label': _label(coll.get_label()), 'size': [w, h], 'n': w * h,
                         'cmap': coll.get_cmap().name, 'values': _range(grid),
                         'x': _range(coords[..., 0]) if coords.ndim == 3 else None, 'y': _range(coords[..., 1]) if coords.ndim == 3 else None,
                         '_cols': ('row', 'column', 'value'), '_rows': _grid_rows(grid), '_total': int(grid.size)})
        elif isinstance(coll, PathCollection):
            off = np.ma.filled(np.ma.asarray(coll.get_offsets(), dtype=float), np.nan).reshape(-1, 2)
            arts.append({'kind': 'scatter', 'label': _label(coll.get_label()), 'n': int(len(off)),
                         'x': _range(off[:, 0]), 'y': _range(off[:, 1]), '_cols': ('x', 'y'), '_rows': _xy_rows(off), '_total': len(off)})
        elif isinstance(coll, PolyCollection) and len(coll.get_paths()) == 1:
            xy = np.asarray(coll.get_paths()[0].vertices, dtype=float).reshape(-1, 2)
            arts.append({'kind': 'area', 'label': _label(coll.get_label()), 'n': int(len(xy)),
                         'x': _range(xy[:, 0]), 'y': _range(xy[:, 1]), '_cols': ('x', 'y'), '_rows': _xy_rows(xy), '_total': len(xy)})
        else:
            other.append(type(coll).__name__)
    for im in ax.get_images():
        arr = np.ma.filled(np.ma.asarray(im.get_array(), dtype=float), np.nan)
        h = int(arr.shape[0])
        w = int(arr.shape[1]) if arr.ndim > 1 else 1
        a = {'kind': 'image', 'label': _label(im.get_label()), 'size': [w, h], 'n': w * h}
        if arr.ndim == 2:
            a['cmap'] = im.get_cmap().name
            a['values'] = _range(arr)
            a['_cols'] = ('row', 'column', 'value')
            a['_rows'] = _grid_rows(arr)
            a['_total'] = w * h
        else:
            # review nb3_r1 N2: a colour image's pixels are not given as a table, and the table says so
            a['cmap'] = None
            a['_note'] = 'a colour image: its pixels are not given as a table'
        arts.append(a)
    return arts, other


_KIND = {'line': 'Line plot', 'histogram': 'Histogram', 'bars': 'Bar chart', 'scatter': 'Scatter plot', 'image': 'Image',
         'pie': 'Pie chart', 'mesh': 'Colour mesh', 'area': 'Filled area', 'outline': 'Outline'}


def _axes_sentence(ax, arts, texts, other, xd=False, yd=False):
    kinds = sorted(set(a['kind'] for a in arts))
    if len(kinds) == 1:
        head = _KIND[kinds[0]]
    elif kinds:
        head = 'Plot'
    elif other or texts:
        # review nb3_r1 S3: never "Empty" for a figure that holds something
        head = 'A figure'
    else:
        head = 'Empty plot'
    title = ax.get_title()
    if title:
        head += " '" + title + "'"
    parts = [head]
    for axis, scale, lab in (('x', ax.get_xscale(), ax.get_xlabel()), ('y', ax.get_yscale(), ax.get_ylabel())):
        r = _join_ranges([a.get(axis) for a in arts if a['kind'] not in ('image', 'pie')])
        if r or lab:
            parts.append(axis + ': ' + (lab + ' ' if lab else '') + _span(r, xd if axis == 'x' else yd)
                         + (' (' + scale + ' scale)' if scale != 'linear' else ''))
    lines = [a for a in arts if a['kind'] == 'line']
    if lines:
        names = [(a['label'] or 'line %d' % (i + 1)) + (' (x ' + _span(a['x'], xd) + ', y ' + _span(a['y'], yd) + ')' if len(lines) > 1 else '')
                 for i, a in enumerate(lines)]
        parts.append('%d line%s: %s' % (len(lines), '' if len(lines) == 1 else 's', ', '.join(names)))
    for a in arts:
        name = (" '" + a['label'] + "'") if a['label'] else ''
        pd = yd if a.get('horizontal') else xd          # a bar set's positions lie on this axis
        nf = ''
        if a.get('not_finite'):
            nf = '; height not finite: ' + ', '.join((("'" + w + "'") if isinstance(w, str) else (_date(w) if pd else _num(w))) + ' (' + v + ')'
                                                      for w, v in a['not_finite'])
        if a['kind'] == 'histogram':
            t = a['tallest']
            tall = (', tallest bin %s (%s)' % (_span(t[:2], pd), _num(t[2]))) if t else ', no finite count'
            parts.append('histogram%s: %d bins from %s%s%s' % (name, a['bins'], _span(a['range'], pd), tall, nf))
        elif a['kind'] == 'bars':
            t = a['tallest']
            cats = (': ' + ', '.join(a['categories'])) if a.get('categories') else ''
            if t:
                at = ("'" + t[0] + "'") if isinstance(t[0], str) else (_date(t[0]) if pd else _num(t[0]))
                tall = ', tallest at %s (%s)' % (at, _num(t[1]))
            else:
                tall = ', no finite height'
            parts.append('%d bars%s%s, values %s%s%s' % (a['n'], name, cats, _span(a['values']), tall, nf))
        elif a['kind'] == 'scatter':
            parts.append('scatter%s: %d points, x %s, y %s' % (name, a['n'], _span(a['x'], xd), _span(a['y'], yd)))
        elif a['kind'] in ('area', 'outline'):
            parts.append('%s%s: x %s, y %s' % ('filled area' if a['kind'] == 'area' else 'outline', name, _span(a['x'], xd), _span(a['y'], yd)))
        elif a['kind'] == 'pie':
            parts.append('pie: %d wedges, largest %s (%s %%)' % (a['n'], a['largest'][0], _num(100 * a['largest'][1])))
        elif a['kind'] == 'mesh':
            parts.append('colour mesh%s %d x %d cells, colour map %s, values %s' % (name, a['size'][0], a['size'][1], a['cmap'], _span(a['values'])))
        elif a['kind'] == 'image':
            parts.append('image%s %d x %d pixels' % (name, a['size'][0], a['size'][1])
                         + (', colour map ' + a['cmap'] + ', values ' + _span(a['values']) if a['cmap'] else ', colour'))
    if other:
        counts = {}
        for o in other:
            counts[o] = counts.get(o, 0) + 1
        parts.append('and parts this description does not cover: ' + ', '.join('%d %s' % (n, k) for k, n in sorted(counts.items())))
    if texts:
        parts.append('text: ' + ', '.join("'" + t + "'" for t in texts))
    return '; '.join(parts)


def _describe_figure(fig):
    """(alt text, structure, data table) of a figure (§3.7); structure is plain Python values (_py)"""
    axes = [ax for ax in fig.get_axes() if ax.get_visible() and not hasattr(ax, '_colorbar')]
    sentences, structure, sections = [], [], []
    for i, ax in enumerate(axes):
        where = ('subplot %d of %d' % (i + 1, len(axes))) if len(axes) > 1 else 'the plot'
        try:
            arts, other = _describe_axes(ax)
        except Exception as e:
            sentences.append(where + ' could not be described (' + type(e).__name__ + ')')
            continue
        texts = [t.get_text() for t in ax.texts if t.get_visible() and t.get_text().strip()]
        xd, yd = _is_date_axis(ax.xaxis), _is_date_axis(ax.yaxis)
        s = _axes_sentence(ax, arts, texts, other, xd, yd)
        sentences.append(('Subplot %d of %d: ' % (i + 1, len(axes)) + s) if len(axes) > 1 else s)
        structure.append({'title': ax.get_title(), 'xlabel': ax.get_xlabel(), 'ylabel': ax.get_ylabel(),
                          'xscale': ax.get_xscale(), 'yscale': ax.get_yscale(), 'texts': texts, 'other': other,
                          'xdates': xd, 'ydates': yd,
                          'artists': [{k: v for k, v in a.items() if not k.startswith('_')} for a in arts]})
        for j, a in enumerate(arts):
            name = (" '" + a['label'] + "'") if a['label'] else ' %d' % (j + 1)
            if a.get('_note'):
                sections.append('# %s, %s%s: %s' % (where, a['kind'], name, a['_note']))
                continue
            rows = a.get('_rows') or []
            total = a.get('_total', len(rows))
            head = '# %s, %s%s: %d row%s' % (where, a['kind'], name, total, '' if total == 1 else 's')
            # R2-S3: a column on a date axis is written as dates
            hz = a.get('horizontal')
            on_x = {'x', 'bin_start', 'bin_end'} if not hz else {'value'}
            on_y = {'y'} if not hz else {'y', 'bin_start', 'bin_end'}
            dcols = [(xd and c in on_x and a['kind'] not in ('image', 'mesh', 'pie')) or (yd and c in on_y and a['kind'] not in ('image', 'mesh', 'pie'))
                     for c in a['_cols']]
            body = [','.join(a['_cols'])] + [','.join(_date(v) if dcols[i] else _cell(v) for i, v in enumerate(r)) for r in rows[:_FIG_ROWS]]
            if total > _FIG_ROWS:
                body.append('# cut: the first %d of %d rows' % (_FIG_ROWS, total))
            sections.append('\n'.join([head] + body))
    if not axes:
        sentences.append('An empty figure')
    return '. '.join(sentences), _py({'axes': structure}), '\n\n'.join(sections) + ('\n' if sections else '')


def _render_figures():
    """every open figure as one output (§3.7), then closed; [] when Matplotlib was never imported. A figure whose
    description cannot be made or serialised is still shown, with a plain alt text and no table (review nb3_r1 B1: the
    figure never fails the cell)"""
    plt = sys.modules.get('matplotlib.pyplot')
    if plt is None:
        return []
    nums = plt.get_fignums()
    if not nums:
        return []
    nbm = sys.modules.get('evn_nb')
    st = getattr(nbm, '_STATE', None) if nbm is not None else None
    fmt = st.get('format', 'png') if isinstance(st, dict) else 'png'
    out = []
    for num in nums:
        fig = plt.figure(num)
        try:
            try:
                alt, structure, table = _describe_figure(fig)
                _json.dumps({'alt': alt, 'table': table, 'structure': structure}, allow_nan=False)
            except Exception as e:
                alt, structure, table = 'A figure (its description could not be made: ' + type(e).__name__ + ')', {'axes': []}, ''
            buf = _io.BytesIO()
            if fmt == 'svg':
                fig.savefig(buf, format='svg', bbox_inches='tight')
                mime, data = 'image/svg+xml', buf.getvalue().decode('utf-8')
            else:
                fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
                mime, data = 'image/png', _base64.b64encode(buf.getvalue()).decode('ascii')
            try:
                fig._evn_table = table
            except Exception:
                pass
            if isinstance(st, dict):
                st['last'] = table
            out.append({'mime': mime, 'data': data, 'alt': alt, 'table': table, 'structure': structure})
        finally:
            plt.close(fig)
    return out


class _EvnKernel:
    def __init__(self, cfg):
        self.workdir = cfg['workdir']
        self.roots = tuple(cfg['roots'])
        self.unvendored = frozenset(cfg['unvendored'])
        self.packages = dict(cfg['packages'])       # import name -> package name (the NB packages this host has)
        self.missing = frozenset(cfg['missing'])     # NB packages this host lacks (the desktop before NB-6's install)
        # NB-6: the desktop's line names what is missing and the install prompt; {name} is the import
        self.missing_line = cfg.get('missing_line') or '{name}: the notebook packages are not installed here (the browser IDE has them).'
        self.install = None
        self.has = cfg['has']
        os.makedirs(self.workdir, exist_ok=True)
        os.chdir(self.workdir)
        self.ns = {'__name__': '__main__', '__builtins__': builtins}
        builtins.input = self._input
        for name, src in cfg['modules'].items():
            self._preload(name, src)

    @staticmethod
    def _input(prompt=''):
        raise RuntimeError("input() does not work in the notebook: put the value in the cell instead, for example name = 'Ada'")

    @staticmethod
    def _preload(name, src):
        import types
        m = types.ModuleType(name)
        m.__file__ = '<' + name + '>'
        exec(compile(src, '<' + name + '>', 'exec'), m.__dict__)
        sys.modules[name] = m

    def _learner_path(self, p):
        return isinstance(p, str) and p.startswith(self.roots)

    def _learner_frame(self, fn):
        return fn.startswith('<cell') or self._learner_path(fn)

    def check_imports(self, code):
        """None, or the plain line that stops the cell; the packages to load go into self.to_load"""
        self.to_load = set()
        self.install = None
        seen = set()
        return self._scan(code, seen)

    def _scan(self, code, seen):
        try:
            names = _find_imports(code)
        except SyntaxError:
            return None                              # the run shows Python's own SyntaxError
        for full in names:
            top = full.split('.')[0]
            if not top or top in seen:
                continue
            seen.add(top)
            if top in sys.modules:
                continue
            try:
                spec = importlib.util.find_spec(top)
            except (ImportError, ValueError):
                spec = None
            origin = getattr(spec, 'origin', None) if spec else None
            if origin and self._learner_path(origin):
                try:
                    with open(origin, encoding='utf-8') as f:
                        src = f.read()
                except (OSError, UnicodeDecodeError):
                    continue
                stop = self._scan(src, seen)
                if stop:
                    return stop
                continue
            if top in self.unvendored:
                return top + ' arrives with the notebook packages'
            if spec is not None:
                continue
            if top in self.packages:
                self.to_load.add(self.packages[top])
                continue
            if top in self.missing:
                self.install = top
                return self.missing_line.replace('{name}', top)
            return top + ' is not in the offline notebook (' + self.has + ').'
        return None

    # review nb2_r2 R2-S2: the client stores a Stop's SIGINT again every 100 ms until the cell ends (nb2_r1 S2), so one
    # can land in the kernel's own bookkeeping after a cell or probe. Before that bookkeeping the kernel calls
    # _host.mask() in a guard (while True: try: _host.mask(); break; except KeyboardInterrupt: continue): from then
    # until the worker takes control back (kernelWorker.ts unmask) the interpreter reads a blank signal buffer, so no
    # new SIGINT is seen. The call is a JS function, not a Python one, so no signal check comes before it; a SIGINT
    # taken in just before is raised at the check after the call, inside the guard, and the guard calls it again

    def format_error(self, e):
        frames = [f for f in traceback.extract_tb(e.__traceback__) if self._learner_frame(f.filename)]
        text = ''
        if frames:
            text = 'Traceback (most recent call last):\n' + ''.join(traceback.format_list(frames))
        text += ''.join(traceback.format_exception_only(type(e), e))
        return {'name': type(e).__name__, 'message': str(e), 'stack': text.rstrip('\n')}

    async def run(self, code, label):
        linecache.cache[label] = (len(code), None, code.splitlines(True), label)
        stop = self.check_imports(code)
        if stop:
            return _json.dumps({'ok': False, 'refused': stop, 'install': self.install})
        if self.to_load:
            import pyodide_js
            await pyodide_js.loadPackage(sorted(self.to_load))
        error, text, figures = None, None, []
        try:
            value = await _eval_code_async(code, self.ns, filename=label)
            if value is not None:
                text = repr(value)                 # the learner's __repr__: still stoppable
        except BaseException as e:
            error = e
        # the figures the cell left open (§3.7), drawn even when it raised, as Jupyter does; a drawing error is the
        # cell's error when it had none
        try:
            figures = _render_figures()
        except BaseException as e:
            if error is None:
                error = e
        # the cell has ended: the rest is the kernel's own, with the SIGINT deferred (R2-S2)
        while True:
            try:
                _host.mask()
                break
            except KeyboardInterrupt:
                continue
        for s in (sys.stdout, sys.stderr):
            try:
                s.flush()
            except BaseException:
                pass
        if error is not None:
            return _json.dumps({'ok': False, 'error': self.format_error(error), 'figures': figures})
        return _json.dumps({'ok': True, 'value': text, 'figures': figures})

    # ---- the check probes (§3.8) ----------------------------------------------------------------------------------

    CAP_ITEMS = 10000          # a list, tuple, range or dict summarised up to this many items
    CAP_ELEMENTS = 100000      # a NumPy array up to this many elements
    CAP_REPR = 200             # anything else: its repr, cut here

    def _snapshot(self):
        s = {'modules': dict(sys.modules), 'builtins': dict(builtins.__dict__), 'path': list(sys.path),
             'ns': dict(self.ns), 'random': _random.getstate(), 'cwd': os.getcwd()}
        np = sys.modules.get('numpy')
        if np is not None:
            try:
                s['np'] = (np, np.random.get_state())
            except BaseException:
                pass
        plt = sys.modules.get('matplotlib.pyplot')
        if plt is not None:
            try:
                s['figs'] = (plt, set(plt.get_fignums()))
            except BaseException:
                pass
        return s

    @staticmethod
    def _restore_dict(d, snap):
        for k in [k for k in d if k not in snap]:
            del d[k]
        for k, v in snap.items():
            if k not in d or d[k] is not v:
                d[k] = v

    def _restore(self, s):
        # figures the call opened are closed first (pyplot may be a module the call imported, which the next lines drop)
        figs = s.get('figs')
        plt = sys.modules.get('matplotlib.pyplot') if figs is None else figs[0]
        if plt is not None:
            before = figs[1] if figs else set()
            try:
                for n in plt.get_fignums():
                    if n not in before:
                        plt.close(n)
            except BaseException:
                pass
        # NB-3: when the call first imported a notebook package (NumPy, Matplotlib: site-packages), every module it
        # imported from the interpreter's own library stays (review nb3_r2 R2-S1: by that positive list; a learner's
        # file outside /evn/, a module made in the call, a namespace package of the learner's are dropped). A package's C extensions cannot be imported twice in one process
        # (dropped, the next import makes a second NumPy: "The NumPy module was reloaded", and Matplotlib then fails), and
        # the standard-library modules it pulled in are the ones it holds (review nb3_r1 S1: dropped, the next 'import
        # numbers' made a second 'numbers', and isinstance(np.int64(1), numbers.Integral) was False). A call that imported
        # no package drops what it imported, as before (NB-2's colorsys row)
        new = {k: m for k, m in sys.modules.items() if k not in s['modules']}
        kept = {}
        if any(_package_module(m) for m in new.values()):
            kept = {k: m for k, m in new.items() if _library_module(m)}
        self._restore_dict(sys.modules, s['modules'])
        sys.modules.update(kept)
        self._restore_dict(builtins.__dict__, s['builtins'])
        sys.path[:] = s['path']
        self._restore_dict(self.ns, s['ns'])
        _random.setstate(s['random'])
        if 'np' in s:
            np, st = s['np']
            try:
                np.random.set_state(st)
            except BaseException:
                pass
        try:
            os.chdir(s['cwd'])
        except BaseException:
            pass

    def _summary(self, v, depth=0):
        """(summary, truncated): §3.8's probe.get form"""
        if v is None or isinstance(v, (bool, str)):
            return v, False
        if isinstance(v, int):
            if -2 ** 53 <= v <= 2 ** 53:
                return int(v), False
            return {'type': 'int', 'text': str(v)}, False
        if isinstance(v, float):
            if _math.isfinite(v):
                return float(v), False
            return {'type': 'float', 'text': repr(float(v))}, False
        np = sys.modules.get('numpy')
        if np is not None:
            if isinstance(v, np.generic):
                return self._summary(v.item(), depth)
            if isinstance(v, np.ndarray):
                flat = v.ravel()
                cut = flat.size > self.CAP_ELEMENTS
                data = [self._summary(x, depth + 1)[0] for x in flat[:self.CAP_ELEMENTS].tolist()]
                d = {'type': 'ndarray', 'shape': list(v.shape), 'dtype': str(v.dtype), 'data': data}
                if cut:
                    d['truncated'] = True
                return d, cut
        if depth < 50:
            if isinstance(v, range):
                return {'type': 'range', 'start': v.start, 'stop': v.stop, 'step': v.step, 'len': len(v)}, False
            if isinstance(v, (list, tuple)):
                cut = len(v) > self.CAP_ITEMS
                items = []
                for x in v[:self.CAP_ITEMS]:
                    sx, tx = self._summary(x, depth + 1)
                    cut = cut or tx
                    items.append(sx)
                d = {'type': 'list' if isinstance(v, list) else 'tuple', 'items': items}
                if cut:
                    d['truncated'] = True
                return d, cut
            if isinstance(v, dict):
                cut = len(v) > self.CAP_ITEMS
                items = {}
                for i, (k, x) in enumerate(v.items()):
                    if i >= self.CAP_ITEMS:
                        break
                    sx, tx = self._summary(x, depth + 1)
                    cut = cut or tx
                    items[str(k)] = sx
                d = {'type': 'dict', 'items': items}
                if cut:
                    d['truncated'] = True
                return d, cut
        try:
            r = repr(v)
        except BaseException as e:
            r = '<repr failed: ' + type(e).__name__ + '>'
        d = {'type': type(v).__name__, 'repr': r[:self.CAP_REPR]}
        if len(r) > self.CAP_REPR:
            d['truncated'] = True
        return d, len(r) > self.CAP_REPR

    def _probe(self, work):
        """run work() between snapshot and restore, its printing captured; the reply as a JSON text. The streams are
        put back and the state restored with the SIGINT deferred (R2-S2), so a timed-out probe always restores and never
        leaves sys.stdout / sys.stderr pointing at its buffer"""
        out = _io.StringIO()
        snap = self._snapshot()
        streams = (sys.stdout, sys.stderr)
        reply = {'ok': False, 'error': {'type': 'KeyboardInterrupt', 'message': ''}}
        try:
            sys.stdout = sys.stderr = out
            try:
                reply = work()
            except BaseException as e:
                reply = {'ok': False, 'error': {'type': type(e).__name__, 'message': str(e)}}
        finally:
            while True:
                try:
                    _host.mask()
                    break
                except KeyboardInterrupt:
                    continue
            sys.stdout, sys.stderr = streams
            self._restore(snap)
        reply['stdout'] = out.getvalue()
        return _json.dumps(reply)

    def probe_call(self, fn, args, kwargs):
        def work():
            f = self.ns.get(fn)
            if f is None or not callable(f):
                return {'ok': False, 'error': {'type': 'NameError', 'message': fn + ' is not a function in the notebook: run its cell first'}}
            value = f(*_json.loads(args), **_json.loads(kwargs))
            return {'ok': True, 'value': self._summary(value)[0]}
        return self._probe(work)

    def probe_get(self, names):
        def work():
            values = {}
            for n in _json.loads(names):
                values[n] = self._summary(self.ns[n])[0] if n in self.ns else {'missing': True}
            return {'ok': True, 'value': values}
        return self._probe(work)

    def _ser(self, v, depth=0):
        """lossless, for the reference worker (§3.8 probe.ref); raises TypeError for a value it cannot copy"""
        if depth > 100:
            raise TypeError('a value nested this deep cannot be copied into the check')
        if v is None or isinstance(v, (bool, str)):
            return v
        if isinstance(v, int):
            return {'$int': str(int(v))}
        if isinstance(v, float):
            return {'$float': repr(float(v))}
        if isinstance(v, complex):
            return {'$complex': [repr(v.real), repr(v.imag)]}
        np = sys.modules.get('numpy')
        if np is not None:
            if isinstance(v, np.ndarray):
                if v.dtype.hasobject:
                    raise TypeError('an array of Python objects cannot be copied into the check')
                a = np.ascontiguousarray(v)
                return {'$nd': [a.dtype.str, list(a.shape), _base64.b64encode(a.tobytes()).decode('ascii')]}
            if isinstance(v, np.generic):
                a = np.asarray(v)
                return {'$np': [a.dtype.str, _base64.b64encode(a.tobytes()).decode('ascii')]}
        if isinstance(v, range):
            return {'$range': [v.start, v.stop, v.step]}
        if isinstance(v, list):
            return {'$list': [self._ser(x, depth + 1) for x in v]}
        if isinstance(v, tuple):
            return {'$tuple': [self._ser(x, depth + 1) for x in v]}
        if isinstance(v, (set, frozenset)):
            return {'$set' if isinstance(v, set) else '$frozenset': [self._ser(x, depth + 1) for x in v]}
        if isinstance(v, dict):
            return {'$dict': [[self._ser(k, depth + 1), self._ser(x, depth + 1)] for k, x in v.items()]}
        raise TypeError('a ' + type(v).__name__ + ' cannot be copied into the check')

    def _deser(self, o):
        if o is None or isinstance(o, (bool, str)):
            return o
        (tag, body), = o.items()
        if tag == '$int':
            return int(body)
        if tag == '$float':
            return float(body)
        if tag == '$complex':
            return complex(float(body[0]), float(body[1]))
        if tag == '$range':
            return range(*body)
        if tag == '$list':
            return [self._deser(x) for x in body]
        if tag == '$tuple':
            return tuple(self._deser(x) for x in body)
        if tag == '$set':
            return set(self._deser(x) for x in body)
        if tag == '$frozenset':
            return frozenset(self._deser(x) for x in body)
        if tag == '$dict':
            return {self._deser(k): self._deser(x) for k, x in body}
        if tag in ('$nd', '$np'):
            import numpy as np
            if tag == '$np':
                return np.frombuffer(_base64.b64decode(body[1]), dtype=np.dtype(body[0]))[0]
            return np.frombuffer(_base64.b64decode(body[2]), dtype=np.dtype(body[0])).reshape(body[1]).copy()
        raise TypeError('unknown value in the check: ' + tag)

    def probe_ser(self, names, limit):
        try:
            values = {}
            for n in _json.loads(names):
                if n not in self.ns:
                    return _json.dumps({'ok': False, 'error': {'type': 'NameError', 'message': n + ' is not defined in the notebook: run its cell first'}})
                values[n] = self._ser(self.ns[n])
            text = _json.dumps(values)
        except TypeError as e:
            return _json.dumps({'ok': False, 'error': {'type': 'TypeError', 'message': str(e)}})
        if len(text) > limit:
            return _json.dumps({'ok': False, 'error': {'type': 'TooLarge', 'message': 'too large to check'}})
        return _json.dumps({'ok': True, 'value': text})

    async def ref_run(self, code, inputs):
        """the reference worker: the check's own code in this fresh interpreter, the learner's values bound by name"""
        out = _io.StringIO()
        try:
            stop = self.check_imports(code)
            if stop:
                return _json.dumps({'ok': False, 'error': {'type': 'Refused', 'message': stop}})
            # NB-3: a learner's NumPy value copied in needs NumPy here too
            if ('"$nd"' in inputs or '"$np"' in inputs) and 'numpy' in self.packages:
                self.to_load.add(self.packages['numpy'])
            if self.to_load:
                import pyodide_js
                await pyodide_js.loadPackage(sorted(self.to_load))
            ns = {'__name__': '__reference__', '__builtins__': builtins}
            for k, v in _json.loads(inputs).items():
                ns[k] = self._deser(v)
            with _contextlib.redirect_stdout(out), _contextlib.redirect_stderr(out):
                value = await _eval_code_async(code, ns, filename='<reference>')
            return _json.dumps({'ok': True, 'value': self._summary(value)[0], 'stdout': out.getvalue()})
        except BaseException as e:
            return _json.dumps({'ok': False, 'error': {'type': type(e).__name__, 'message': str(e)}, 'stdout': out.getvalue()})
`;function Ue(e){return e.startsWith(".")||e==="Submissions"||e==="__pycache__"}l(Ue,"skippedFolder");var mt=["/evn","/work"];function We(e){let t=null,r=null,o=-1,s=!1,n=Promise.resolve(),i=new Map,f=new Map,p=new Map,u=0,m=l(()=>Number(t?._module?.HEAP8?.length??0),"memory"),c=l(a=>{let h=new TextDecoder;return{write(v){let y=h.decode(v,{stream:!0});return y&&o>=0&&e.post({t:a,id:o,text:y}),v.length}}},"streams"),g=l(a=>`${a.size}:${+a.mtime}`,"keyOf"),_,w=new Uint8Array(1),F=l(()=>{_&&t&&t.setInterruptBuffer(_)},"unmask"),O=[];function oe(a){let h=t.FS,v=[];for(let y of a??[])try{let E=y.path.slice(0,y.path.lastIndexOf("/"));E&&h.mkdirTree(E),h.writeFile(y.path,y.data),typeof y.mtime=="number"&&h.utime(y.path,y.mtime,y.mtime),i.set(y.path,g(h.stat(y.path)))}catch{v.push(y.path)}return O.push(...v),v}l(oe,"writeMirror");function Ge(){let a=t.FS,h=[],v=l(y=>{let E;try{E=a.readdir(y)}catch{return}for(let k of E){if(k==="."||k==="..")continue;let x=`${y}/${k}`,b;try{b=a.stat(x)}catch{continue}if(a.isDir(b.mode)){Ue(k)||v(x);continue}if(!a.isFile(b.mode))continue;let j=g(b);i.get(x)!==j&&(h.push({path:x,data:a.readFile(x)}),i.set(x,j))}},"walk");for(let y of mt)v(y);return h}l(Ge,"scanChanged");async function qe(a){let h=Date.now();a.files&&(M?.serve({"pyodide.asm.wasm":{body:a.files.wasm,type:"application/wasm"},"python_stdlib.zip":{body:a.files.stdlib,type:"application/zip"}}),e.loadGlue?.(a.files.asm),M?.closeImportScripts());let v=new Set(Object.values(JSON.parse(a.lock).packages||{}).map(x=>String(x.file_name)));M?.provide(x=>v.has(x)?new Promise((b,j)=>{let $=++u;p.set($,{resolve:b,reject:j}),e.post({t:"file",req:$,name:x})}):void 0),t=await ie({indexURL:a.indexURL,packageBaseUrl:a.packageDir??a.indexURL,...a.packageDir?{packageCacheDir:a.packageDir}:{},lockFileContents:a.lock,jsglobals:pe(globalThis),stdout:l(()=>{},"stdout"),stderr:l(()=>{},"stderr")});let y=t.loadPackage.bind(t);t.loadPackage=async(x,b={})=>{let j=[],$=await y(x,{...b,messageCallback:b.messageCallback??(()=>{}),errorCallback:l(ce=>{j.push(ce),b.errorCallback?.(ce)},"errorCallback")});if(j.length)throw new Error(j.join(`
`));return $},t.setStdout(c("stdout")),t.setStderr(c("stderr")),a.interrupt&&(_=new Uint8Array(a.interrupt),t.setInterruptBuffer(_)),s=!!a.mirror,t.registerJsModule("_evn_nb_host",{mask:l(()=>{_&&t.setInterruptBuffer(w)},"mask"),copy_in:l((x,b)=>new Promise(j=>{let $=++u;f.set($,j),e.post({t:"copyIn",id:o,req:$,path:String(x),cwd:String(b)})}),"copy_in")}),t.runPython(ze,{filename:"<evn-kernel>"});let E=t.globals.get("_EvnKernel"),k=t.toPy({workdir:a.workdir,roots:a.roots,unvendored:a.unvendored,packages:a.packages,missing:a.missing??[],missing_line:a.missingLine??null,has:a.has,modules:a.modules});r=E(k),k.destroy(),E.destroy(),e.post({t:"ready",ms:Date.now()-h,memory:m()})}l(qe,"init");async function He(a,h,v,y,E){o=a,O=[];for(let b of E??[])i.delete(b);let k;try{oe(y);try{k=JSON.parse(await r.run(h,v))}finally{F()}}catch(b){k={ok:!1,error:{name:String(b?.name??"Error"),message:String(b?.message??b),stack:String(b?.message??b)}}}finally{o=-1}let x;if(s)try{x=Ge()}catch(b){e.post({t:"stderr",id:a,text:`The notebook could not read back the cell's files: ${b?.message??b}
`})}e.post({t:"done",id:a,ok:!!k.ok,value:k.value??null,error:k.error,refused:k.refused,install:k.install??void 0,memory:m(),changed:x,unwritten:O.length?O:void 0,figures:k.figures&&k.figures.length?k.figures:void 0})}l(He,"run");let le=l(a=>JSON.stringify({ok:!1,error:{type:String(a?.type??a?.name??"Error"),message:String(a?.message??a)}}),"failReply");e.onMessage(a=>{if(a.t==="init")n=n.then(()=>qe(a)).catch(h=>e.post({t:"failed",message:String(h?.message??h)}));else if(a.t==="run")n=n.then(()=>r?He(a.id,a.code,a.label,a.files,a.dirty):e.post({t:"done",id:a.id,ok:!1,error:{name:"KernelError",message:"the notebook's Python did not start",stack:""},memory:0}));else if(a.t==="copyInReply"){let h=f.get(a.req);f.delete(a.req);let v=a.error,y=oe(a.files);y.length&&(v=`could not put ${y.join(", ")} into the notebook's copy (a folder there has that name?)`),h?.(JSON.stringify({copied:(a.copied??a.files.map(E=>E.path)).filter(E=>!y.includes(E)),error:v??null}))}else if(a.t==="fileReply"){let h=p.get(a.req);p.delete(a.req),h&&(a.data?h.resolve({body:a.data,type:"application/octet-stream"}):h.reject(new Error(a.error??"the package file could not be read")))}else a.t==="probe"?n=n.then(async()=>{let h;try{if(!r)throw new Error("the notebook's Python did not start");try{a.kind==="call"?h=r.probe_call(a.fn,a.args,a.kwargs):a.kind==="get"?h=r.probe_get(JSON.stringify(a.names)):h=r.probe_ser(JSON.stringify(a.names),a.limit)}finally{F()}}catch(v){h=le(v)}e.post({t:"probeDone",id:a.id,reply:h})}):a.t==="ref"&&(n=n.then(async()=>{let h;try{if(!r)throw new Error("the reference's Python did not start");h=await r.ref_run(a.code,a.inputs)}catch(v){h=le(v)}e.post({t:"refDone",id:a.id,reply:h})}))})}l(We,"serveKernel");var ae=globalThis;We({post:l(e=>ae.postMessage(e),"post"),onMessage:l(e=>{ae.onmessage=t=>e(t.data)},"onMessage"),loadGlue:l(e=>{let t=URL.createObjectURL(new Blob([e],{type:"text/javascript"}));try{(M?.importScripts??ae.importScripts)(t)}finally{URL.revokeObjectURL(t)}},"loadGlue")});})();
