"use strict"
define([
    "dijit/Dialog"
], (Dialog) => {
    return class {
        constructor(_cadence) {
            this.cadence = _cadence;
            this.dialogBox = new Dialog({
                style: "width:400px;"
            });
            this.wideDialogBox = new Dialog({
                style: "width:650px;"
            });
        }

        showError(msg) {
            this.dialogBox.set("title", "Error");
            this.dialogBox.set("content", "<div style='float: left; padding-right: 10px; padding-bottom: 5px; height: 100%'><img style='vertical-align: middle; width:32px;' src='img/error.svg'></div><div style='height: 100%;'>"+msg+"</div><br style='clear:both;'/>");
            this.dialogBox.show();
        }

        showWait(msg) {
            this.dialogBox.set("title", "Please wait...");
            this.dialogBox.set("content", "<div style='float: left; padding-right: 10px; padding-bottom: 5px; height: 100%'><img style='vertical-align: middle; width:32px;' src='img/hourglass_spinner.svg'></div><div style='height: 100%;'>"+msg+"</div><br style='clear:both;'/>");
            this.dialogBox.show();
        }

        showDialog(title, msg) {
            this.dialogBox.set("title", title);
            this.dialogBox.set("content", msg);
            this.dialogBox.show();
        }

        showWideDialog(title, msg) {
            this.wideDialogBox.set("title", title);
            this.wideDialogBox.set("content", msg);
            this.wideDialogBox.show();
        }

        hideWait() {
            this.dialogBox.hide();
        }

    }

});
