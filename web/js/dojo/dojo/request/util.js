/*
	Copyright (c) 2004-2016, The JS Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/

//>>built
define("dojo/request/util",["exports","../errors/RequestError","../errors/CancelError","../Deferred","../io-query","../_base/array","../_base/lang","../promise/Promise","../has"],function(_1,_2,_3,_4,_5,_6,_7,_8,_9){
_1.deepCopy=function deepCopy(_a,_b){
for(var _c in _b){
var _d=_a[_c],_e=_b[_c];
if(_d!==_e){
if(_d&&typeof _d==="object"&&_e&&typeof _e==="object"){
if(_e instanceof Date){
_a[_c]=new Date(_e);
}else{
_1.deepCopy(_d,_e);
}
}else{
_a[_c]=_e;
}
}
}
return _a;
};
_1.deepCreate=function deepCreate(_f,_10){
_10=_10||{};
var _11=_7.delegate(_f),_12,_13;
for(_12 in _f){
_13=_f[_12];
if(_13&&typeof _13==="object"){
_11[_12]=_1.deepCreate(_13,_10[_12]);
}
}
return _1.deepCopy(_11,_10);
};
var _14=Object.freeze||function(obj){
return obj;
};
function _15(_16){
return _14(_16);
};
function _17(_18){
return _18.data!==undefined?_18.data:_18.text;
};
_1.deferred=function deferred(_19,_1a,_1b,_1c,_1d,_1e){
var def=new _4(function(_1f){
_1a&&_1a(def,_19);
if(!_1f||!(_1f instanceof _2)&&!(_1f instanceof _3)){
return new _3("Request canceled",_19);
}
return _1f;
});
def.response=_19;
def.isValid=_1b;
def.isReady=_1c;
def.handleResponse=_1d;
function _20(_21){
_21.response=_19;
throw _21;
};
var _22=def.then(_15).otherwise(_20);
if(_1.notify){
_22.then(_7.hitch(_1.notify,"emit","load"),_7.hitch(_1.notify,"emit","error"));
}
var _23=_22.then(_17);
var _24=new _8();
for(var _25 in _23){
if(_23.hasOwnProperty(_25)){
_24[_25]=_23[_25];
}
}
_24.response=_22;
_14(_24);
if(_1e){
def.then(function(_26){
_1e.call(def,_26);
},function(_27){
_1e.call(def,_19,_27);
});
}
def.promise=_24;
def.then=_24.then;
return def;
};
_1.addCommonMethods=function addCommonMethods(_28,_29){
_6.forEach(_29||["GET","POST","PUT","DELETE"],function(_2a){
_28[(_2a==="DELETE"?"DEL":_2a).toLowerCase()]=function(url,_2b){
_2b=_7.delegate(_2b||{});
_2b.method=_2a;
return _28(url,_2b);
};
});
};
_1.parseArgs=function parseArgs(url,_2c,_2d){
var _2e=_2c.data,_2f=_2c.query;
if(_2e&&!_2d){
if(typeof _2e==="object"&&(!(_9("native-xhr2"))||!(_2e instanceof ArrayBuffer||_2e instanceof Blob))){
_2c.data=_5.objectToQuery(_2e);
}
}
if(_2f){
if(typeof _2f==="object"){
_2f=_5.objectToQuery(_2f);
}
if(_2c.preventCache){
_2f+=(_2f?"&":"")+"request.preventCache="+(+(new Date));
}
}else{
if(_2c.preventCache){
_2f="request.preventCache="+(+(new Date));
}
}
if(url&&_2f){
url+=(~url.indexOf("?")?"&":"?")+_2f;
}
return {url:url,options:_2c,getHeader:function(_30){
return null;
}};
};
_1.checkStatus=function(_31){
_31=_31||0;
return (_31>=200&&_31<300)||_31===304||_31===1223||!_31;
};
});
