//>>built
define("dojox/form/uploader/_HTML5",["dojo/_base/declare","dojo/_base/lang","dojo/_base/array","dojo","dojo/request","dojo/request/xhr","dojo/has"],function(_1,_2,_3,_4,_5,_6,_7){
function _8(){
};
if(_7("native-xhr2")){
_6._create=(function(_9){
return function(){
var _a=_9();
_a.upload.addEventListener("progress",_8,false);
return _a;
};
})(_6._create);
}
return _1("dojox.form.uploader._HTML5",[],{errMsg:"Error uploading files. Try checking permissions",uploadType:"html5",postMixInProperties:function(){
this.inherited(arguments);
if(this.uploadType==="html5"){
}
},postCreate:function(){
this.connectForm();
this.inherited(arguments);
if(this.uploadOnSelect){
this.connect(this,"onChange",function(_b){
this.upload(_b[0]);
});
}
},_drop:function(e){
_4.stopEvent(e);
var dt=e.dataTransfer;
this._files=dt.files;
this.onChange(this.getFileList());
},upload:function(_c){
this.onBegin(this.getFileList());
this.uploadWithFormData(_c);
},addDropTarget:function(_d,_e){
if(!_e){
this.connect(_d,"dragenter",_4.stopEvent);
this.connect(_d,"dragover",_4.stopEvent);
this.connect(_d,"dragleave",_4.stopEvent);
}
this.connect(_d,"drop","_drop");
},uploadWithFormData:function(_f){
if(!this.getUrl()){
console.error("No upload url found.",this);
return;
}
var fd=new FormData(),_10=this._getFileFieldName();
_3.forEach(this._files,function(f,i){
fd.append(_10,f);
},this);
if(_f){
_f.uploadType=this.uploadType;
for(var nm in _f){
fd.append(nm,_f[nm]);
}
}
var _11=this;
var _12=_5(this.getUrl(),{method:"POST",data:fd,handleAs:"json",headers:{Accept:"application/json"}},true);
_12.promise.response.otherwise(function(_13){
console.error(_13);
console.error(_13.response.text);
_11.onError(_13);
});
function _14(_15){
_11._xhrProgress(_15);
if(_15.type!=="load"){
return;
}
_11.onComplete(_12.response.data);
_12.response.xhr.removeEventListener("load",_14,false);
_12.response.xhr.upload.removeEventListener("progress",_14,false);
_12.response.xhr.upload.removeEventListener("progress",_8,false);
_12=null;
};
if(_7("native-xhr2")){
_12.response.xhr.addEventListener("load",_14,false);
_12.response.xhr.upload.addEventListener("progress",_14,false);
}else{
_12.promise.then(function(_16){
_11.onComplete(_16);
});
}
},_xhrProgress:function(evt){
if(evt.lengthComputable){
var o={bytesLoaded:evt.loaded,bytesTotal:evt.total,type:evt.type,timeStamp:evt.timeStamp};
if(evt.type=="load"){
o.percent="100%";
o.decimal=1;
}else{
o.decimal=evt.loaded/evt.total;
o.percent=Math.ceil((evt.loaded/evt.total)*100)+"%";
}
this.onProgress(o);
}
}});
});
