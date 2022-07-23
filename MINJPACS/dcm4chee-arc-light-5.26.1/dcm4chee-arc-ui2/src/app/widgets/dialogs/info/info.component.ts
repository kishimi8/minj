import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html'
})
export class InfoComponent{

    private _info: any = {
        title: $localize `:@@title:Info`,
        content: undefined
    };
    constructor(public dialogRef: MatDialogRef<InfoComponent>) {

    }

    get info() {
        return this._info;
    }

    set info(value) {
        this._info = value;
    }
}
