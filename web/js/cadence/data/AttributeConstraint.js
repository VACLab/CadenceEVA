"use strict"
define([
    "dojo/dom"
], (dom) => {
    return class {

        constructor(_varname, _value, data_type, _relation) {
            this.varname = _varname;
            this.value = _value;
            this.datatype = data_type;
            this.relation = _relation;
        }

        then(_constraint) {
        }

    }
});
