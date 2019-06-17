"use strict"
define([
    "dojo/dom"
], (dom) => {
    return class {

        constructor(_type, constraint_left, constraint_right, _val=null) {
            this.type = _type;
            if (constraint_left != null) {
                this.left = constraint_left;
            }
            if (constraint_right != null) {
                this.right = constraint_right;
            }
            if (_val != null) {
                this.val = _val;
            }
        }

    }
});