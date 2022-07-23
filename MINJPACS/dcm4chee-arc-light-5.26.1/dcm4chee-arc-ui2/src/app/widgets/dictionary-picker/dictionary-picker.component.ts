import {
    Component, OnInit, EventEmitter, Input, Output
} from '@angular/core';
declare var DCM4CHE: any;
import * as _ from 'lodash-es';
import {SearchPipe} from "../../pipes/search.pipe";
import {WindowRefService} from "../../helpers/window-ref.service";
import {Globalvar} from "../../constants/globalvar";

@Component({
  selector: 'dictionary-picker',
  templateUrl: './dictionary-picker.component.html',
  styleUrls: ['./dictionary-picker.component.css']
})
export class DictionaryPickerComponent implements OnInit {
    Object = Object;
    @Input() dictionary;
    @Input() formelement;
    @Output() onValueSet = new EventEmitter();
    filter = '';
    dcmTags = [];
    dcmTagsFiltered = [];
    sliceTo = 20;
    scrollTop = 0;
    search = new SearchPipe();
    constructor(
    ) { }

    ngOnInit() {
        switch(this.dictionary) {
            case 'dcmTag':
                _.forEach(DCM4CHE.elementName.forTag("all"),(m,i)=>{
                    this.dcmTags.push({
                        key:i,
                        text:m
                    });
                    this.dcmTagsFiltered.push({
                        key:i,
                        text:m
                    });
                });
                break;
            case 'dcmTransferSyntax':
                _.forEach(DCM4CHE.TransferSyntax.nameOf("all"),(m,i)=>{
                    this.dcmTags.push({
                        key:i,
                        text:m
                    });
                    this.dcmTagsFiltered.push({
                        key:i,
                        text:m
                    });
                });
                break;
            case 'dcmSOPClass':
                _.forEach(DCM4CHE.SOPClass.nameOf("all"),(m,i)=>{
                    this.dcmTags.push({
                        key:i,
                        text:m
                    });
                    this.dcmTagsFiltered.push({
                        key:i,
                        text:m
                    });
                });
                break;
        }

    }
    ngAfterViewInit() {
        WindowRefService.nativeWindow.document.getElementsByClassName("dictionary_widget_search")[0].focus();
        // $('.dictionary_widget_search').focus();
    }
    addSelectedElement(element){
        this.onValueSet.emit(element.key);
    }

    keyDown(e){
        if(e.keyCode === 13){
            let filtered = new SearchPipe().transform(this.dcmTags, this.filter);
            if(filtered.length > 0){
                this.onValueSet.emit(filtered[0].key);
            }
        }
    }

    onScroll(e){
        const offsetScrollHeight = e.target.scrollTop + e.target.offsetHeight;
        if(this.scrollTop < e.target.scrollTop && offsetScrollHeight + 20 > e.target.scrollHeight){
            this.scrollTop = e.target.scrollTop;
            this.loadMore();
        }
    }
    onSearch(){
        this.sliceTo = 20;
        this.scrollTop = 0;
        this.dcmTagsFiltered = this.search.transform(this.dcmTags,this.filter);
    }
    loadMore(){
        this.sliceTo += 20;
    }
    close(){
        this.onValueSet.emit("");
    }
}
