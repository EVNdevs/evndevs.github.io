"use strict";var vs=Object.create;var Ce=Object.defineProperty;var xs=Object.getOwnPropertyDescriptor;var ks=Object.getOwnPropertyNames;var Ss=Object.getPrototypeOf,Es=Object.prototype.hasOwnProperty;var a=(t,e)=>Ce(t,"name",{value:e,configurable:!0});var Ns=(t,e,r)=>()=>{if(r)throw r[0];try{return t&&(e=t(t=0)),e}catch(s){throw r=[s],s}};var C=(t,e)=>()=>{try{return e||t((e={exports:{}}).exports,e),e.exports}catch(r){throw e=0,r}},Os=(t,e)=>{for(var r in e)Ce(t,r,{get:e[r],enumerable:!0})},Ts=(t,e,r,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ks(e))!Es.call(t,n)&&n!==r&&Ce(t,n,{get:()=>e[n],enumerable:!(s=xs(e,n))||s.enumerable});return t};var T=(t,e,r)=>(r=t!=null?vs(Ss(t)):{},Ts(e||!t||!t.__esModule?Ce(r,"default",{value:t,enumerable:!0}):r,t));var U=C((bi,Lt)=>{"use strict";var Ft=["nodebuffer","arraybuffer","fragments"],Bt=typeof Blob<"u";Bt&&Ft.push("blob");Lt.exports={BINARY_TYPES:Ft,CLOSE_TIMEOUT:3e4,EMPTY_BUFFER:Buffer.alloc(0),GUID:"258EAFA5-E914-47DA-95CA-C5AB0DC85B11",hasBlob:Bt,kForOnEventAttribute:Symbol("kIsForOnEventAttribute"),kListener:Symbol("kListener"),kStatusCode:Symbol("status-code"),kWebSocket:Symbol("websocket"),NOOP:a(()=>{},"NOOP")}});var ye=C((vi,Be)=>{"use strict";var{EMPTY_BUFFER:Cs}=U(),Xe=Buffer[Symbol.species];function Fs(t,e){if(t.length===0)return Cs;if(t.length===1)return t[0];let r=Buffer.allocUnsafe(e),s=0;for(let n=0;n<t.length;n++){let i=t[n];r.set(i,s),s+=i.length}return s<e?new Xe(r.buffer,r.byteOffset,s):r}a(Fs,"concat");function At(t,e,r,s,n){for(let i=0;i<n;i++)r[s+i]=t[i]^e[i&3]}a(At,"_mask");function It(t,e){for(let r=0;r<t.length;r++)t[r]^=e[r&3]}a(It,"_unmask");function Bs(t){return t.length===t.buffer.byteLength?t.buffer:t.buffer.slice(t.byteOffset,t.byteOffset+t.length)}a(Bs,"toArrayBuffer");function Ze(t){if(Ze.readOnly=!0,Buffer.isBuffer(t))return t;let e;return t instanceof ArrayBuffer?e=new Xe(t):ArrayBuffer.isView(t)?e=new Xe(t.buffer,t.byteOffset,t.byteLength):(e=Buffer.from(t),Ze.readOnly=!1),e}a(Ze,"toBuffer");Be.exports={concat:Fs,mask:At,toArrayBuffer:Bs,toBuffer:Ze,unmask:It};if(!process.env.WS_NO_BUFFER_UTIL)try{let t=require("bufferutil");Be.exports.mask=function(e,r,s,n,i){i<48?At(e,r,s,n,i):t.mask(e,r,s,n,i)},Be.exports.unmask=function(e,r){e.length<32?It(e,r):t.unmask(e,r)}}catch{}});var jt=C((ki,Dt)=>{"use strict";var Rt=Symbol("kDone"),Qe=Symbol("kRun"),et=class{static{a(this,"Limiter")}constructor(e){this[Rt]=()=>{this.pending--,this[Qe]()},this.concurrency=e||1/0,this.jobs=[],this.pending=0}add(e){this.jobs.push(e),this[Qe]()}[Qe](){if(this.pending!==this.concurrency&&this.jobs.length){let e=this.jobs.shift();this.pending++,e(this[Rt])}}};Dt.exports=et});var le=C((Ei,Wt)=>{"use strict";var be=require("zlib"),Mt=ye(),Ls=jt(),{kStatusCode:Ut}=U(),As=Buffer[Symbol.species],Is=Buffer.from([0,0,255,255]),Ae=Symbol("permessage-deflate"),$=Symbol("total-length"),oe=Symbol("callback"),V=Symbol("buffers"),ae=Symbol("error"),Le,tt=class{static{a(this,"PerMessageDeflate")}constructor(e){if(this._options=e||{},this._threshold=this._options.threshold!==void 0?this._options.threshold:1024,this._maxPayload=this._options.maxPayload|0,this._isServer=!!this._options.isServer,this._deflate=null,this._inflate=null,this.params=null,!Le){let r=this._options.concurrencyLimit!==void 0?this._options.concurrencyLimit:10;Le=new Ls(r)}}static get extensionName(){return"permessage-deflate"}offer(){let e={};return this._options.serverNoContextTakeover&&(e.server_no_context_takeover=!0),this._options.clientNoContextTakeover&&(e.client_no_context_takeover=!0),this._options.serverMaxWindowBits&&(e.server_max_window_bits=this._options.serverMaxWindowBits),this._options.clientMaxWindowBits?e.client_max_window_bits=this._options.clientMaxWindowBits:this._options.clientMaxWindowBits==null&&(e.client_max_window_bits=!0),e}accept(e){return e=this.normalizeParams(e),this.params=this._isServer?this.acceptAsServer(e):this.acceptAsClient(e),this.params}cleanup(){if(this._inflate&&(this._inflate.close(),this._inflate=null),this._deflate){let e=this._deflate[oe];this._deflate.close(),this._deflate=null,e&&e(new Error("The deflate stream was closed while data was being processed"))}}acceptAsServer(e){let r=this._options,s=e.find(n=>!(r.serverNoContextTakeover===!1&&n.server_no_context_takeover||n.server_max_window_bits&&(r.serverMaxWindowBits===!1||typeof r.serverMaxWindowBits=="number"&&r.serverMaxWindowBits>n.server_max_window_bits)||typeof r.clientMaxWindowBits=="number"&&(typeof n.client_max_window_bits=="number"?r.clientMaxWindowBits>n.client_max_window_bits:!n.client_max_window_bits)));if(!s)throw new Error("None of the extension offers can be accepted");return r.serverNoContextTakeover&&(s.server_no_context_takeover=!0),r.clientNoContextTakeover&&(s.client_no_context_takeover=!0),typeof r.serverMaxWindowBits=="number"&&(s.server_max_window_bits=r.serverMaxWindowBits),typeof r.clientMaxWindowBits=="number"?s.client_max_window_bits=r.clientMaxWindowBits:(s.client_max_window_bits===!0||r.clientMaxWindowBits===!1)&&delete s.client_max_window_bits,s}acceptAsClient(e){let r=e[0];if(this._options.clientNoContextTakeover===!1&&r.client_no_context_takeover)throw new Error('Unexpected parameter "client_no_context_takeover"');if(!r.client_max_window_bits)typeof this._options.clientMaxWindowBits=="number"&&(r.client_max_window_bits=this._options.clientMaxWindowBits);else if(this._options.clientMaxWindowBits===!1||typeof this._options.clientMaxWindowBits=="number"&&r.client_max_window_bits>this._options.clientMaxWindowBits)throw new Error('Unexpected or invalid parameter "client_max_window_bits"');return r}normalizeParams(e){return e.forEach(r=>{Object.keys(r).forEach(s=>{let n=r[s];if(n.length>1)throw new Error(`Parameter "${s}" must have only a single value`);if(n=n[0],s==="client_max_window_bits"){if(n!==!0){let i=+n;if(!Number.isInteger(i)||i<8||i>15)throw new TypeError(`Invalid value for parameter "${s}": ${n}`);n=i}else if(!this._isServer)throw new TypeError(`Invalid value for parameter "${s}": ${n}`)}else if(s==="server_max_window_bits"){let i=+n;if(!Number.isInteger(i)||i<8||i>15)throw new TypeError(`Invalid value for parameter "${s}": ${n}`);n=i}else if(s==="client_no_context_takeover"||s==="server_no_context_takeover"){if(n!==!0)throw new TypeError(`Invalid value for parameter "${s}": ${n}`)}else throw new Error(`Unknown parameter "${s}"`);r[s]=n})}),e}decompress(e,r,s){Le.add(n=>{this._decompress(e,r,(i,o)=>{n(),s(i,o)})})}compress(e,r,s){Le.add(n=>{this._compress(e,r,(i,o)=>{n(),s(i,o)})})}_decompress(e,r,s){let n=this._isServer?"client":"server";if(!this._inflate){let i=`${n}_max_window_bits`,o=typeof this.params[i]!="number"?be.Z_DEFAULT_WINDOWBITS:this.params[i];this._inflate=be.createInflateRaw({...this._options.zlibInflateOptions,windowBits:o}),this._inflate[Ae]=this,this._inflate[$]=0,this._inflate[V]=[],this._inflate.on("error",Ds),this._inflate.on("data",$t)}this._inflate[oe]=s,this._inflate.write(e),r&&this._inflate.write(Is),this._inflate.flush(()=>{let i=this._inflate[ae];if(i){this._inflate.close(),this._inflate=null,s(i);return}let o=Mt.concat(this._inflate[V],this._inflate[$]);this._inflate._readableState.endEmitted?(this._inflate.close(),this._inflate=null):(this._inflate[$]=0,this._inflate[V]=[],r&&this.params[`${n}_no_context_takeover`]&&this._inflate.reset()),s(null,o)})}_compress(e,r,s){let n=this._isServer?"server":"client";if(!this._deflate){let i=`${n}_max_window_bits`,o=typeof this.params[i]!="number"?be.Z_DEFAULT_WINDOWBITS:this.params[i];this._deflate=be.createDeflateRaw({...this._options.zlibDeflateOptions,windowBits:o}),this._deflate[$]=0,this._deflate[V]=[],this._deflate.on("data",Rs)}this._deflate[oe]=s,this._deflate.write(e),this._deflate.flush(be.Z_SYNC_FLUSH,()=>{if(!this._deflate)return;let i=Mt.concat(this._deflate[V],this._deflate[$]);r&&(i=new As(i.buffer,i.byteOffset,i.length-4)),this._deflate[oe]=null,this._deflate[$]=0,this._deflate[V]=[],r&&this.params[`${n}_no_context_takeover`]&&this._deflate.reset(),s(null,i)})}};Wt.exports=tt;function Rs(t){this[V].push(t),this[$]+=t.length}a(Rs,"deflateOnData");function $t(t){if(this[$]+=t.length,this[Ae]._maxPayload<1||this[$]<=this[Ae]._maxPayload){this[V].push(t);return}this[ae]=new RangeError("Max payload size exceeded"),this[ae].code="WS_ERR_UNSUPPORTED_MESSAGE_LENGTH",this[ae][Ut]=1009,this.removeListener("data",$t),this.reset()}a($t,"inflateOnData");function Ds(t){if(this[Ae]._inflate=null,this[ae]){this[oe](this[ae]);return}t[Ut]=1007,this[oe](t)}a(Ds,"inflateOnError")});var fe=C((Oi,Ie)=>{"use strict";var{isUtf8:zt}=require("buffer"),{hasBlob:js}=U(),Ms=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1,1,0,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,0];function Us(t){return t>=1e3&&t<=1014&&t!==1004&&t!==1005&&t!==1006||t>=3e3&&t<=4999}a(Us,"isValidStatusCode");function rt(t){let e=t.length,r=0;for(;r<e;)if((t[r]&128)===0)r++;else if((t[r]&224)===192){if(r+1===e||(t[r+1]&192)!==128||(t[r]&254)===192)return!1;r+=2}else if((t[r]&240)===224){if(r+2>=e||(t[r+1]&192)!==128||(t[r+2]&192)!==128||t[r]===224&&(t[r+1]&224)===128||t[r]===237&&(t[r+1]&224)===160)return!1;r+=3}else if((t[r]&248)===240){if(r+3>=e||(t[r+1]&192)!==128||(t[r+2]&192)!==128||(t[r+3]&192)!==128||t[r]===240&&(t[r+1]&240)===128||t[r]===244&&t[r+1]>143||t[r]>244)return!1;r+=4}else return!1;return!0}a(rt,"_isValidUTF8");function $s(t){return js&&typeof t=="object"&&typeof t.arrayBuffer=="function"&&typeof t.type=="string"&&typeof t.stream=="function"&&(t[Symbol.toStringTag]==="Blob"||t[Symbol.toStringTag]==="File")}a($s,"isBlob");Ie.exports={isBlob:$s,isValidStatusCode:Us,isValidUTF8:rt,tokenChars:Ms};if(zt)Ie.exports.isValidUTF8=function(t){return t.length<24?rt(t):zt(t)};else if(!process.env.WS_NO_UTF_8_VALIDATE)try{let t=require("utf-8-validate");Ie.exports.isValidUTF8=function(e){return e.length<32?rt(e):t(e)}}catch{}});var at=C((Pi,Jt)=>{"use strict";var{Writable:Ws}=require("stream"),qt=le(),{BINARY_TYPES:zs,EMPTY_BUFFER:Gt,kStatusCode:qs,kWebSocket:Gs}=U(),{concat:st,toArrayBuffer:Vs,unmask:Hs}=ye(),{isValidStatusCode:Ys,isValidUTF8:Vt}=fe(),Re=Buffer[Symbol.species],L=0,Ht=1,Yt=2,Kt=3,nt=4,it=5,De=6,ot=class extends Ws{static{a(this,"Receiver")}constructor(e={}){super(),this._allowSynchronousEvents=e.allowSynchronousEvents!==void 0?e.allowSynchronousEvents:!0,this._binaryType=e.binaryType||zs[0],this._extensions=e.extensions||{},this._isServer=!!e.isServer,this._maxBufferedChunks=e.maxBufferedChunks|0,this._maxFragments=e.maxFragments|0,this._maxPayload=e.maxPayload|0,this._skipUTF8Validation=!!e.skipUTF8Validation,this[Gs]=void 0,this._bufferedBytes=0,this._buffers=[],this._compressed=!1,this._payloadLength=0,this._mask=void 0,this._fragmented=0,this._masked=!1,this._fin=!1,this._opcode=0,this._totalPayloadLength=0,this._messageLength=0,this._numFragments=0,this._fragments=[],this._errored=!1,this._loop=!1,this._state=L}_write(e,r,s){if(this._opcode===8&&this._state==L)return s();if(this._maxBufferedChunks>0&&this._buffers.length>=this._maxBufferedChunks){s(this.createError(RangeError,"Too many buffered chunks",!1,1008,"WS_ERR_TOO_MANY_BUFFERED_PARTS"));return}this._bufferedBytes+=e.length,this._buffers.push(e),this.startLoop(s)}consume(e){if(this._bufferedBytes-=e,e===this._buffers[0].length)return this._buffers.shift();if(e<this._buffers[0].length){let s=this._buffers[0];return this._buffers[0]=new Re(s.buffer,s.byteOffset+e,s.length-e),new Re(s.buffer,s.byteOffset,e)}let r=Buffer.allocUnsafe(e);do{let s=this._buffers[0],n=r.length-e;e>=s.length?r.set(this._buffers.shift(),n):(r.set(new Uint8Array(s.buffer,s.byteOffset,e),n),this._buffers[0]=new Re(s.buffer,s.byteOffset+e,s.length-e)),e-=s.length}while(e>0);return r}startLoop(e){this._loop=!0;do switch(this._state){case L:this.getInfo(e);break;case Ht:this.getPayloadLength16(e);break;case Yt:this.getPayloadLength64(e);break;case Kt:this.getMask();break;case nt:this.getData(e);break;case it:case De:this._loop=!1;return}while(this._loop);this._errored||e()}getInfo(e){if(this._bufferedBytes<2){this._loop=!1;return}let r=this.consume(2);if((r[0]&48)!==0){let n=this.createError(RangeError,"RSV2 and RSV3 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_2_3");e(n);return}let s=(r[0]&64)===64;if(s&&!this._extensions[qt.extensionName]){let n=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(n);return}if(this._fin=(r[0]&128)===128,this._opcode=r[0]&15,this._payloadLength=r[1]&127,this._opcode===0){if(s){let n=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(n);return}if(!this._fragmented){let n=this.createError(RangeError,"invalid opcode 0",!0,1002,"WS_ERR_INVALID_OPCODE");e(n);return}this._opcode=this._fragmented}else if(this._opcode===1||this._opcode===2){if(this._fragmented){let n=this.createError(RangeError,`invalid opcode ${this._opcode}`,!0,1002,"WS_ERR_INVALID_OPCODE");e(n);return}this._compressed=s}else if(this._opcode>7&&this._opcode<11){if(!this._fin){let n=this.createError(RangeError,"FIN must be set",!0,1002,"WS_ERR_EXPECTED_FIN");e(n);return}if(s){let n=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(n);return}if(this._payloadLength>125||this._opcode===8&&this._payloadLength===1){let n=this.createError(RangeError,`invalid payload length ${this._payloadLength}`,!0,1002,"WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH");e(n);return}}else{let n=this.createError(RangeError,`invalid opcode ${this._opcode}`,!0,1002,"WS_ERR_INVALID_OPCODE");e(n);return}if(!this._fin&&!this._fragmented&&(this._fragmented=this._opcode),this._masked=(r[1]&128)===128,this._isServer){if(!this._masked){let n=this.createError(RangeError,"MASK must be set",!0,1002,"WS_ERR_EXPECTED_MASK");e(n);return}}else if(this._masked){let n=this.createError(RangeError,"MASK must be clear",!0,1002,"WS_ERR_UNEXPECTED_MASK");e(n);return}this._payloadLength===126?this._state=Ht:this._payloadLength===127?this._state=Yt:this.haveLength(e)}getPayloadLength16(e){if(this._bufferedBytes<2){this._loop=!1;return}this._payloadLength=this.consume(2).readUInt16BE(0),this.haveLength(e)}getPayloadLength64(e){if(this._bufferedBytes<8){this._loop=!1;return}let r=this.consume(8),s=r.readUInt32BE(0);if(s>Math.pow(2,21)-1){let n=this.createError(RangeError,"Unsupported WebSocket frame: payload length > 2^53 - 1",!1,1009,"WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH");e(n);return}this._payloadLength=s*Math.pow(2,32)+r.readUInt32BE(4),this.haveLength(e)}haveLength(e){if(this._payloadLength&&this._opcode<8&&(this._totalPayloadLength+=this._payloadLength,this._totalPayloadLength>this._maxPayload&&this._maxPayload>0)){let r=this.createError(RangeError,"Max payload size exceeded",!1,1009,"WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");e(r);return}this._masked?this._state=Kt:this._state=nt}getMask(){if(this._bufferedBytes<4){this._loop=!1;return}this._mask=this.consume(4),this._state=nt}getData(e){let r=Gt;if(this._payloadLength){if(this._bufferedBytes<this._payloadLength){this._loop=!1;return}r=this.consume(this._payloadLength),this._masked&&(this._mask[0]|this._mask[1]|this._mask[2]|this._mask[3])!==0&&Hs(r,this._mask)}if(this._opcode>7){this.controlMessage(r,e);return}if(this._maxFragments>0&&++this._numFragments>this._maxFragments){let s=this.createError(RangeError,"Too many message fragments",!1,1008,"WS_ERR_TOO_MANY_BUFFERED_PARTS");e(s);return}if(this._compressed){this._state=it,this.decompress(r,e);return}r.length&&(this._messageLength=this._totalPayloadLength,this._fragments.push(r)),this.dataMessage(e)}decompress(e,r){this._extensions[qt.extensionName].decompress(e,this._fin,(n,i)=>{if(n)return r(n);if(i.length){if(this._messageLength+=i.length,this._messageLength>this._maxPayload&&this._maxPayload>0){let o=this.createError(RangeError,"Max payload size exceeded",!1,1009,"WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");r(o);return}this._fragments.push(i)}this.dataMessage(r),this._state===L&&this.startLoop(r)})}dataMessage(e){if(!this._fin){this._state=L;return}let r=this._messageLength,s=this._fragments;if(this._totalPayloadLength=0,this._messageLength=0,this._fragmented=0,this._numFragments=0,this._fragments=[],this._opcode===2){let n;this._binaryType==="nodebuffer"?n=st(s,r):this._binaryType==="arraybuffer"?n=Vs(st(s,r)):this._binaryType==="blob"?n=new Blob(s):n=s,this._allowSynchronousEvents?(this.emit("message",n,!0),this._state=L):(this._state=De,setImmediate(()=>{this.emit("message",n,!0),this._state=L,this.startLoop(e)}))}else{let n=st(s,r);if(!this._skipUTF8Validation&&!Vt(n)){let i=this.createError(Error,"invalid UTF-8 sequence",!0,1007,"WS_ERR_INVALID_UTF8");e(i);return}this._state===it||this._allowSynchronousEvents?(this.emit("message",n,!1),this._state=L):(this._state=De,setImmediate(()=>{this.emit("message",n,!1),this._state=L,this.startLoop(e)}))}}controlMessage(e,r){if(this._opcode===8){if(e.length===0)this._loop=!1,this.emit("conclude",1005,Gt),this.end();else{let s=e.readUInt16BE(0);if(!Ys(s)){let i=this.createError(RangeError,`invalid status code ${s}`,!0,1002,"WS_ERR_INVALID_CLOSE_CODE");r(i);return}let n=new Re(e.buffer,e.byteOffset+2,e.length-2);if(!this._skipUTF8Validation&&!Vt(n)){let i=this.createError(Error,"invalid UTF-8 sequence",!0,1007,"WS_ERR_INVALID_UTF8");r(i);return}this._loop=!1,this.emit("conclude",s,n),this.end()}this._state=L;return}this._allowSynchronousEvents?(this.emit(this._opcode===9?"ping":"pong",e),this._state=L):(this._state=De,setImmediate(()=>{this.emit(this._opcode===9?"ping":"pong",e),this._state=L,this.startLoop(r)}))}createError(e,r,s,n,i){this._loop=!1,this._errored=!0;let o=new e(s?`Invalid WebSocket frame: ${r}`:r);return Error.captureStackTrace(o,this.createError),o.code=i,o[qs]=n,o}};Jt.exports=ot});var ct=C((Bi,Qt)=>{"use strict";var{Duplex:Fi}=require("stream"),{randomFillSync:Ks}=require("crypto"),{types:{isUint8Array:Js}}=require("util"),Xt=le(),{EMPTY_BUFFER:Xs,kWebSocket:Zs,NOOP:Qs}=U(),{isBlob:ce,isValidStatusCode:en}=fe(),{mask:Zt,toBuffer:X}=ye(),A=Symbol("kByteLength"),tn=Buffer.alloc(4),je=8*1024,Z,de=je,I=0,rn=1,sn=2,lt=class t{static{a(this,"Sender")}constructor(e,r,s){this._extensions=r||{},s&&(this._generateMask=s,this._maskBuffer=Buffer.alloc(4)),this._socket=e,this._firstFragment=!0,this._compress=!1,this._bufferedBytes=0,this._queue=[],this._state=I,this.onerror=Qs,this[Zs]=void 0}static frame(e,r){let s,n=!1,i=2,o=!1;r.mask&&(s=r.maskBuffer||tn,r.generateMask?r.generateMask(s):(de===je&&(Z===void 0&&(Z=Buffer.alloc(je)),Ks(Z,0,je),de=0),s[0]=Z[de++],s[1]=Z[de++],s[2]=Z[de++],s[3]=Z[de++]),o=(s[0]|s[1]|s[2]|s[3])===0,i=6);let l;typeof e=="string"?(!r.mask||o)&&r[A]!==void 0?l=r[A]:(e=Buffer.from(e),l=e.length):(l=e.length,n=r.mask&&r.readOnly&&!o);let d=l;l>=65536?(i+=8,d=127):l>125&&(i+=2,d=126);let c=Buffer.allocUnsafe(n?l+i:i);return c[0]=r.fin?r.opcode|128:r.opcode,r.rsv1&&(c[0]|=64),c[1]=d,d===126?c.writeUInt16BE(l,2):d===127&&(c[2]=c[3]=0,c.writeUIntBE(l,4,6)),r.mask?(c[1]|=128,c[i-4]=s[0],c[i-3]=s[1],c[i-2]=s[2],c[i-1]=s[3],o?[c,e]:n?(Zt(e,s,c,i,l),[c]):(Zt(e,s,e,0,l),[c,e])):[c,e]}close(e,r,s,n){let i;if(e===void 0)i=Xs;else{if(typeof e!="number"||!en(e))throw new TypeError("First argument must be a valid error code number");if(r===void 0||!r.length)i=Buffer.allocUnsafe(2),i.writeUInt16BE(e,0);else{let l=Buffer.byteLength(r);if(l>123)throw new RangeError("The message must not be greater than 123 bytes");if(i=Buffer.allocUnsafe(2+l),i.writeUInt16BE(e,0),typeof r=="string")i.write(r,2);else if(Js(r))i.set(r,2);else throw new TypeError("Second argument must be a string or a Uint8Array")}}let o={[A]:i.length,fin:!0,generateMask:this._generateMask,mask:s,maskBuffer:this._maskBuffer,opcode:8,readOnly:!1,rsv1:!1};this._state!==I?this.enqueue([this.dispatch,i,!1,o,n]):this.sendFrame(t.frame(i,o),n)}ping(e,r,s){let n,i;if(typeof e=="string"?(n=Buffer.byteLength(e),i=!1):ce(e)?(n=e.size,i=!1):(e=X(e),n=e.length,i=X.readOnly),n>125)throw new RangeError("The data size must not be greater than 125 bytes");let o={[A]:n,fin:!0,generateMask:this._generateMask,mask:r,maskBuffer:this._maskBuffer,opcode:9,readOnly:i,rsv1:!1};ce(e)?this._state!==I?this.enqueue([this.getBlobData,e,!1,o,s]):this.getBlobData(e,!1,o,s):this._state!==I?this.enqueue([this.dispatch,e,!1,o,s]):this.sendFrame(t.frame(e,o),s)}pong(e,r,s){let n,i;if(typeof e=="string"?(n=Buffer.byteLength(e),i=!1):ce(e)?(n=e.size,i=!1):(e=X(e),n=e.length,i=X.readOnly),n>125)throw new RangeError("The data size must not be greater than 125 bytes");let o={[A]:n,fin:!0,generateMask:this._generateMask,mask:r,maskBuffer:this._maskBuffer,opcode:10,readOnly:i,rsv1:!1};ce(e)?this._state!==I?this.enqueue([this.getBlobData,e,!1,o,s]):this.getBlobData(e,!1,o,s):this._state!==I?this.enqueue([this.dispatch,e,!1,o,s]):this.sendFrame(t.frame(e,o),s)}send(e,r,s){let n=this._extensions[Xt.extensionName],i=r.binary?2:1,o=r.compress,l,d;typeof e=="string"?(l=Buffer.byteLength(e),d=!1):ce(e)?(l=e.size,d=!1):(e=X(e),l=e.length,d=X.readOnly),this._firstFragment?(this._firstFragment=!1,o&&n&&n.params[n._isServer?"server_no_context_takeover":"client_no_context_takeover"]&&(o=l>=n._threshold),this._compress=o):(o=!1,i=0),r.fin&&(this._firstFragment=!0);let c={[A]:l,fin:r.fin,generateMask:this._generateMask,mask:r.mask,maskBuffer:this._maskBuffer,opcode:i,readOnly:d,rsv1:o};ce(e)?this._state!==I?this.enqueue([this.getBlobData,e,this._compress,c,s]):this.getBlobData(e,this._compress,c,s):this._state!==I?this.enqueue([this.dispatch,e,this._compress,c,s]):this.dispatch(e,this._compress,c,s)}getBlobData(e,r,s,n){this._bufferedBytes+=s[A],this._state=sn,e.arrayBuffer().then(i=>{if(this._socket.destroyed){let l=new Error("The socket was closed while the blob was being read");process.nextTick(ft,this,l,n);return}this._bufferedBytes-=s[A];let o=X(i);r?this.dispatch(o,r,s,n):(this._state=I,this.sendFrame(t.frame(o,s),n),this.dequeue())}).catch(i=>{process.nextTick(nn,this,i,n)})}dispatch(e,r,s,n){if(!r){this.sendFrame(t.frame(e,s),n);return}let i=this._extensions[Xt.extensionName];this._bufferedBytes+=s[A],this._state=rn,i.compress(e,s.fin,(o,l)=>{if(this._socket.destroyed){let d=new Error("The socket was closed while data was being compressed");ft(this,d,n);return}this._bufferedBytes-=s[A],this._state=I,s.readOnly=!1,this.sendFrame(t.frame(l,s),n),this.dequeue()})}dequeue(){for(;this._state===I&&this._queue.length;){let e=this._queue.shift();this._bufferedBytes-=e[3][A],Reflect.apply(e[0],this,e.slice(1))}}enqueue(e){this._bufferedBytes+=e[3][A],this._queue.push(e)}sendFrame(e,r){e.length===2?(this._socket.cork(),this._socket.write(e[0]),this._socket.write(e[1],r),this._socket.uncork()):this._socket.write(e[0],r)}};Qt.exports=lt;function ft(t,e,r){typeof r=="function"&&r(e);for(let s=0;s<t._queue.length;s++){let n=t._queue[s],i=n[n.length-1];typeof i=="function"&&i(e)}}a(ft,"callCallbacks");function nn(t,e,r){ft(t,e,r),t.onerror(e)}a(nn,"onError")});var lr=C((Ai,ar)=>{"use strict";var{kForOnEventAttribute:we,kListener:dt}=U(),er=Symbol("kCode"),tr=Symbol("kData"),rr=Symbol("kError"),sr=Symbol("kMessage"),nr=Symbol("kReason"),ue=Symbol("kTarget"),ir=Symbol("kType"),or=Symbol("kWasClean"),W=class{static{a(this,"Event")}constructor(e){this[ue]=null,this[ir]=e}get target(){return this[ue]}get type(){return this[ir]}};Object.defineProperty(W.prototype,"target",{enumerable:!0});Object.defineProperty(W.prototype,"type",{enumerable:!0});var Q=class extends W{static{a(this,"CloseEvent")}constructor(e,r={}){super(e),this[er]=r.code===void 0?0:r.code,this[nr]=r.reason===void 0?"":r.reason,this[or]=r.wasClean===void 0?!1:r.wasClean}get code(){return this[er]}get reason(){return this[nr]}get wasClean(){return this[or]}};Object.defineProperty(Q.prototype,"code",{enumerable:!0});Object.defineProperty(Q.prototype,"reason",{enumerable:!0});Object.defineProperty(Q.prototype,"wasClean",{enumerable:!0});var he=class extends W{static{a(this,"ErrorEvent")}constructor(e,r={}){super(e),this[rr]=r.error===void 0?null:r.error,this[sr]=r.message===void 0?"":r.message}get error(){return this[rr]}get message(){return this[sr]}};Object.defineProperty(he.prototype,"error",{enumerable:!0});Object.defineProperty(he.prototype,"message",{enumerable:!0});var ve=class extends W{static{a(this,"MessageEvent")}constructor(e,r={}){super(e),this[tr]=r.data===void 0?null:r.data}get data(){return this[tr]}};Object.defineProperty(ve.prototype,"data",{enumerable:!0});var on={addEventListener(t,e,r={}){for(let n of this.listeners(t))if(!r[we]&&n[dt]===e&&!n[we])return;let s;if(t==="message")s=a(function(i,o){let l=new ve("message",{data:o?i:i.toString()});l[ue]=this,Me(e,this,l)},"onMessage");else if(t==="close")s=a(function(i,o){let l=new Q("close",{code:i,reason:o.toString(),wasClean:this._closeFrameReceived&&this._closeFrameSent});l[ue]=this,Me(e,this,l)},"onClose");else if(t==="error")s=a(function(i){let o=new he("error",{error:i,message:i.message});o[ue]=this,Me(e,this,o)},"onError");else if(t==="open")s=a(function(){let i=new W("open");i[ue]=this,Me(e,this,i)},"onOpen");else return;s[we]=!!r[we],s[dt]=e,r.once?this.once(t,s):this.on(t,s)},removeEventListener(t,e){for(let r of this.listeners(t))if(r[dt]===e&&!r[we]){this.removeListener(t,r);break}}};ar.exports={CloseEvent:Q,ErrorEvent:he,Event:W,EventTarget:on,MessageEvent:ve};function Me(t,e,r){typeof t=="object"&&t.handleEvent?t.handleEvent.call(t,r):t.call(e,r)}a(Me,"callListener")});var Ue=C((Ri,fr)=>{"use strict";var{tokenChars:xe}=fe();function D(t,e,r){t[e]===void 0?t[e]=[r]:t[e].push(r)}a(D,"push");function an(t){let e=Object.create(null),r=Object.create(null),s=!1,n=!1,i=!1,o,l,d=-1,c=-1,h=-1,f=0;for(;f<t.length;f++)if(c=t.charCodeAt(f),o===void 0)if(h===-1&&xe[c]===1)d===-1&&(d=f);else if(f!==0&&(c===32||c===9))h===-1&&d!==-1&&(h=f);else if(c===59||c===44){if(d===-1)throw new SyntaxError(`Unexpected character at index ${f}`);h===-1&&(h=f);let _=t.slice(d,h);c===44?(D(e,_,r),r=Object.create(null)):o=_,d=h=-1}else throw new SyntaxError(`Unexpected character at index ${f}`);else if(l===void 0)if(h===-1&&xe[c]===1)d===-1&&(d=f);else if(c===32||c===9)h===-1&&d!==-1&&(h=f);else if(c===59||c===44){if(d===-1)throw new SyntaxError(`Unexpected character at index ${f}`);h===-1&&(h=f),D(r,t.slice(d,h),!0),c===44&&(D(e,o,r),r=Object.create(null),o=void 0),d=h=-1}else if(c===61&&d!==-1&&h===-1)l=t.slice(d,f),d=h=-1;else throw new SyntaxError(`Unexpected character at index ${f}`);else if(n){if(xe[c]!==1)throw new SyntaxError(`Unexpected character at index ${f}`);d===-1?d=f:s||(s=!0),n=!1}else if(i)if(xe[c]===1)d===-1&&(d=f);else if(c===34&&d!==-1)i=!1,h=f;else if(c===92)n=!0;else throw new SyntaxError(`Unexpected character at index ${f}`);else if(c===34&&t.charCodeAt(f-1)===61)i=!0;else if(h===-1&&xe[c]===1)d===-1&&(d=f);else if(d!==-1&&(c===32||c===9))h===-1&&(h=f);else if(c===59||c===44){if(d===-1)throw new SyntaxError(`Unexpected character at index ${f}`);h===-1&&(h=f);let _=t.slice(d,h);s&&(_=_.replace(/\\/g,""),s=!1),D(r,l,_),c===44&&(D(e,o,r),r=Object.create(null),o=void 0),l=void 0,d=h=-1}else throw new SyntaxError(`Unexpected character at index ${f}`);if(d===-1||i||c===32||c===9)throw new SyntaxError("Unexpected end of input");h===-1&&(h=f);let m=t.slice(d,h);return o===void 0?D(e,m,r):(l===void 0?D(r,m,!0):s?D(r,l,m.replace(/\\/g,"")):D(r,l,m),D(e,o,r)),e}a(an,"parse");function ln(t){return Object.keys(t).map(e=>{let r=t[e];return Array.isArray(r)||(r=[r]),r.map(s=>[e].concat(Object.keys(s).map(n=>{let i=s[n];return Array.isArray(i)||(i=[i]),i.map(o=>o===!0?n:`${n}=${o}`).join("; ")})).join("; ")).join(", ")}).join(", ")}a(ln,"format");fr.exports={format:ln,parse:an}});var qe=C((Ui,vr)=>{"use strict";var fn=require("events"),cn=require("https"),dn=require("http"),ur=require("net"),un=require("tls"),{randomBytes:hn,createHash:pn}=require("crypto"),{Duplex:ji,Readable:Mi}=require("stream"),{URL:ut}=require("url"),H=le(),mn=at(),_n=ct(),{isBlob:gn}=fe(),{BINARY_TYPES:cr,CLOSE_TIMEOUT:yn,EMPTY_BUFFER:$e,GUID:bn,kForOnEventAttribute:ht,kListener:wn,kStatusCode:vn,kWebSocket:O,NOOP:hr}=U(),{EventTarget:{addEventListener:xn,removeEventListener:kn}}=lr(),{format:Sn,parse:En}=Ue(),{toBuffer:Nn}=ye(),pr=Symbol("kAborted"),pt=[8,13],z=["CONNECTING","OPEN","CLOSING","CLOSED"],On=/^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/,x=class t extends fn{static{a(this,"WebSocket")}constructor(e,r,s){super(),this._binaryType=cr[0],this._closeCode=1006,this._closeFrameReceived=!1,this._closeFrameSent=!1,this._closeMessage=$e,this._closeTimer=null,this._errorEmitted=!1,this._extensions={},this._paused=!1,this._protocol="",this._readyState=t.CONNECTING,this._receiver=null,this._sender=null,this._socket=null,e!==null?(this._bufferedAmount=0,this._isServer=!1,this._redirects=0,r===void 0?!s||s.protocols===void 0?r=[]:Array.isArray(s.protocols)?r=s.protocols:r=[s.protocols]:Array.isArray(r)||(typeof r=="object"&&r!==null?(s=r,s.protocols===void 0?r=[]:Array.isArray(s.protocols)?r=s.protocols:r=[s.protocols]):r=[r]),mr(this,e,r,s)):(this._autoPong=s.autoPong,this._closeTimeout=s.closeTimeout,this._isServer=!0)}get binaryType(){return this._binaryType}set binaryType(e){cr.includes(e)&&(this._binaryType=e,this._receiver&&(this._receiver._binaryType=e))}get bufferedAmount(){return this._socket?this._socket._writableState.length+this._sender._bufferedBytes:this._bufferedAmount}get extensions(){return Object.keys(this._extensions).join()}get isPaused(){return this._paused}get onclose(){return null}get onerror(){return null}get onopen(){return null}get onmessage(){return null}get protocol(){return this._protocol}get readyState(){return this._readyState}get url(){return this._url}setSocket(e,r,s){let n=new mn({allowSynchronousEvents:s.allowSynchronousEvents,binaryType:this.binaryType,extensions:this._extensions,isServer:this._isServer,maxBufferedChunks:s.maxBufferedChunks,maxFragments:s.maxFragments,maxPayload:s.maxPayload,skipUTF8Validation:s.skipUTF8Validation}),i=new _n(e,this._extensions,s.generateMask);this._receiver=n,this._sender=i,this._socket=e,n[O]=this,i[O]=this,e[O]=this,n.on("conclude",Cn),n.on("drain",Fn),n.on("error",Bn),n.on("message",Ln),n.on("ping",An),n.on("pong",In),i.onerror=Rn,e.setTimeout&&e.setTimeout(0),e.setNoDelay&&e.setNoDelay(),r.length>0&&e.unshift(r),e.on("close",yr),e.on("data",ze),e.on("end",br),e.on("error",wr),this._readyState=t.OPEN,this.emit("open")}emitClose(){if(!this._socket){this._readyState=t.CLOSED,this.emit("close",this._closeCode,this._closeMessage);return}this._extensions[H.extensionName]&&this._extensions[H.extensionName].cleanup(),this._receiver.removeAllListeners(),this._readyState=t.CLOSED,this.emit("close",this._closeCode,this._closeMessage)}close(e,r){if(this.readyState!==t.CLOSED){if(this.readyState===t.CONNECTING){F(this,this._req,"WebSocket was closed before the connection was established");return}if(this.readyState===t.CLOSING){this._closeFrameSent&&(this._closeFrameReceived||this._receiver._writableState.errorEmitted)&&this._socket.end();return}this._sender.close(e,r,!this._isServer,s=>{s||(this._closeFrameSent=!0,(this._closeFrameReceived||this._receiver._writableState.errorEmitted)&&this._socket.end())}),this._readyState=t.CLOSING,gr(this)}}pause(){this.readyState===t.CONNECTING||this.readyState===t.CLOSED||(this._paused=!0,this._socket.pause())}ping(e,r,s){if(this.readyState===t.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof e=="function"?(s=e,e=r=void 0):typeof r=="function"&&(s=r,r=void 0),typeof e=="number"&&(e=e.toString()),this.readyState!==t.OPEN){mt(this,e,s);return}r===void 0&&(r=!this._isServer),this._sender.ping(e||$e,r,s)}pong(e,r,s){if(this.readyState===t.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof e=="function"?(s=e,e=r=void 0):typeof r=="function"&&(s=r,r=void 0),typeof e=="number"&&(e=e.toString()),this.readyState!==t.OPEN){mt(this,e,s);return}r===void 0&&(r=!this._isServer),this._sender.pong(e||$e,r,s)}resume(){this.readyState===t.CONNECTING||this.readyState===t.CLOSED||(this._paused=!1,this._receiver._writableState.needDrain||this._socket.resume())}send(e,r,s){if(this.readyState===t.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof r=="function"&&(s=r,r={}),typeof e=="number"&&(e=e.toString()),this.readyState!==t.OPEN){mt(this,e,s);return}let n={binary:typeof e!="string",mask:!this._isServer,compress:!0,fin:!0,...r};this._extensions[H.extensionName]||(n.compress=!1),this._sender.send(e||$e,n,s)}terminate(){if(this.readyState!==t.CLOSED){if(this.readyState===t.CONNECTING){F(this,this._req,"WebSocket was closed before the connection was established");return}this._socket&&(this._readyState=t.CLOSING,this._socket.destroy())}}};Object.defineProperty(x,"CONNECTING",{enumerable:!0,value:z.indexOf("CONNECTING")});Object.defineProperty(x.prototype,"CONNECTING",{enumerable:!0,value:z.indexOf("CONNECTING")});Object.defineProperty(x,"OPEN",{enumerable:!0,value:z.indexOf("OPEN")});Object.defineProperty(x.prototype,"OPEN",{enumerable:!0,value:z.indexOf("OPEN")});Object.defineProperty(x,"CLOSING",{enumerable:!0,value:z.indexOf("CLOSING")});Object.defineProperty(x.prototype,"CLOSING",{enumerable:!0,value:z.indexOf("CLOSING")});Object.defineProperty(x,"CLOSED",{enumerable:!0,value:z.indexOf("CLOSED")});Object.defineProperty(x.prototype,"CLOSED",{enumerable:!0,value:z.indexOf("CLOSED")});["binaryType","bufferedAmount","extensions","isPaused","protocol","readyState","url"].forEach(t=>{Object.defineProperty(x.prototype,t,{enumerable:!0})});["open","error","close","message"].forEach(t=>{Object.defineProperty(x.prototype,`on${t}`,{enumerable:!0,get(){for(let e of this.listeners(t))if(e[ht])return e[wn];return null},set(e){for(let r of this.listeners(t))if(r[ht]){this.removeListener(t,r);break}typeof e=="function"&&this.addEventListener(t,e,{[ht]:!0})}})});x.prototype.addEventListener=xn;x.prototype.removeEventListener=kn;vr.exports=x;function mr(t,e,r,s){let n={allowSynchronousEvents:!0,autoPong:!0,closeTimeout:yn,protocolVersion:pt[1],maxBufferedChunks:262144,maxFragments:16384,maxPayload:104857600,skipUTF8Validation:!1,perMessageDeflate:!0,followRedirects:!1,maxRedirects:10,...s,socketPath:void 0,hostname:void 0,protocol:void 0,protocols:void 0,timeout:void 0,method:"GET",host:void 0,path:void 0,port:void 0};if(t._autoPong=n.autoPong,t._closeTimeout=n.closeTimeout,!pt.includes(n.protocolVersion))throw new RangeError(`Unsupported protocol version: ${n.protocolVersion} (supported versions: ${pt.join(", ")})`);let i;if(e instanceof ut)i=e;else try{i=new ut(e)}catch{throw new SyntaxError(`Invalid URL: ${e}`)}i.protocol==="http:"?i.protocol="ws:":i.protocol==="https:"&&(i.protocol="wss:"),t._url=i.href;let o=i.protocol==="wss:",l=i.protocol==="ws+unix:",d;if(i.protocol!=="ws:"&&!o&&!l?d=`The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`:l&&!i.pathname?d="The URL's pathname is empty":i.hash&&(d="The URL contains a fragment identifier"),d){let y=new SyntaxError(d);if(t._redirects===0)throw y;We(t,y);return}let c=o?443:80,h=hn(16).toString("base64"),f=o?cn.request:dn.request,m=new Set,_;if(n.createConnection=n.createConnection||(o?Pn:Tn),n.defaultPort=n.defaultPort||c,n.port=i.port||c,n.host=i.hostname.startsWith("[")?i.hostname.slice(1,-1):i.hostname,n.headers={...n.headers,"Sec-WebSocket-Version":n.protocolVersion,"Sec-WebSocket-Key":h,Connection:"Upgrade",Upgrade:"websocket"},n.path=i.pathname+i.search,n.timeout=n.handshakeTimeout,n.perMessageDeflate&&(_=new H({...n.perMessageDeflate,isServer:!1,maxPayload:n.maxPayload}),n.headers["Sec-WebSocket-Extensions"]=Sn({[H.extensionName]:_.offer()})),r.length){for(let y of r){if(typeof y!="string"||!On.test(y)||m.has(y))throw new SyntaxError("An invalid or duplicated subprotocol was specified");m.add(y)}n.headers["Sec-WebSocket-Protocol"]=r.join(",")}if(n.origin&&(n.protocolVersion<13?n.headers["Sec-WebSocket-Origin"]=n.origin:n.headers.Origin=n.origin),(i.username||i.password)&&(n.auth=`${i.username}:${i.password}`),l){let y=n.path.split(":");n.socketPath=y[0],n.path=y[1]}let g;if(n.followRedirects){if(t._redirects===0){t._originalIpc=l,t._originalSecure=o,t._originalHostOrSocketPath=l?n.socketPath:i.host;let y=s&&s.headers;if(s={...s,headers:{}},y)for(let[v,M]of Object.entries(y))s.headers[v.toLowerCase()]=M}else if(t.listenerCount("redirect")===0){let y=l?t._originalIpc?n.socketPath===t._originalHostOrSocketPath:!1:t._originalIpc?!1:i.host===t._originalHostOrSocketPath;(!y||t._originalSecure&&!o)&&(delete n.headers.authorization,delete n.headers.cookie,y||delete n.headers.host,n.auth=void 0)}n.auth&&!s.headers.authorization&&(s.headers.authorization="Basic "+Buffer.from(n.auth).toString("base64")),g=t._req=f(n),t._redirects&&t.emit("redirect",t.url,g)}else g=t._req=f(n);n.timeout&&g.on("timeout",()=>{F(t,g,"Opening handshake has timed out")}),g.on("error",y=>{g===null||g[pr]||(g=t._req=null,We(t,y))}),g.on("response",y=>{let v=y.headers.location,M=y.statusCode;if(v&&n.followRedirects&&M>=300&&M<400){if(++t._redirects>n.maxRedirects){F(t,g,"Maximum redirects exceeded");return}g.abort();let K;try{K=new ut(v,e)}catch{let q=new SyntaxError(`Invalid URL: ${v}`);We(t,q);return}mr(t,K,r,s)}else t.emit("unexpected-response",g,y)||F(t,g,`Unexpected server response: ${y.statusCode}`)}),g.on("upgrade",(y,v,M)=>{if(t.emit("upgrade",y),t.readyState!==x.CONNECTING)return;g=t._req=null;let K=y.headers.upgrade;if(K===void 0||K.toLowerCase()!=="websocket"){F(t,v,"Invalid Upgrade header");return}let Pe=pn("sha1").update(h+bn).digest("base64");if(y.headers["sec-websocket-accept"]!==Pe){F(t,v,"Invalid Sec-WebSocket-Accept header");return}let q=y.headers["sec-websocket-protocol"],G;if(q!==void 0?m.size?m.has(q)||(G="Server sent an invalid subprotocol"):G="Server sent a subprotocol but none was requested":m.size&&(G="Server sent no subprotocol"),G){F(t,v,G);return}q&&(t._protocol=q);let u=y.headers["sec-websocket-extensions"];if(u!==void 0){if(!_){F(t,v,"Server sent a Sec-WebSocket-Extensions header but no extension was requested");return}let b;try{b=En(u)}catch{F(t,v,"Invalid Sec-WebSocket-Extensions header");return}let k=Object.keys(b);if(k.length!==1||k[0]!==H.extensionName){F(t,v,"Server indicated an extension that was not requested");return}try{_.accept(b[H.extensionName])}catch{F(t,v,"Invalid Sec-WebSocket-Extensions header");return}t._extensions[H.extensionName]=_}t.setSocket(v,M,{allowSynchronousEvents:n.allowSynchronousEvents,generateMask:n.generateMask,maxBufferedChunks:n.maxBufferedChunks,maxFragments:n.maxFragments,maxPayload:n.maxPayload,skipUTF8Validation:n.skipUTF8Validation})}),n.finishRequest?n.finishRequest(g,t):g.end()}a(mr,"initAsClient");function We(t,e){t._readyState=x.CLOSING,t._errorEmitted=!0,t.emit("error",e),t.emitClose()}a(We,"emitErrorAndClose");function Tn(t){return t.path=t.socketPath,ur.connect(t)}a(Tn,"netConnect");function Pn(t){return t.path=void 0,!t.servername&&t.servername!==""&&(t.servername=ur.isIP(t.host)?"":t.host),un.connect(t)}a(Pn,"tlsConnect");function F(t,e,r){t._readyState=x.CLOSING;let s=new Error(r);Error.captureStackTrace(s,F),e.setHeader?(e[pr]=!0,e.abort(),e.socket&&!e.socket.destroyed&&e.socket.destroy(),process.nextTick(We,t,s)):(e.destroy(s),e.once("error",t.emit.bind(t,"error")),e.once("close",t.emitClose.bind(t)))}a(F,"abortHandshake");function mt(t,e,r){if(e){let s=gn(e)?e.size:Nn(e).length;t._socket?t._sender._bufferedBytes+=s:t._bufferedAmount+=s}if(r){let s=new Error(`WebSocket is not open: readyState ${t.readyState} (${z[t.readyState]})`);process.nextTick(r,s)}}a(mt,"sendAfterClose");function Cn(t,e){let r=this[O];r._closeFrameReceived=!0,r._closeMessage=e,r._closeCode=t,r._socket[O]!==void 0&&(r._socket.removeListener("data",ze),process.nextTick(_r,r._socket),t===1005?r.close():r.close(t,e))}a(Cn,"receiverOnConclude");function Fn(){let t=this[O];t.isPaused||t._socket.resume()}a(Fn,"receiverOnDrain");function Bn(t){let e=this[O];e._socket[O]!==void 0&&(e._socket.removeListener("data",ze),process.nextTick(_r,e._socket),e.close(t[vn])),e._errorEmitted||(e._errorEmitted=!0,e.emit("error",t))}a(Bn,"receiverOnError");function dr(){this[O].emitClose()}a(dr,"receiverOnFinish");function Ln(t,e){this[O].emit("message",t,e)}a(Ln,"receiverOnMessage");function An(t){let e=this[O];e._autoPong&&e.pong(t,!this._isServer,hr),e.emit("ping",t)}a(An,"receiverOnPing");function In(t){this[O].emit("pong",t)}a(In,"receiverOnPong");function _r(t){t.resume()}a(_r,"resume");function Rn(t){let e=this[O];e.readyState!==x.CLOSED&&(e.readyState===x.OPEN&&(e._readyState=x.CLOSING,gr(e)),this._socket.end(),e._errorEmitted||(e._errorEmitted=!0,e.emit("error",t)))}a(Rn,"senderOnError");function gr(t){t._closeTimer=setTimeout(t._socket.destroy.bind(t._socket),t._closeTimeout)}a(gr,"setCloseTimer");function yr(){let t=this[O];if(this.removeListener("close",yr),this.removeListener("data",ze),this.removeListener("end",br),t._readyState=x.CLOSING,!this._readableState.endEmitted&&!t._closeFrameReceived&&!t._receiver._writableState.errorEmitted&&this._readableState.length!==0){let e=this.read(this._readableState.length);t._receiver.write(e)}t._receiver.end(),this[O]=void 0,clearTimeout(t._closeTimer),t._receiver._writableState.finished||t._receiver._writableState.errorEmitted?t.emitClose():(t._receiver.on("error",dr),t._receiver.on("finish",dr))}a(yr,"socketOnClose");function ze(t){this[O]._receiver.write(t)||this.pause()}a(ze,"socketOnData");function br(){let t=this[O];t._readyState=x.CLOSING,t._receiver.end(),this.end()}a(br,"socketOnEnd");function wr(){let t=this[O];this.removeListener("error",wr),this.on("error",hr),t&&(t._readyState=x.CLOSING,this.destroy())}a(wr,"socketOnError")});var Er=C((zi,Sr)=>{"use strict";var Wi=qe(),{Duplex:Dn}=require("stream");function xr(t){t.emit("close")}a(xr,"emitClose");function jn(){!this.destroyed&&this._writableState.finished&&this.destroy()}a(jn,"duplexOnEnd");function kr(t){this.removeListener("error",kr),this.destroy(),this.listenerCount("error")===0&&this.emit("error",t)}a(kr,"duplexOnError");function Mn(t,e){let r=!0,s=new Dn({...e,autoDestroy:!1,emitClose:!1,objectMode:!1,writableObjectMode:!1});return t.on("message",a(function(i,o){let l=!o&&s._readableState.objectMode?i.toString():i;s.push(l)||t.pause()},"message")),t.once("error",a(function(i){s.destroyed||(r=!1,s.destroy(i))},"error")),t.once("close",a(function(){s.destroyed||s.push(null)},"close")),s._destroy=function(n,i){if(t.readyState===t.CLOSED){i(n),process.nextTick(xr,s);return}let o=!1;t.once("error",a(function(d){o=!0,i(d)},"error")),t.once("close",a(function(){o||i(n),process.nextTick(xr,s)},"close")),r&&t.terminate()},s._final=function(n){if(t.readyState===t.CONNECTING){t.once("open",a(function(){s._final(n)},"open"));return}t._socket!==null&&(t._socket._writableState.finished?(n(),s._readableState.endEmitted&&s.destroy()):(t._socket.once("finish",a(function(){n()},"finish")),t.close()))},s._read=function(){t.isPaused&&t.resume()},s._write=function(n,i,o){if(t.readyState===t.CONNECTING){t.once("open",a(function(){s._write(n,i,o)},"open"));return}t.send(n,o)},s.on("end",jn),s.on("error",kr),s}a(Mn,"createWebSocketStream");Sr.exports=Mn});var _t=C((Gi,Nr)=>{"use strict";var{tokenChars:Un}=fe();function $n(t){let e=new Set,r=-1,s=-1,n=0;for(n;n<t.length;n++){let o=t.charCodeAt(n);if(s===-1&&Un[o]===1)r===-1&&(r=n);else if(n!==0&&(o===32||o===9))s===-1&&r!==-1&&(s=n);else if(o===44){if(r===-1)throw new SyntaxError(`Unexpected character at index ${n}`);s===-1&&(s=n);let l=t.slice(r,s);if(e.has(l))throw new SyntaxError(`The "${l}" subprotocol is duplicated`);e.add(l),r=s=-1}else throw new SyntaxError(`Unexpected character at index ${n}`)}if(r===-1||s!==-1)throw new SyntaxError("Unexpected end of input");let i=t.slice(r,n);if(e.has(i))throw new SyntaxError(`The "${i}" subprotocol is duplicated`);return e.add(i),e}a($n,"parse");Nr.exports={parse:$n}});var Lr=C((Yi,Br)=>{"use strict";var Wn=require("events"),Ge=require("http"),{Duplex:Hi}=require("stream"),{createHash:zn}=require("crypto"),Or=Ue(),ee=le(),qn=_t(),Gn=qe(),{CLOSE_TIMEOUT:Vn,GUID:Hn,kWebSocket:Yn}=U(),Kn=/^[+/0-9A-Za-z]{22}==$/,Tr=0,Pr=1,Fr=2,gt=class extends Wn{static{a(this,"WebSocketServer")}constructor(e,r){if(super(),e={allowSynchronousEvents:!0,autoPong:!0,maxBufferedChunks:256*1024,maxFragments:16*1024,maxPayload:100*1024*1024,skipUTF8Validation:!1,perMessageDeflate:!1,handleProtocols:null,clientTracking:!0,closeTimeout:Vn,verifyClient:null,noServer:!1,backlog:null,server:null,host:null,path:null,port:null,WebSocket:Gn,...e},e.port==null&&!e.server&&!e.noServer||e.port!=null&&(e.server||e.noServer)||e.server&&e.noServer)throw new TypeError('One and only one of the "port", "server", or "noServer" options must be specified');if(e.port!=null?(this._server=Ge.createServer((s,n)=>{let i=Ge.STATUS_CODES[426];n.writeHead(426,{"Content-Length":i.length,"Content-Type":"text/plain"}),n.end(i)}),this._server.listen(e.port,e.host,e.backlog,r)):e.server&&(this._server=e.server),this._server){let s=this.emit.bind(this,"connection");this._removeListeners=Jn(this._server,{listening:this.emit.bind(this,"listening"),error:this.emit.bind(this,"error"),upgrade:a((n,i,o)=>{this.handleUpgrade(n,i,o,s)},"upgrade")})}e.perMessageDeflate===!0&&(e.perMessageDeflate={}),e.clientTracking&&(this.clients=new Set,this._shouldEmitClose=!1),this.options=e,this._state=Tr}address(){if(this.options.noServer)throw new Error('The server is operating in "noServer" mode');return this._server?this._server.address():null}close(e){if(this._state===Fr){e&&this.once("close",()=>{e(new Error("The server is not running"))}),process.nextTick(ke,this);return}if(e&&this.once("close",e),this._state!==Pr)if(this._state=Pr,this.options.noServer||this.options.server)this._server&&(this._removeListeners(),this._removeListeners=this._server=null),this.clients?this.clients.size?this._shouldEmitClose=!0:process.nextTick(ke,this):process.nextTick(ke,this);else{let r=this._server;this._removeListeners(),this._removeListeners=this._server=null,r.close(()=>{ke(this)})}}shouldHandle(e){if(this.options.path){let r=e.url.indexOf("?");if((r!==-1?e.url.slice(0,r):e.url)!==this.options.path)return!1}return!0}handleUpgrade(e,r,s,n){r.on("error",Cr);let i=e.headers["sec-websocket-key"],o=e.headers.upgrade,l=+e.headers["sec-websocket-version"];if(e.method!=="GET"){te(this,e,r,405,"Invalid HTTP method");return}if(o===void 0||o.toLowerCase()!=="websocket"){te(this,e,r,400,"Invalid Upgrade header");return}if(i===void 0||!Kn.test(i)){te(this,e,r,400,"Missing or invalid Sec-WebSocket-Key header");return}if(l!==13&&l!==8){te(this,e,r,400,"Missing or invalid Sec-WebSocket-Version header",{"Sec-WebSocket-Version":"13, 8"});return}if(!this.shouldHandle(e)){Se(r,400);return}let d=e.headers["sec-websocket-protocol"],c=new Set;if(d!==void 0)try{c=qn.parse(d)}catch{te(this,e,r,400,"Invalid Sec-WebSocket-Protocol header");return}let h=e.headers["sec-websocket-extensions"],f={};if(this.options.perMessageDeflate&&h!==void 0){let m=new ee({...this.options.perMessageDeflate,isServer:!0,maxPayload:this.options.maxPayload});try{let _=Or.parse(h);_[ee.extensionName]&&(m.accept(_[ee.extensionName]),f[ee.extensionName]=m)}catch{te(this,e,r,400,"Invalid or unacceptable Sec-WebSocket-Extensions header");return}}if(this.options.verifyClient){let m={origin:e.headers[`${l===8?"sec-websocket-origin":"origin"}`],secure:!!(e.socket.authorized||e.socket.encrypted),req:e};if(this.options.verifyClient.length===2){this.options.verifyClient(m,(_,g,y,v)=>{if(!_)return Se(r,g||401,y,v);this.completeUpgrade(f,i,c,e,r,s,n)});return}if(!this.options.verifyClient(m))return Se(r,401)}this.completeUpgrade(f,i,c,e,r,s,n)}completeUpgrade(e,r,s,n,i,o,l){if(!i.readable||!i.writable)return i.destroy();if(i[Yn])throw new Error("server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration");if(this._state>Tr)return Se(i,503);let c=["HTTP/1.1 101 Switching Protocols","Upgrade: websocket","Connection: Upgrade",`Sec-WebSocket-Accept: ${zn("sha1").update(r+Hn).digest("base64")}`],h=new this.options.WebSocket(null,void 0,this.options);if(s.size){let f=this.options.handleProtocols?this.options.handleProtocols(s,n):s.values().next().value;f&&(c.push(`Sec-WebSocket-Protocol: ${f}`),h._protocol=f)}if(e[ee.extensionName]){let f=e[ee.extensionName].params,m=Or.format({[ee.extensionName]:[f]});c.push(`Sec-WebSocket-Extensions: ${m}`),h._extensions=e}this.emit("headers",c,n),i.write(c.concat(`\r
`).join(`\r
`)),i.removeListener("error",Cr),h.setSocket(i,o,{allowSynchronousEvents:this.options.allowSynchronousEvents,maxBufferedChunks:this.options.maxBufferedChunks,maxFragments:this.options.maxFragments,maxPayload:this.options.maxPayload,skipUTF8Validation:this.options.skipUTF8Validation}),this.clients&&(this.clients.add(h),h.on("close",()=>{this.clients.delete(h),this._shouldEmitClose&&!this.clients.size&&process.nextTick(ke,this)})),l(h,n)}};Br.exports=gt;function Jn(t,e){for(let r of Object.keys(e))t.on(r,e[r]);return a(function(){for(let s of Object.keys(e))t.removeListener(s,e[s])},"removeListeners")}a(Jn,"addListeners");function ke(t){t._state=Fr,t.emit("close")}a(ke,"emitClose");function Cr(){this.destroy()}a(Cr,"socketOnError");function Se(t,e,r,s){r=r||Ge.STATUS_CODES[e],s={Connection:"close","Content-Type":"text/html","Content-Length":Buffer.byteLength(r),...s},t.once("finish",t.destroy),t.end(`HTTP/1.1 ${e} ${Ge.STATUS_CODES[e]}\r
`+Object.keys(s).map(n=>`${n}: ${s[n]}`).join(`\r
`)+`\r
\r
`+r)}a(Se,"abortHandshake");function te(t,e,r,s,n,i){if(t.listenerCount("wsClientError")){let o=new Error(n);Error.captureStackTrace(o,te),t.emit("wsClientError",o,r,e)}else Se(r,s,n,i)}a(te,"abortHandshakeOrEmitwsClientError")});var $r={};Os($r,{PerMessageDeflate:()=>Rr.default,Receiver:()=>Dr.default,Sender:()=>jr.default,WebSocket:()=>yt.default,WebSocketServer:()=>Ur.default,createWebSocketStream:()=>Ar.default,default:()=>Xn,extension:()=>Ir.default,subprotocol:()=>Mr.default});var Ar,Ir,Rr,Dr,jr,Mr,yt,Ur,Xn,Wr=Ns(()=>{Ar=T(Er(),1),Ir=T(Ue(),1),Rr=T(le(),1),Dr=T(at(),1),jr=T(ct(),1),Mr=T(_t(),1),yt=T(qe(),1),Ur=T(Lr(),1),Xn=yt.default});var Ke="https://evn-notebook.invalid/pyodide/",ie=class extends Error{static{a(this,"NetworkBlocked")}constructor(e){super(`NetworkBlocked: ${e} is blocked: the notebook makes no network requests`),this.name="NetworkBlocked"}toString(){return this.message}},Ps=["fetch","XMLHttpRequest","WebSocket","EventSource","WebTransport","importScripts","Worker","SharedWorker","FontFace"],ge=a(t=>String(t&&typeof t=="object"&&"url"in t?t.url:t),"urlOf");function Je(t,e){let r=a(function(s){throw new ie(e&&s!==void 0?`${t}(${ge(s)})`:t)},"f");return Object.defineProperty(r,"name",{value:t}),r}a(Je,"blocker");function Tt(){let t={};for(let e of Ps)t[e]=Je(e,e!=="XMLHttpRequest");return t}a(Tt,"blockingStubs");function Pt(t){let e={},r,s=Tt(),n=a(f=>{let m=typeof f.body=="string"||f.body instanceof Uint8Array?f.body:new Uint8Array(f.body);return new Response(m,{status:200,headers:{"Content-Type":f.type}})},"respond"),i=a(function(m){let _=ge(m);if(_.startsWith(Ke)){let g=_.slice(Ke.length),y=e[g];if(y)return Promise.resolve(n(y));let v=r?.(g);if(v)return v.then(n)}throw new ie(`fetch(${_})`)},"fetch"),o=[];for(let f=Object.getPrototypeOf(t);f&&f!==Object.prototype;f=Object.getPrototypeOf(f))o.push(f);let l=a((f,m,_)=>{try{Object.defineProperty(f,m,{value:_,writable:!1,configurable:!1,enumerable:!1})}catch{try{f[m]=_}catch{}}},"defineOn"),d=a((f,m)=>{l(t,f,m);for(let _ of o)Object.prototype.hasOwnProperty.call(_,f)&&l(_,f,m)},"define"),c=typeof t.importScripts=="function"?t.importScripts.bind(t):void 0;d("fetch",i);for(let f of["XMLHttpRequest","WebSocket","EventSource","WebTransport","Worker","SharedWorker","FontFace"])d(f,s[f]);if("fonts"in t){let f={add:Je("fonts.add",!1),load:Je("fonts.load",!1),check:a(()=>!1,"check")};d("fonts",f)}let h=t.Cache;if(h&&h.prototype){let f=a(g=>ge(g).startsWith(Ke),"ownUrl"),m=h.prototype.add,_=h.prototype.addAll;typeof m=="function"&&(h.prototype.add=function(g){return f(g)?m.call(this,g):Promise.reject(new ie(`Cache.add(${ge(g)})`))}),typeof _=="function"&&(h.prototype.addAll=function(g){let y=Array.from(g||[]).find(v=>!f(v));return y!==void 0?Promise.reject(new ie(`Cache.addAll(${ge(y)})`)):_.call(this,g)})}return{serve(f){Object.assign(e,f)},provide(f){r=f},closeImportScripts(){c&&d("importScripts",s.importScripts)},importScripts:c}}a(Pt,"installNetworkGuard");function Ct(t){let e=["setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","Array","Object","Date","WeakRef","Math","JSON","console","eval","Promise","Error","TypeError","RangeError","Symbol","Number","String","Boolean","BigInt","Map","Set","WeakMap","Reflect","Proxy","ArrayBuffer","DataView","Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array","BigInt64Array","BigUint64Array","TextEncoder","TextDecoder","FinalizationRegistry","AbortController","AbortSignal","Headers","Request","Response","Blob","URL","performance","structuredClone","isNaN","isFinite","parseInt","parseFloat"],r={};for(let s of e)t[s]!==void 0&&(r[s]=typeof t[s]=="function"&&/^[a-z]/.test(s)&&s!=="eval"?t[s].bind(t):t[s]);return Object.assign(r,Tt()),r}a(Ct,"jsGlobals");var Fe=Pt(globalThis);var ws=require("worker_threads");var Zn=Object.defineProperty,p=a((t,e)=>Zn(t,"name",{value:e,configurable:!0}),"o"),qr=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:a((e,r)=>(typeof require<"u"?require:e)[r],"get")}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+t+'" is not supported')}),Qn=(()=>{for(var t=new Uint8Array(128),e=0;e<64;e++)t[e<26?e+65:e<52?e+71:e<62?e-4:e*4-205]=e;return r=>{for(var s=r.length,n=new Uint8Array((s-(r[s-1]=="=")-(r[s-2]=="="))*3/4|0),i=0,o=0;i<s;){var l=t[r.charCodeAt(i++)],d=t[r.charCodeAt(i++)],c=t[r.charCodeAt(i++)],h=t[r.charCodeAt(i++)];n[o++]=l<<2|d>>4,n[o++]=d<<4|c>>2,n[o++]=c<<6|h}return n}})();function Gr(t){return!isNaN(parseFloat(t))&&isFinite(t)}a(Gr,"se");p(Gr,"_isNumber");function Y(t){return t.charAt(0).toUpperCase()+t.substring(1)}a(Y,"S");p(Y,"_capitalize");function He(t){return function(){return this[t]}}a(He,"L");p(He,"_getter");var pe=["isConstructor","isEval","isNative","isToplevel"],me=["columnNumber","lineNumber"],_e=["fileName","functionName","source"],ei=["args"],ti=["evalOrigin"],Ve=pe.concat(me,_e,ei,ti);function B(t){if(t)for(var e=0;e<Ve.length;e++)t[Ve[e]]!==void 0&&this["set"+Y(Ve[e])](t[Ve[e]])}a(B,"p");p(B,"StackFrame");B.prototype={getArgs:p(function(){return this.args},"getArgs"),setArgs:p(function(t){if(Object.prototype.toString.call(t)!=="[object Array]")throw new TypeError("Args must be an Array");this.args=t},"setArgs"),getEvalOrigin:p(function(){return this.evalOrigin},"getEvalOrigin"),setEvalOrigin:p(function(t){if(t instanceof B)this.evalOrigin=t;else if(t instanceof Object)this.evalOrigin=new B(t);else throw new TypeError("Eval Origin must be an Object or StackFrame")},"setEvalOrigin"),toString:p(function(){var t=this.getFileName()||"",e=this.getLineNumber()||"",r=this.getColumnNumber()||"",s=this.getFunctionName()||"";return this.getIsEval()?t?"[eval] ("+t+":"+e+":"+r+")":"[eval]:"+e+":"+r:s?s+" ("+t+":"+e+":"+r+")":t+":"+e+":"+r},"toString")};B.fromString=p(function(t){var e=t.indexOf("("),r=t.lastIndexOf(")"),s=t.substring(0,e),n=t.substring(e+1,r).split(","),i=t.substring(r+1);if(i.indexOf("@")===0)var o=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(i,""),l=o[1],d=o[2],c=o[3];return new B({functionName:s,args:n||void 0,fileName:l,lineNumber:d||void 0,columnNumber:c||void 0})},"StackFrame$$fromString");for(re=0;re<pe.length;re++)B.prototype["get"+Y(pe[re])]=He(pe[re]),B.prototype["set"+Y(pe[re])]=(function(t){return function(e){this[t]=!!e}})(pe[re]);var re;for(se=0;se<me.length;se++)B.prototype["get"+Y(me[se])]=He(me[se]),B.prototype["set"+Y(me[se])]=(function(t){return function(e){if(!Gr(e))throw new TypeError(t+" must be a Number");this[t]=Number(e)}})(me[se]);var se;for(ne=0;ne<_e.length;ne++)B.prototype["get"+Y(_e[ne])]=He(_e[ne]),B.prototype["set"+Y(_e[ne])]=(function(t){return function(e){this[t]=String(e)}})(_e[ne]);var ne,bt=B;function Vr(){var t=/^\s*at .*(\S+:\d+|\(native\))/m,e=/^(eval@)?(\[native code])?$/;return{parse:p(function(r){if(r.stack&&r.stack.match(t))return this.parseV8OrIE(r);if(r.stack)return this.parseFFOrSafari(r);throw new Error("Cannot parse given Error object")},"ErrorStackParser$$parse"),extractLocation:p(function(r){if(r.indexOf(":")===-1)return[r];var s=/(.+?)(?::(\d+))?(?::(\d+))?$/,n=s.exec(r.replace(/[()]/g,""));return[n[1],n[2]||void 0,n[3]||void 0]},"ErrorStackParser$$extractLocation"),parseV8OrIE:p(function(r){var s=r.stack.split(`
`).filter(function(n){return!!n.match(t)},this);return s.map(function(n){n.indexOf("(eval ")>-1&&(n=n.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(,.*$)/g,""));var i=n.replace(/^\s+/,"").replace(/\(eval code/g,"(").replace(/^.*?\s+/,""),o=i.match(/ (\(.+\)$)/);i=o?i.replace(o[0],""):i;var l=this.extractLocation(o?o[1]:i),d=o&&i||void 0,c=["eval","<anonymous>"].indexOf(l[0])>-1?void 0:l[0];return new bt({functionName:d,fileName:c,lineNumber:l[1],columnNumber:l[2],source:n})},this)},"ErrorStackParser$$parseV8OrIE"),parseFFOrSafari:p(function(r){var s=r.stack.split(`
`).filter(function(n){return!n.match(e)},this);return s.map(function(n){if(n.indexOf(" > eval")>-1&&(n=n.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),n.indexOf("@")===-1&&n.indexOf(":")===-1)return new bt({functionName:n});var i=/((.*".+"[^@]*)?[^@]*)(?:@)/,o=n.match(i),l=o&&o[1]?o[1]:void 0,d=this.extractLocation(n.replace(i,""));return new bt({functionName:l,fileName:d[0],lineNumber:d[1],columnNumber:d[2],source:n})},this)},"ErrorStackParser$$parseFFOrSafari")}}a(Vr,"le");p(Vr,"ErrorStackParser");var ri=new Vr,si=ri,j=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser,Hr=j&&typeof module<"u"&&typeof module.exports<"u"&&typeof qr<"u"&&typeof __dirname<"u",ni=j&&!Hr,Ji=typeof globalThis.Bun<"u",ii=typeof Deno<"u",Yr=!j&&!ii,oi=Yr&&typeof window=="object"&&typeof document=="object"&&typeof document.createElement=="function"&&"sessionStorage"in window&&typeof importScripts!="function",ai=Yr&&typeof importScripts=="function"&&typeof self=="object",Xi=typeof navigator=="object"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome")==-1&&navigator.userAgent.indexOf("Safari")>-1,Ye=typeof read=="function"&&typeof load=="function",Kr,vt,Jr,zr,xt;async function kt(){if(!j||(Kr=(await import("node:url")).default,zr=await import("node:fs"),xt=await import("node:fs/promises"),Jr=(await import("node:vm")).default,vt=await import("node:path"),St=vt.sep,typeof qr<"u"))return;let t=zr,e=await import("node:crypto"),r=await Promise.resolve().then(()=>(Wr(),$r)),s=await import("node:child_process"),n={fs:t,crypto:e,ws:r,child_process:s};globalThis.require=function(i){return n[i]}}a(kt,"C");p(kt,"initNodeModules");function Xr(t,e){return vt.resolve(e||".",t)}a(Xr,"fe");p(Xr,"node_resolvePath");function Zr(t,e){return e===void 0&&(e=location),new URL(t,e).toString()}a(Zr,"me");p(Zr,"browser_resolvePath");var Oe;j?Oe=Xr:Ye?Oe=p(t=>t,"resolvePath"):Oe=Zr;var St;j||(St="/");function Qr(t,e){return t.startsWith("file://")&&(t=t.slice(7)),t.includes("://")?{response:fetch(t)}:{binary:xt.readFile(t).then(r=>new Uint8Array(r.buffer,r.byteOffset,r.byteLength))}}a(Qr,"pe");p(Qr,"node_getBinaryResponse");function es(t,e){if(t.startsWith("file://")&&(t=t.slice(7)),t.includes("://"))throw new Error("Shell cannot fetch urls");return{binary:Promise.resolve(new Uint8Array(readbuffer(t)))}}a(es,"ge");p(es,"shell_getBinaryResponse");function ts(t,e){let r=new URL(t,location);return{response:fetch(r,e?{integrity:e}:{})}}a(ts,"ye");p(ts,"browser_getBinaryResponse");var Te;j?Te=Qr:Ye?Te=es:Te=ts;async function rs(t,e){let{response:r,binary:s}=Te(t,e);if(s)return s;let n=await r;if(!n.ok)throw new Error(`Failed to load '${t}': request failed.`);return new Uint8Array(await n.arrayBuffer())}a(rs,"K");p(rs,"loadBinaryFile");var Ee;if(oi)Ee=p(async t=>await import(t),"loadScript");else if(ai)Ee=p(async t=>{try{globalThis.importScripts(t)}catch(e){if(e instanceof TypeError)await import(t);else throw e}},"loadScript");else if(j)Ee=ss;else if(Ye)Ee=load;else throw new Error("Cannot determine runtime environment");async function ss(t){t.startsWith("file://")&&(t=t.slice(7)),t.includes("://")?Jr.runInThisContext(await(await fetch(t)).text()):await import(Kr.pathToFileURL(t).href)}a(ss,"be");p(ss,"nodeLoadScript");async function ns(t){if(j){await kt();let e=await xt.readFile(t,{encoding:"utf8"});return JSON.parse(e)}else if(Ye){let e=read(t);return JSON.parse(e)}else return await(await fetch(t)).json()}a(ns,"G");p(ns,"loadLockFile");async function is(){if(Hr)return __dirname;let t;try{throw new Error}catch(s){t=s}let e=si.parse(t)[0].fileName;if(j&&!e.startsWith("file://")&&(e=`file://${e}`),ni){let s=await import("node:path");return(await import("node:url")).fileURLToPath(s.dirname(e))}let r=e.lastIndexOf(St);if(r===-1)throw new Error("Could not extract indexURL path from pyodide module location");return e.slice(0,r)}a(is,"X");p(is,"calculateDirname");function os(t){return t.substring(0,t.lastIndexOf("/")+1)||globalThis.location?.toString()||"."}a(os,"Q");p(os,"calculateInstallBaseUrl");function as(t){let e=t.FS,r=t.FS.filesystems.MEMFS,s=t.PATH,n={DIR_MODE:16895,FILE_MODE:33279,mount:p(function(i){if(!i.opts.fileSystemHandle)throw new Error("opts.fileSystemHandle is required");return r.mount.apply(null,arguments)},"mount"),syncfs:p(async(i,o,l)=>{try{let d=n.getLocalSet(i),c=await n.getRemoteSet(i),h=o?c:d,f=o?d:c;await n.reconcile(i,h,f),l(null)}catch(d){l(d)}},"syncfs"),getLocalSet:p(i=>{let o=Object.create(null);function l(h){return h!=="."&&h!==".."}a(l,"c"),p(l,"isRealDir");function d(h){return f=>s.join2(h,f)}a(d,"l"),p(d,"toAbsolute");let c=e.readdir(i.mountpoint).filter(l).map(d(i.mountpoint));for(;c.length;){let h=c.pop(),f=e.stat(h);e.isDir(f.mode)&&c.push.apply(c,e.readdir(h).filter(l).map(d(h))),o[h]={timestamp:f.mtime,mode:f.mode}}return{type:"local",entries:o}},"getLocalSet"),getRemoteSet:p(async i=>{let o=Object.create(null),l=await li(i.opts.fileSystemHandle);for(let[d,c]of l)d!=="."&&(o[s.join2(i.mountpoint,d)]={timestamp:c.kind==="file"?new Date((await c.getFile()).lastModified):new Date,mode:c.kind==="file"?n.FILE_MODE:n.DIR_MODE});return{type:"remote",entries:o,handles:l}},"getRemoteSet"),loadLocalEntry:p(i=>{let o=e.lookupPath(i).node,l=e.stat(i);if(e.isDir(l.mode))return{timestamp:l.mtime,mode:l.mode};if(e.isFile(l.mode))return o.contents=r.getFileDataAsTypedArray(o),{timestamp:l.mtime,mode:l.mode,contents:o.contents};throw new Error("node type not supported")},"loadLocalEntry"),storeLocalEntry:p((i,o)=>{if(e.isDir(o.mode))e.mkdirTree(i,o.mode);else if(e.isFile(o.mode))e.writeFile(i,o.contents,{canOwn:!0});else throw new Error("node type not supported");e.chmod(i,o.mode),e.utime(i,o.timestamp,o.timestamp)},"storeLocalEntry"),removeLocalEntry:p(i=>{var o=e.stat(i);e.isDir(o.mode)?e.rmdir(i):e.isFile(o.mode)&&e.unlink(i)},"removeLocalEntry"),loadRemoteEntry:p(async i=>{if(i.kind==="file"){let o=await i.getFile();return{contents:new Uint8Array(await o.arrayBuffer()),mode:n.FILE_MODE,timestamp:new Date(o.lastModified)}}else{if(i.kind==="directory")return{mode:n.DIR_MODE,timestamp:new Date};throw new Error("unknown kind: "+i.kind)}},"loadRemoteEntry"),storeRemoteEntry:p(async(i,o,l)=>{let d=i.get(s.dirname(o)),c=e.isFile(l.mode)?await d.getFileHandle(s.basename(o),{create:!0}):await d.getDirectoryHandle(s.basename(o),{create:!0});if(c.kind==="file"){let h=await c.createWritable();await h.write(l.contents),await h.close()}i.set(o,c)},"storeRemoteEntry"),removeRemoteEntry:p(async(i,o)=>{await i.get(s.dirname(o)).removeEntry(s.basename(o)),i.delete(o)},"removeRemoteEntry"),reconcile:p(async(i,o,l)=>{let d=0,c=[];Object.keys(o.entries).forEach(function(m){let _=o.entries[m],g=l.entries[m];(!g||e.isFile(_.mode)&&_.timestamp.getTime()>g.timestamp.getTime())&&(c.push(m),d++)}),c.sort();let h=[];if(Object.keys(l.entries).forEach(function(m){o.entries[m]||(h.push(m),d++)}),h.sort().reverse(),!d)return;let f=o.type==="remote"?o.handles:l.handles;for(let m of c){let _=s.normalize(m.replace(i.mountpoint,"/")).substring(1);if(l.type==="local"){let g=f.get(_),y=await n.loadRemoteEntry(g);n.storeLocalEntry(m,y)}else{let g=n.loadLocalEntry(m);await n.storeRemoteEntry(f,_,g)}}for(let m of h)if(l.type==="local")n.removeLocalEntry(m);else{let _=s.normalize(m.replace(i.mountpoint,"/")).substring(1);await n.removeRemoteEntry(f,_)}},"reconcile")};t.FS.filesystems.NATIVEFS_ASYNC=n}a(as,"Z");p(as,"initializeNativeFS");var li=p(async t=>{let e=[];async function r(n){for await(let i of n.values())e.push(i),i.kind==="directory"&&await r(i)}a(r,"r"),p(r,"collect"),await r(t);let s=new Map;s.set(".",t);for(let n of e){let i=(await t.resolve(n)).join("/");s.set(i,n)}return s},"getFsHandles"),fi=Qn("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECByECD2NyZWF0ZV9zZW50aW5lbAAAC2lzX3NlbnRpbmVsAAEKEwIHAPsBAPsbCwkAIAD7GvsUAAs="),ci=(async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&typeof navigator.maxTouchPoints<"u"&&navigator.maxTouchPoints>1)))try{let t=await WebAssembly.compile(fi);return await WebAssembly.instantiate(t)}catch(t){if(t instanceof WebAssembly.CompileError)return;throw t}})();async function ls(){let t=await ci;if(t)return t.exports;let e=Symbol("error marker");return{create_sentinel:p(()=>e,"create_sentinel"),is_sentinel:p(r=>r===e,"is_sentinel")}}a(ls,"te");p(ls,"getSentinelImport");function fs(t){let e={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:ms(t),print:t.stdout,printErr:t.stderr,onExit(r){e.exitCode=r},thisProgram:t._sysExecutable,arguments:t.args,API:{config:t},locateFile:p(r=>t.indexURL+r,"locateFile"),instantiateWasm:_s(t.indexURL)};return e}a(fs,"ne");p(fs,"createSettings");function cs(t){return function(e){let r="/";try{e.FS.mkdirTree(t)}catch(s){console.error(`Error occurred while making a home directory '${t}':`),console.error(s),console.error(`Using '${r}' for a home directory instead`),t=r}e.FS.chdir(t)}}a(cs,"we");p(cs,"createHomeDirectory");function ds(t){return function(e){Object.assign(e.ENV,t)}}a(ds,"Ee");p(ds,"setEnvironment");function us(t){return t?[async e=>{e.addRunDependency("fsInitHook");try{await t(e.FS,{sitePackages:e.API.sitePackages})}finally{e.removeRunDependency("fsInitHook")}}]:[]}a(us,"Pe");p(us,"callFsInitHook");function hs(t){let e=t.HEAPU32[t._Py_Version>>>2],r=e>>>24&255,s=e>>>16&255,n=e>>>8&255;return[r,s,n]}a(hs,"ke");p(hs,"computeVersionTuple");function ps(t){let e=rs(t);return async r=>{r.API.pyVersionTuple=hs(r);let[s,n]=r.API.pyVersionTuple;r.FS.mkdirTree("/lib"),r.API.sitePackages=`/lib/python${s}.${n}/site-packages`,r.FS.mkdirTree(r.API.sitePackages),r.addRunDependency("install-stdlib");try{let i=await e;r.FS.writeFile(`/lib/python${s}${n}.zip`,i)}catch(i){console.error("Error occurred while installing the standard library:"),console.error(i)}finally{r.removeRunDependency("install-stdlib")}}}a(ps,"Ie");p(ps,"installStdlib");function ms(t){let e;return t.stdLibURL!=null?e=t.stdLibURL:e=t.indexURL+"python_stdlib.zip",[ps(e),cs(t.env.HOME),ds(t.env),as,...us(t.fsInit)]}a(ms,"Ne");p(ms,"getFileSystemInitializationFuncs");function _s(t){if(typeof WasmOffsetConverter<"u")return;let{binary:e,response:r}=Te(t+"pyodide.asm.wasm"),s=ls();return function(n,i){return(async function(){n.sentinel=await s;try{let o;r?o=await WebAssembly.instantiateStreaming(r,n):o=await WebAssembly.instantiate(await e,n);let{instance:l,module:d}=o;i(l,d)}catch(o){console.warn("wasm instantiation failed!"),console.warn(o)}})(),{}}}a(_s,"Fe");p(_s,"getInstantiateWasmFunc");var di="0.28.3";function Ne(t){return t===void 0||t.endsWith("/")?t:t+"/"}a(Ne,"_");p(Ne,"withTrailingSlash");var wt=di;async function Et(t={}){if(t.lockFileContents&&t.lockFileURL)throw new Error("Can't pass both lockFileContents and lockFileURL");await kt();let e=t.indexURL||await is();e=Ne(Oe(e));let r=t;if(r.packageBaseUrl=Ne(r.packageBaseUrl),r.cdnUrl=Ne(r.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v${wt}/full/`),!t.lockFileContents){let f=t.lockFileURL??e+"pyodide-lock.json";r.lockFileContents=ns(f),r.packageBaseUrl??=os(f)}r.indexURL=e,r.packageCacheDir&&(r.packageCacheDir=Ne(Oe(r.packageCacheDir)));let s={fullStdLib:!1,jsglobals:globalThis,stdin:globalThis.prompt?globalThis.prompt:void 0,args:[],env:{},packages:[],packageCacheDir:r.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:"cc7a4bb4c6f36f12592fef0934292b5fddb0e313ca5dc4a5a9519bb7610c67e3"},n=Object.assign(s,r);n.env.HOME??="/home/pyodide",n.env.PYTHONINSPECT??="1";let i=fs(n),o=i.API;if(o.lockFilePromise=Promise.resolve(r.lockFileContents),typeof _createPyodideModule!="function"){let f=`${n.indexURL}pyodide.asm.js`;await Ee(f)}let l;if(t._loadSnapshot){let f=await t._loadSnapshot;ArrayBuffer.isView(f)?l=f:l=new Uint8Array(f),i.noInitialRun=!0,i.INITIAL_MEMORY=l.length}let d=await _createPyodideModule(i);if(i.exitCode!==void 0)throw new d.ExitStatus(i.exitCode);if(t.pyproxyToStringRepr&&o.setPyProxyToStringMethod(!0),t.convertNullToNone&&o.setCompatNullToNone(!0),o.version!==wt&&n.checkAPIVersion)throw new Error(`Pyodide version does not match: '${wt}' <==> '${o.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);d.locateFile=f=>{throw f.endsWith(".so")?new Error(`Failed to find dynamic library "${f}"`):new Error(`Unexpected call to locateFile("${f}")`)};let c;l&&(c=o.restoreSnapshot(l));let h=o.finalizeBootstrap(c,t._snapshotDeserializer);return o.sys.path.insert(0,""),o._pyodide.set_excepthook(),await o.packageIndexReady,o.initializeStreams(n.stdin,n.stdout,n.stderr),h}a(Et,"at");p(Et,"loadPyodide");var gs=String.raw`
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
`;function ys(t){return t.startsWith(".")||t==="Submissions"||t==="__pycache__"}a(ys,"skippedFolder");var ui=["/evn","/work"];function bs(t){let e=null,r=null,s=-1,n=!1,i=Promise.resolve(),o=new Map,l=new Map,d=new Map,c=0,h=a(()=>Number(e?._module?.HEAP8?.length??0),"memory"),f=a(u=>{let b=new TextDecoder;return{write(k){let w=b.decode(k,{stream:!0});return w&&s>=0&&t.post({t:u,id:s,text:w}),k.length}}},"streams"),m=a(u=>`${u.size}:${+u.mtime}`,"keyOf"),_,g=new Uint8Array(1),y=a(()=>{_&&e&&e.setInterruptBuffer(_)},"unmask"),v=[];function M(u){let b=e.FS,k=[];for(let w of u??[])try{let P=w.path.slice(0,w.path.lastIndexOf("/"));P&&b.mkdirTree(P),b.writeFile(w.path,w.data),typeof w.mtime=="number"&&b.utime(w.path,w.mtime,w.mtime),o.set(w.path,m(b.stat(w.path)))}catch{k.push(w.path)}return v.push(...k),k}a(M,"writeMirror");function K(){let u=e.FS,b=[],k=a(w=>{let P;try{P=u.readdir(w)}catch{return}for(let E of P){if(E==="."||E==="..")continue;let N=`${w}/${E}`,S;try{S=u.stat(N)}catch{continue}if(u.isDir(S.mode)){ys(E)||k(N);continue}if(!u.isFile(S.mode))continue;let R=m(S);o.get(N)!==R&&(b.push({path:N,data:u.readFile(N)}),o.set(N,R))}},"walk");for(let w of ui)k(w);return b}a(K,"scanChanged");async function Pe(u){let b=Date.now();u.files&&(Fe?.serve({"pyodide.asm.wasm":{body:u.files.wasm,type:"application/wasm"},"python_stdlib.zip":{body:u.files.stdlib,type:"application/zip"}}),t.loadGlue?.(u.files.asm),Fe?.closeImportScripts());let k=new Set(Object.values(JSON.parse(u.lock).packages||{}).map(N=>String(N.file_name)));Fe?.provide(N=>k.has(N)?new Promise((S,R)=>{let J=++c;d.set(J,{resolve:S,reject:R}),t.post({t:"file",req:J,name:N})}):void 0),e=await Et({indexURL:u.indexURL,packageBaseUrl:u.packageDir??u.indexURL,...u.packageDir?{packageCacheDir:u.packageDir}:{},lockFileContents:u.lock,jsglobals:Ct(globalThis),stdout:a(()=>{},"stdout"),stderr:a(()=>{},"stderr")});let w=e.loadPackage.bind(e);e.loadPackage=async(N,S={})=>{let R=[],J=await w(N,{...S,messageCallback:S.messageCallback??(()=>{}),errorCallback:a(Ot=>{R.push(Ot),S.errorCallback?.(Ot)},"errorCallback")});if(R.length)throw new Error(R.join(`
`));return J},e.setStdout(f("stdout")),e.setStderr(f("stderr")),u.interrupt&&(_=new Uint8Array(u.interrupt),e.setInterruptBuffer(_)),n=!!u.mirror,e.registerJsModule("_evn_nb_host",{mask:a(()=>{_&&e.setInterruptBuffer(g)},"mask"),copy_in:a((N,S)=>new Promise(R=>{let J=++c;l.set(J,R),t.post({t:"copyIn",id:s,req:J,path:String(N),cwd:String(S)})}),"copy_in")}),e.runPython(gs,{filename:"<evn-kernel>"});let P=e.globals.get("_EvnKernel"),E=e.toPy({workdir:u.workdir,roots:u.roots,unvendored:u.unvendored,packages:u.packages,missing:u.missing??[],missing_line:u.missingLine??null,has:u.has,modules:u.modules});r=P(E),E.destroy(),P.destroy(),t.post({t:"ready",ms:Date.now()-b,memory:h()})}a(Pe,"init");async function q(u,b,k,w,P){s=u,v=[];for(let S of P??[])o.delete(S);let E;try{M(w);try{E=JSON.parse(await r.run(b,k))}finally{y()}}catch(S){E={ok:!1,error:{name:String(S?.name??"Error"),message:String(S?.message??S),stack:String(S?.message??S)}}}finally{s=-1}let N;if(n)try{N=K()}catch(S){t.post({t:"stderr",id:u,text:`The notebook could not read back the cell's files: ${S?.message??S}
`})}t.post({t:"done",id:u,ok:!!E.ok,value:E.value??null,error:E.error,refused:E.refused,install:E.install??void 0,memory:h(),changed:N,unwritten:v.length?v:void 0,figures:E.figures&&E.figures.length?E.figures:void 0})}a(q,"run");let G=a(u=>JSON.stringify({ok:!1,error:{type:String(u?.type??u?.name??"Error"),message:String(u?.message??u)}}),"failReply");t.onMessage(u=>{if(u.t==="init")i=i.then(()=>Pe(u)).catch(b=>t.post({t:"failed",message:String(b?.message??b)}));else if(u.t==="run")i=i.then(()=>r?q(u.id,u.code,u.label,u.files,u.dirty):t.post({t:"done",id:u.id,ok:!1,error:{name:"KernelError",message:"the notebook's Python did not start",stack:""},memory:0}));else if(u.t==="copyInReply"){let b=l.get(u.req);l.delete(u.req);let k=u.error,w=M(u.files);w.length&&(k=`could not put ${w.join(", ")} into the notebook's copy (a folder there has that name?)`),b?.(JSON.stringify({copied:(u.copied??u.files.map(P=>P.path)).filter(P=>!w.includes(P)),error:k??null}))}else if(u.t==="fileReply"){let b=d.get(u.req);d.delete(u.req),b&&(u.data?b.resolve({body:u.data,type:"application/octet-stream"}):b.reject(new Error(u.error??"the package file could not be read")))}else u.t==="probe"?i=i.then(async()=>{let b;try{if(!r)throw new Error("the notebook's Python did not start");try{u.kind==="call"?b=r.probe_call(u.fn,u.args,u.kwargs):u.kind==="get"?b=r.probe_get(JSON.stringify(u.names)):b=r.probe_ser(JSON.stringify(u.names),u.limit)}finally{y()}}catch(k){b=G(k)}t.post({t:"probeDone",id:u.id,reply:b})}):u.t==="ref"&&(i=i.then(async()=>{let b;try{if(!r)throw new Error("the reference's Python did not start");b=await r.ref_run(u.code,u.inputs)}catch(k){b=G(k)}t.post({t:"refDone",id:u.id,reply:b})}))})}a(bs,"serveKernel");var Nt=ws.parentPort;Nt&&bs({post:a(t=>Nt.postMessage(t),"post"),onMessage:a(t=>Nt.on("message",t),"onMessage")});
