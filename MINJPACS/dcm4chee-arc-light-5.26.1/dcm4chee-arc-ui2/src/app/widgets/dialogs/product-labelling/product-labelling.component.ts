import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import {j4care} from "../../../helpers/j4care.service";

@Component({
  selector: 'app-product-labelling',
  templateUrl: './product-labelling.component.html'
})
export class ProductLabellingComponent {
    private _archive;
    year = j4care.formatDate(new Date(), "yyyy");
    constructor(public dialogRef: MatDialogRef<ProductLabellingComponent>) { }

    get archive() {
        return this._archive;
    }

    set archive(value) {
        this._archive = value;
    }
}
