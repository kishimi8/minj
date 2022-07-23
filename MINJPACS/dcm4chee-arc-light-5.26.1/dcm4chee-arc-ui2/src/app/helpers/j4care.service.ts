import {Injectable} from '@angular/core';
import {Subscriber, Observable} from "rxjs";
declare var DCM4CHE: any;
import * as _ from 'lodash-es';
import {DatePipe} from "@angular/common";
import {WindowRefService} from "./window-ref.service";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";
import {ConfirmComponent} from "../widgets/dialogs/confirm/confirm.component";
import {Router} from "@angular/router";
import {
    ConfiguredDateTameFormatObject,
    J4careDateTime,
    J4careDateTimeMode, LanguageConfig,
    LanguageProfile,
    RangeObject,
    RangeUnit, SelectDropdown,
    StudyDateMode
} from "../interfaces";
import {TableSchemaElement} from "../models/dicom-table-schema-element";
import {DicomNetworkConnection} from "../interfaces";
import {DcmWebApp} from "../models/dcm-web-app";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import * as uuid from  'uuid/v4';
import {User} from "../models/user";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";
import {Aet} from "../models/aet";
import {Device} from "../models/device";
declare const bigInt:Function;

@Injectable()
export class j4care {
    header = new HttpHeaders();
    dialogRef: MatDialogRef<any>;
    constructor(
        private $httpClient:HttpClient,
        public dialog: MatDialog,
        public config: MatDialogConfig,
        private router: Router,
        private sanitizer : DomSanitizer
    ) {}
    static traverse(object,func, savedKeys?:string){
        if(savedKeys != undefined){
            savedKeys += `[${savedKeys}]`;
        }
        for(let key in object){
            if(object.hasOwnProperty(key) && key) {
                if(typeof object[key] === "object"){
                    this.traverse(object[key],func, key);
                }else{
                    object[key] = func.apply(object,[object[key],key,object, savedKeys]);
                }
            }
        }
        return object;
    }

    static removeKeyFromObject(object, toRemoveKey){
        if(_.isArray(toRemoveKey)){
            toRemoveKey.forEach(k=>{
                if(_.hasIn(object, k)){
                    delete object[k];
                }
            })
        }else{
            if(_.hasIn(object, toRemoveKey)){
                delete object[toRemoveKey];
            }
        }
        for(let key in object){
            if(typeof object[key] === "object"){
                this.removeKeyFromObject(object[key], toRemoveKey);
            }
        }
        return object;
    }
    static getPath(obj, searchKey:string, value:string) {
        for(let key in obj) {
            if(obj[key] && typeof obj[key] === "object") {

                let result = this.getPath(obj[key], searchKey, value);
                if(result) {
                    result.unshift(key);
                    return result;
                }
            }else{
                if(searchKey){
                    if(key === searchKey && obj[key] === value){
                        return [key];
                    }
                }else{
                    if(obj[key] === value) {
                        return [key];
                    }
                }
            }
        }
    }
    static downloadFile(url, filename?){
        if(filename){
            try{
                let link = document.createElement('a');
                let linkText = document.createTextNode("&nbsp;");
                link.appendChild(linkText);
                link.href = url;
                link.download=filename;
                link.target='_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }catch (e) {
                this.log("On DownloadFile",e);
                WindowRefService.nativeWindow.open(url);
            }
        }else{
            WindowRefService.nativeWindow.open(url);
        }
    }
    static firstLetterToUpperCase(str){
        return str && str[0].toUpperCase() + str.slice(1);
    }
    static firstLetterToLowerCase(str) {
        return str && str[0].toLowerCase() + str.slice(1);
    }
    static isSet(value){
        if((value === undefined || value === null || (_.isObject(value) && _.isEmpty(value))) && (value != 0 && value != "") && !_.isDate(value) && !_.isBoolean(value)){
            return false;
        }
        return true;
    }
    static hasSet(obj, path){
        if(_.hasIn(obj,path) && j4care.isSet(_.get(obj,path)))
            return true;
        return false;
    }
    static isDate(input){
        try{
            if(input && !isNaN((new Date(input)).getTime()) && typeof input != "number"){
                console.log("date=",new Date(input));
                return _.isDate(new Date(input));
            }
            return false;
        }catch (e) {
            return false;
        }
    }
    static isSetInObject(object:any, key:string){
        return _.hasIn(object,key) && this.isSet(object[key]);
    }
    navigateTo(url){
        this.router.navigateByUrl(url);
    }
    static promiseToObservable<T>(promise:Promise<T>):Observable<T>{
        return Observable.create(observer=>{
            promise.then(res=>{
                observer.next(res);
            }).catch(err=>{
                observer.error(err);
            })
        });
    }
    static prepareFlatFilterObject(array,lineLength?){
        if(!lineLength){
            lineLength = 3;
        }
        if(_.isArray(array) && array.length > 0){
            if(_.hasIn(array,"[0][0].firstChild")){
                return array
            }else{
                let endArray = [];
                let block = [];
                let line = [];
                array.forEach( formObject =>{
                    if(line.length < 2){
                        line.push(formObject);
                    }else{
                        if(block.length < lineLength){
                            block.push(line);
                            line = [];
                            line.push(formObject);
                        }else{
                            endArray.push(block)
                            block = [];
                            block.push(line);
                            line = [];
                            line.push(formObject);
                        }
                    }
                });
                if(line.length > 0){
                    if(block.length < lineLength){
                        block.push(line);
                    }else{
                        endArray.push(block);
                        block = [];
                        block.push(line);
                    }
                }
                if(block.length > 0){
                    endArray.push(block);
                }
                return endArray;
            }
        }else{
            return array;
        }
    }

    static filtersExists(filters:any, keys:string[], mode?:("or"|"and")){
        try{
            mode = mode || "or";
            let allExist = true;
            let elementsFound = 0;
            keys.forEach(key=>{
                allExist = allExist && Object.keys(filters).indexOf(key) > -1;
                if(Object.keys(filters).indexOf(key) > -1){
                    elementsFound++;

                }
            });
            if(mode === "and"){
                return allExist;
            }else{
                return elementsFound > 0;
            }
        }catch (e){
            return false;
        }
    }
    static arrayHasIn(arr:any[], path:string, value?:any){
        let check:boolean = false;
        arr.forEach(el=>{
            if(_.hasIn(el,path)){
                if((value || value === false)){
                    if(_.get(el, path) === value){
                        check = true;
                    }
                }else{
                    check = true;
                }
            }
        });
        return check;
    }
    static stringifyArrayOrObject(properties, exceptions){
        Object.keys(properties).forEach(task=>{
            if(_.isArray(properties[task]) && exceptions.indexOf(task) === -1){
                if(properties[task].length === 2 && task.indexOf('Range') > -1)
                    properties[task] = properties[task].join(' - ');
                else{
                    if(_.isObject(properties[task][0])){
                        properties[task] = properties[task].map(t=>{
                            return Object.keys(t).map(key=>{
                                return `${key}=${t[key]}`
                            });
                        }).join('; ');
                    }else{
                        properties[task] = properties[task].join(', ');
                    }
                }
            }
            if(_.isObject(properties[task]) && exceptions.indexOf(task) === -1)
                properties[task] = Object.keys(properties[task]).map(taskKey=>`${taskKey}=${properties[task][taskKey]}`).join(', ');
        });
    }
    static extendAetObjectWithAlias(aet){
        let aliases = [];
        let usedAliasNames = [];
        aet.forEach((a)=>{
            if(_.hasIn(a,"dcmOtherAETitle")){
                let clone = _.cloneDeep(a);
                a.dcmOtherAETitle.forEach(alias=>{
                    clone.dicomAETitle = alias;
                    if(usedAliasNames.indexOf(alias) === -1){
                        aliases.push(_.cloneDeep(clone));
                        usedAliasNames.push(alias);
                    }
                });
            }
        });
        return [...aet,...aliases];
    }

    static extendAetObjectWithAliasFromSameObject(aet){
        const aliasPath = "dcmNetworkAE.dcmOtherAETitle";
        let aetExtended = [];
        aet.forEach((a)=>{
            aetExtended.push(a);
            if(_.hasIn(a,aliasPath)){
                try{
                    (<string[]>_.get(a,aliasPath)).forEach(alias=>{
                        if(aetExtended.filter((a:Aet)=>a.dicomAETitle === alias).length < 1){
                            aetExtended.push({
                                dicomAETitle:alias
                            })
                        }
                    });
                }catch (e) {
                    this.log("Trying to get aliases from same path",e);
                }
            }
        });
        return aetExtended
    }
    static convertDateRangeToString(rangeArray:Date[]){
        let datePipe = new DatePipe('en_US');

        if(rangeArray && rangeArray.length > 0){
            let stringArray:string[] = [];
            rangeArray.forEach(date =>{
                if(date){
                    stringArray.push(datePipe.transform(date,'yyyyMMdd'))
                }
            });
            return (stringArray.length > 1)?stringArray.join('-'):stringArray.join('');
        }else{
            if(_.isDate(rangeArray)){
                return datePipe.transform(rangeArray,'yyyyMMdd')
            }
            return '';
        }
    }
    static extractDurationFromValue(value:string){
        let match;
        const ptrn = /([P|p|T|t])|((\d*)(\w))/g;
        let year;
        let day;
        let month;
        let hour;
        let minute;
        let second;
        let week;
        let mode;
        try {
            while ((match = ptrn.exec(value)) != null) {
                if(match[1]){
                    mode = match[1];
                }
                switch(true) {
                    case (this.isEqual(match[4],'Y') || this.isEqual(match[4],'y')):
                        year = parseInt(match[3]);
                        break;
                    case (this.isEqual(match[4],'W') || this.isEqual(match[4],'w')):
                        week = parseInt(match[3]);
                        break;
                    case (this.isEqual(match[4],'M') || this.isEqual(match[4],'m')):
                        if(mode === "T" || mode === "t"){
                            minute = parseInt(match[3]);
                        }else{
                            month = parseInt(match[3]);
                        }
                        break;
                    case (this.isEqual(match[4],'D') || this.isEqual(match[4],'d')):
                        day= parseInt(match[3]);
                        break;
                    case (this.isEqual(match[4],'H') || this.isEqual(match[4],'h')):
                        hour = parseInt(match[3]);
                        break;
                    case (this.isEqual(match[4],'S') || this.isEqual(match[4],'s')):
                        second = parseInt(match[3]);
                        break;
                }
            }
            return {
                Week:week,
                FullYear:year,
                Date:day,
                Hours:hour,
                Minutes:minute,
                Month:month,
                Seconds:second
            }
        }catch (e){
            console.error("error parsing data!",e);
            return null;
        }
    }
    static createDateFromDuration(durationObject){
        let today = new Date();
        let newDate = new Date();
        Object.keys(durationObject).forEach(key => {
            if(durationObject[key]){
                switch (key){
                    case 'Week':
                        newDate.setDate(today.getDate()-(7*durationObject[key]));
                        break;
                    case 'FullYear':
                        newDate.setFullYear(today.getFullYear()-durationObject[key]);
                        break;
                    case 'Date':
                        newDate.setDate(today.getDate()-durationObject[key]);
                        break;
                    case 'Hours':
                        newDate.setHours(today.getHours()-durationObject[key]);
                        break;
                    case 'Minutes':
                        newDate.setMinutes(today.getMinutes()-durationObject[key]);
                        break;
                    case 'Month':
                        newDate.setMonth(today.getMonth()-durationObject[key]);
                        break;
                    case 'Seconds':
                        newDate.setSeconds(today.getSeconds()-durationObject[key]);
                        break;
                }
            }
        });
        return newDate;
    }
    static getSingleDateTimeValueFromInt(value){
        if(value)
            if(value < 10)
                return `0${value}`;
            else
                return value.toString();
        else
            return '00';
    }

    /*
   * Input:
   * uiConfigFormat:string - The configured Format string from the UI Config that should contain DATE=[date format], TIME=[time format], and Optional DATE-TIME=[date time format] if DATE-TIME is missing it will be a combination of both other parameters
   *
   * Output:
   * date time formats as string extracted from the single input string
   *
   * Example:
   * input: "DATE=yyyy-MM-dd, TIME=HH:mm,DATE-TIME=yyyy-MM-dd HH:mm"
   * Output:{
            dateFormat:"yyyy-MM-dd",
            timeFormat:"HH:mm",
            dateTimeFormat:"yyyy-MM-dd HH:mm"
        }
        For more examples see the j4care.service.spec.ts file regarding this function
   * */

    static extractDateTimeFormat(uiConfigFormat:string):ConfiguredDateTameFormatObject{
        const regex = /(DATE|date|TIME|time|DATE-TIME|date-time|datetime)=([yMdHmsS:\-.\ \/\\]*)/gm;
        let match;
        let configuredFormats:ConfiguredDateTameFormatObject = {
            dateFormat:undefined,
            timeFormat:undefined,
            dateTimeFormat:undefined
        };
        try{
            while ((match = regex.exec(uiConfigFormat)) !== null) {
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
                switch (match[1].toUpperCase()){
                    case "DATE":{
                        configuredFormats.dateFormat = match[2];
                        break;
                    }
                    case "TIME":{
                        configuredFormats.timeFormat = match[2];
                        break;
                    }
                    case "DATE-TIME":{
                        configuredFormats.dateTimeFormat = match[2];
                        break;
                    }
                }
            }
            if(configuredFormats.dateFormat && configuredFormats.timeFormat && !configuredFormats.dateTimeFormat){
                configuredFormats.dateTimeFormat = `${configuredFormats.dateFormat} ${configuredFormats.timeFormat}`;
            }
            configuredFormats.dateFormat = configuredFormats.dateFormat || "yyyyMMdd";
            configuredFormats.timeFormat = configuredFormats.timeFormat || "HH:mm";
            configuredFormats.dateTimeFormat = configuredFormats.dateTimeFormat || "yyyyMMdd HH:mm";
            return configuredFormats;
        }catch (e){
            return {
                dateFormat:"yyyyMMdd",
                timeFormat:"HH:mm",
                dateTimeFormat:"yyyyMMdd HH:mm"
            }
        }
    }

    static extractDateTimeFromString(str):RangeObject{
        const checkRegex = /^\d{14}-\d{14}$|^\d{8}-\d{8}$|^\d{6}-\d{6}$|^\d{14}-$|^-\d{14}$|^\d{14}$|^\d{8}-$|^-\d{8}$|^\d{8}$|^-\d{6}$|^\d{6}-$|^\d{6}$|^\d{14}.\d{1,3}|^\d{6}.\d{1,3}$/m;
        const regex = /(-?)(\d{4})(\d{2})(\d{2})(\d{0,2})(\d{0,2})(\d{0,2})(-?)|(-?)(\d{0,4})(\d{0,2})(\d{0,2})(\d{2})(\d{2})(\d{2})(-?)|(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).(\d{1,3})|(\d{2})(\d{2})(\d{2}).(\d{1,3})/g;
        let matchString = checkRegex.exec(str);
        let match;
        let resultArray = [];
        let mode:J4careDateTimeMode;
        let firstDateTime:J4careDateTime;
        let secondDateTime:J4careDateTime;
        if (matchString !== null && matchString[0]) {
            while ((match = regex.exec(matchString[0])) !== null) {
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
                resultArray.push(match);
            }
            if(resultArray.length === 2){
                if(resultArray[0][8] ==='-' || resultArray[0][16] ==='-')
                    mode = "range";
                firstDateTime = {
                    FullYear:resultArray[0][2],
                    Month:resultArray[0][3],
                    Date:resultArray[0][4],
                    Hours:resultArray[0][5] || resultArray[0][13],
                    Minutes:resultArray[0][6] || resultArray[0][14],
                    Seconds:resultArray[0][7] || resultArray[0][15]
                };
                secondDateTime = {
                    FullYear:resultArray[1][2],
                    Month:resultArray[1][3],
                    Date:resultArray[1][4],
                    Hours:resultArray[1][5] || resultArray[1][13],
                    Minutes:resultArray[1][6] || resultArray[1][14],
                    Seconds:resultArray[1][7] || resultArray[1][15]
                };
            }
            if(resultArray.length === 1){
                if(resultArray[0][1] ==='-' || resultArray[0][9] ==='-'){
                    mode = "leftOpen";
                    secondDateTime = {
                        FullYear:resultArray[0][2],
                        Month:resultArray[0][3],
                        Date:resultArray[0][4],
                        Hours:resultArray[0][5] || resultArray[0][13],
                        Minutes:resultArray[0][6] || resultArray[0][14],
                        Seconds:resultArray[0][7] || resultArray[0][15]
                    };
                }else{
                    if(resultArray[0][8] ==='-' || resultArray[0][16] ==='-')
                        mode = "rightOpen";
                    else
                        mode = "single";
                    firstDateTime = {
                        FullYear:resultArray[0][2],
                        Month:resultArray[0][3],
                        Date:resultArray[0][4],
                        Hours:resultArray[0][5] || resultArray[0][13],
                        Minutes:resultArray[0][6] || resultArray[0][14],
                        Seconds:resultArray[0][7] || resultArray[0][15]
                    };
                }
            }
            if(firstDateTime){
                firstDateTime["dateObject"] = this.getDateFromJ4careDateTime(firstDateTime);
            }
            if(secondDateTime){
                secondDateTime["dateObject"] = this.getDateFromJ4careDateTime(secondDateTime);
            }
            return {
                mode:mode,
                firstDateTime:firstDateTime,
                secondDateTime:secondDateTime
            }
        }
        try{
            let date = new Date(str);
            if(!isNaN(date.getTime())){
                mode = "single";
                firstDateTime = {
                    FullYear:date.getFullYear().toString(),
                    Month:(date.getMonth()+1).toString(),
                    Date:date.getDate().toString(),
                    Hours:date.getHours().toString(),
                    Minutes:date.getMinutes().toString(),
                    Seconds:date.getSeconds().toString(),
                    dateObject:date
                };
                return {
                    mode:mode,
                    firstDateTime:firstDateTime,
                    secondDateTime:secondDateTime
                }
            }
            return null;
        }catch (e) {
            this.log("Converting string in to date didn't work",e);
            return null;
        }
    }
    static getDateFromJ4careDateTime(dateObject:J4careDateTime):Date{
        let today = new Date();
        return new Date(`${
        dateObject.FullYear || today.getFullYear()
            }-${
        dateObject.Month || today.getMonth()+1
            }-${
        dateObject.Date || today.getDate()
            } ${
        dateObject.Hours || '00'
            }:${
        dateObject.Minutes || '00'
            }:${
        dateObject.Seconds || '00'
            }`);
    }
    static splitRange(range:string, splitCount?:number):any{
        let rangeObject:RangeObject = j4care.extractDateTimeFromString(range);
        let diff:number = rangeObject && rangeObject.mode === "range" ? rangeObject.secondDateTime.dateObject.getTime() - rangeObject.firstDateTime.dateObject.getTime() : 0;
        let block = diff/(splitCount||31);
        const DAY_IN_MSC = 86400000;
        if(diff > 0){
            if(DAY_IN_MSC > block){
                return  (j4care.splitRangeInBlocks(rangeObject, DAY_IN_MSC, undefined, false));
            }else{
                return  (j4care.splitRangeInBlocks(rangeObject, block, undefined, true));
            }
        }
        return [range];
    }

    static rangeObjectToString(range:RangeObject):string{
        let firstDateTime = '';
        let secondDateTime = '';
        let minus = range.mode != "single" ? '-': '';
        if(range.mode === "range" || range.mode === "rightOpen" || range.mode === "single"){
            firstDateTime = this.formatDate(range.firstDateTime.dateObject,"yyyyMMdd");
        }
        if(range.mode === "range" || range.mode === "leftOpen"){
            secondDateTime = this.formatDate(range.secondDateTime.dateObject,"yyyyMMdd");
        }
        return `${firstDateTime}${minus}${secondDateTime}`;
    }
    static splitRangeInBlocks(range:RangeObject, block:number, diff?:number, pare:boolean = false):string[]{
        let endDate = [];
        let endDatePare = [];
        if(!diff){
            diff = range && range.mode === "range" ? range.secondDateTime.dateObject.getTime() - range.firstDateTime.dateObject.getTime() : 0;
        }
        if(diff > block){
            endDate.push(this.formatDate(range.firstDateTime.dateObject,"yyyyMMdd"));
            let daysInDiff = diff/block;
            let dateStep = range.firstDateTime.dateObject.getTime();
            while(daysInDiff > 0){
                if(daysInDiff != diff/block){
                    let increasedDateStep = new Date(dateStep);
                    increasedDateStep.setDate(increasedDateStep.getDate() + 1);
                    endDatePare.push(this.convertToDatePareString(increasedDateStep,dateStep+block));
                }else {
                    endDatePare.push(this.convertToDatePareString(dateStep,dateStep+block));
                }
                dateStep = dateStep+block;
                endDate.push(this.convertToDateString(new Date(dateStep)));
                daysInDiff--;
            }
            if(pare){
                return endDatePare;
            }else{
                return endDate;
            }
        }else{
            return [this.rangeObjectToString(range)];
        }
    }
    static splitDate(object){
        let range;
        if(_.hasIn(object,'StudyDate'))
            range = object.StudyDate;
        else
            range = object;
        return j4care.splitRangeInBlocks(j4care.extractDateTimeFromString(range), 86400000);
    }
    static getMainAet(aets){
        try{
            return [aets.filter(aet => {
                return aet.dcmAcceptedUserRole && aet.dcmAcceptedUserRole.indexOf('user') > -1;
            })[0] || aets[0]];
        }catch (e) {
            console.groupCollapsed("j4care getMainAet(aets[])");
            console.error(e);
            console.groupEnd();
            return aets && aets.length > 0 ? [aets[0]] : [];
        }
    }
    static stringValidDate(string:string){
        if(Date.parse(string))
            return true;
        return false;
    }
    static validTimeObject(time:{Hours,Minutes,Seconds}){
        if(
            time.Hours && time.Hours < 25 &&
            time.Minutes && time.Minutes < 60 &&
            ((time.Seconds && time.Seconds < 60) || !time.Seconds || time.Seconds === "" || time.Seconds === "00")
        )
            return true;
        return false;
    }
    static isSetDateObject(date:{FullYear,Month,Date}){
        if(date && date.FullYear && date.Month && date.Date)
            return true;
        return false;
    }
    static isSetTimeObject(time:{Hours,Minutes,Seconds}){
        if(time && time.Hours && time.Minutes && time.Seconds)
            return true;
        return false;
    }
    static validDateObject(date:{FullYear,Month,Date}){
        if(this.stringValidDate(`${date.FullYear}-${date.Month}-${date.Date}`))
            return true;
        return false;
    }
    static splitTimeAndTimezone(string){
        const regex = /(.*)([+-])(\d{2}:?\d{2})/;
        let m;
        if ((m = regex.exec(string)) !== null) {
            return {
                time:m[1],
                timeZone:`${m[2]||''}${m[3]||''}`
            }
        }
        if(string)
            return {
                time:string,
                timeZone:""
            };
        return string;
    }
    static redirectOnAuthResponse(res){
        let resjson;
        try{
/*            let pattern = new RegExp("[^:]*:\/\/[^\/]*\/auth\/");
            if(pattern.exec(res.url)){
                // WindowRefService.nativeWindow.location = "/dcm4chee-arc/ui2/";
                console.log("onredirectOnAuthResponse",res);
                location.reload(true);
            }*/
            // resjson = res.json();
            // resjson = res;
            resjson = res
        }catch (e){
            if(typeof res === "object"){
                resjson = res;
            }else{
                resjson = [];
            }
        }
        return resjson;
    }
    static attrs2rows(level, attrs, rows) {
        function privateCreator(tag) {
            if ('02468ACE'.indexOf(tag.charAt(3)) < 0) {
                let block = tag.slice(4, 6);
                if (block !== '00') {
                    let el = attrs[tag.slice(0, 4) + '00' + block];
                    return el && el.Value && el.Value[0];
                }
            }
            return undefined;
        }
        let $this = this;
        Object.keys(attrs).sort().forEach(function (tag) {
            let el = attrs[tag];
            rows.push({ level: level, tag: tag, name: DCM4CHE.elementName.forTag(tag, privateCreator(tag)), el: el });
            if (el.vr === 'SQ') {
                let itemLevel = level + '>';
                _.forEach(el.Value, function (item, index) {
                    rows.push({ level: itemLevel, item: index });
                    $this.attrs2rows(itemLevel, item, rows);
                });
            }
        });
    };
    static dateToString(date:Date){
        return `${date.getFullYear()}${this.getSingleDateTimeValueFromInt(date.getMonth()+1)}${this.getSingleDateTimeValueFromInt(date.getDate())}`;
    }
    static fullDateToString(date:Date){
        return `${date.getFullYear()}.${this.getSingleDateTimeValueFromInt(date.getMonth()+1)}.${this.getSingleDateTimeValueFromInt(date.getDate())} ${this.getSingleDateTimeValueFromInt(date.getHours())}:${this.getSingleDateTimeValueFromInt(date.getMinutes())}:${this.getSingleDateTimeValueFromInt(date.getSeconds())}`;
    }
    static fullDateToStringFilter(date:Date){
        return `${date.getFullYear()}${this.getSingleDateTimeValueFromInt(date.getMonth()+1)}${this.getSingleDateTimeValueFromInt(date.getDate())}${this.getSingleDateTimeValueFromInt(date.getHours())}${this.getSingleDateTimeValueFromInt(date.getMinutes())}${this.getSingleDateTimeValueFromInt(date.getSeconds())}`;
    }
    static getTimeFromDate(date:Date){
        return `${j4care.getSingleDateTimeValueFromInt(date.getHours())}:${j4care.getSingleDateTimeValueFromInt(date.getMinutes())}:${j4care.getSingleDateTimeValueFromInt(date.getSeconds())}`;
    }
    static getDateFromObject(object:{FullYear,Month,Date}){
        if(object.FullYear && object.Month && object.Date)
            return `${object.FullYear}${object.Month}${object.Date}`
        return ''
    }
    static getTimeFromObject(object:{Hours,Minutes,Seconds}){
        if(object.Hours && object.Minutes && object.Seconds)
            return `${object.Hours}:${object.Minutes}:${object.Seconds}`
        return ''
    }
    static isEqual(a,b){
        if(a && b && a === b)
            return true;
        return false;
    }
    static convertDateToString(date:Date){
        let datePipe = new DatePipe('en_US');
        if(_.isDate(date)){
            return datePipe.transform(date,'yyyyMMdd')
        }
        return '';
    }
    static getValue(key, object, defaultVal?){
        if(object[key])
            return object[key];
        else
            return defaultVal || '';
    }

/*    download(url){
        this.httpJ4car.refreshToken().subscribe((res)=>{
            let token;
            let a = document.createElement('a');

            if(res.length && res.length > 0){
                this.httpJ4car.resetAuthenticationInfo(res);
                token = res.token;
            }else{
                token = this.mainservice.global.authentication.token;
            }
            this.header.append('Authorization', `Bearer ${token}`);
            this.ngHttp.get(url,{
                        headers:this.header,
                        responseType: ResponseContentType.Blob
                    })
                .map(res => {
                        return new Blob([res['_body']], {
                            type: res.headers.get("Content-Type")
                        });
                })
                .subscribe((myBlob)=> {
                a.href = window.URL.createObjectURL(myBlob);
                let attr = document.createAttribute("download");
                a.setAttributeNode(attr);
                // a.download = filename; // Set the file name.
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
            });
        });
    }*/
    static convertBtoHumanReadable(value,mantissa?){
        let mantissaValue = 1000;
        if(mantissa == 0){
            mantissaValue = 1;
        }
        if(mantissa == 1){
            mantissaValue = 10;
        }
        if(mantissa == 2){
            mantissaValue = 100;
        }
        if(mantissa == 3){
            mantissaValue = 1000;
        }
        if (value > 2000000000){
            if(value > 1000000000000){
                return (Math.round((value / 1000 / 1000 / 1000 / 1000) * mantissaValue) / mantissaValue ) + ' TB';
            }else{
                return (Math.round((value / 1000 / 1000 / 1000) * mantissaValue) / mantissaValue ) + ' GB';
            }
        }else{
            return (Math.round((value / 1000 / 1000) * mantissaValue) / mantissaValue ) + ' MB';
        }
    }
    static millisecondsToHumanReadable(ms){
        return new Date(ms).toISOString().slice(11, -1);
    }
    static clearEmptyObject(obj){
        _.forEach(obj,(m,i)=>{
            if((!m || m === "" || m === undefined) && m != 0){
                delete obj[i];
            }
        });
        return obj;
    };

    static trimFilterObject(object){
        Object.keys(object).forEach(key=>{
            if(typeof object[key] === "string"){
                object[key] = object[key].trim();
            }else{
                object[key] = this.trimFilterObject(object[key]);
            }
        });
        return object;
    }

    static getUrlParams(params){
        return this.param(params);
    };
    static objToUrlParams(filter, addQuestionMarktPrefix?:boolean){
        try{
            if(filter){
                let filterMaped = Object.keys(filter).map((key) => {
                    if (filter[key] || filter[key] === false || filter[key] === 0){
                        console.log("trimmed",filter[key]);
                        return key + '=' + (typeof filter[key] === "string" ? filter[key].trim() : filter[key]);
                    }
                });
                let filterCleared = _.compact(filterMaped);
                return (addQuestionMarktPrefix && filterCleared && filterCleared.length > 0 ? "?" : "") + filterCleared.join('&');
            }
            return "";
        }catch (e) {
            console.error(e);
            return "";
        }
    }
    static param(filter){
        let paramString = j4care.objToUrlParams(filter);
        return paramString ? '?' + paramString : '';
    }
    get(url: string): Observable<any> {
        return new Observable((observer: Subscriber<any>) => {
            let objectUrl: string = null;
            this.$httpClient
                .get(url, {
                    headers:this.header,
                    responseType: "blob"
                })
                .subscribe(m => {
                    objectUrl = URL.createObjectURL(m);
                    observer.next(objectUrl);
                });

            return () => {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                }
            };
        });
    }
    static addZero(nr){
        if(nr < 10){
            return `0${nr}`;
        }
        return nr;
    };
    static convertToDateString(date){
        if(date != undefined){
            let dateConverted = new Date(date);
            let dateObject =  {
                yyyy:dateConverted.getFullYear(),
                mm:this.addZero(dateConverted.getMonth()+1),
                dd:this.addZero(dateConverted.getDate())
            };
            return `${dateObject.yyyy}${(dateObject.mm)}${dateObject.dd}`;
        }
    }
    static getLastMonthRangeFromNow(){
        let firstDate = new Date();
        firstDate.setMonth(firstDate.getMonth()-1);
        firstDate.setDate(firstDate.getDate()+1);
        return this.convertToDatePareString(firstDate,new Date());
    }
    static convertToDatePareString(firstDate,secondDate):string{
        if(j4care.isSet(firstDate) && firstDate != "" && j4care.isSet(secondDate) && secondDate != ""){
            let firstDateConverted = new Date(firstDate);
            let secondDateConverted = new Date(secondDate);

            let firstDateString = `${firstDateConverted.getFullYear()}${(this.addZero(firstDateConverted.getMonth()+1))}${this.addZero(firstDateConverted.getDate())}`;
            if(new Date(firstDate).getTime() == new Date(secondDate).getTime()){
                return firstDateString;
            }else{
                if(new Date(firstDate).getTime() > new Date(secondDate).getTime()){
                    return firstDateString;
                }else{
                    let secondDateString = `${secondDateConverted.getFullYear()}${this.addZero(secondDateConverted.getMonth()+1)}${this.addZero(secondDateConverted.getDate())}`;
                    return firstDateString === secondDateString ? firstDateString : `${firstDateString}-${secondDateString}`;
                }
            }
        }
        return undefined;
    }
    static flatten(data) {
        var result = {};
        function recurse(cur, prop) {
            if (Object(cur) !== cur) {
                result[prop] = cur;
            } else if (Array.isArray(cur)) {
                for (var i = 0, l = cur.length; i < l; i++)
                    recurse(cur[i], prop + "[" + i + "]");
                if (l == 0) result[prop] = [];
            } else {
                var isEmpty = true;
                for (var p in cur) {
                    isEmpty = false;
                    recurse(cur[p], prop ? prop + "." + p : p);
                }
                if (isEmpty && prop) result[prop] = {};
            }
        }
        recurse(data, "");
        return result;
    };
    static calculateWidthOfTable(table:(TableSchemaElement[]|any)){
        try{
            let sum = 0;
            let pxWidths = 0;
            let check = 0;
            table.forEach((m)=>{
                if(m){
                    if(_.hasIn(m,'pxWidth') && m.pxWidth){
                        pxWidths += m.pxWidth;
                    }else{
                        sum += m.widthWeight;
                    }
                }
            });
            if(pxWidths > 0){
                pxWidths += 1;
            }
            table.forEach((m)=>{
                if(m){
                    let procentualPart = (m.widthWeight * 100)/sum;
                    if(pxWidths > 0){
                        if(_.hasIn(m, "pxWidth") && m.pxWidth){
                            m.calculatedWidth = `${m.pxWidth}px`;
                        }else{
                            let pxPart = (procentualPart * 0.01 * pxWidths);
                            m.calculatedWidth = `calc(${procentualPart}% - ${pxPart}px)`;
                            check += pxPart;
                        }
                    }else{
                        m.calculatedWidth =  procentualPart + "%";
                    }
                }
            });
            console.log("calculated table",table);
            return table;
        }catch (e){
            this.log("Error on calculating width of table",e);
            return table;
        }

    };


    static valuesOf(attr) {
        return attr && attr.Value;
    }
    static valueOf(attr) {
        return attr && attr.Value && attr.Value[0];
    }

    static round(number:any, decimal?:number, asNumber?:boolean){
        decimal = decimal || 2;
        try{
            if(number && number != ""){
                if(typeof number === "number"){
                    if(asNumber)
                        return parseFloat(number.toFixed(decimal));
                    else
                        return number.toFixed(decimal);
                }else{
                    return _.round(number,decimal);
                }
            }
            return number;
        }catch (e) {
            this.log("Error on cutting the floating points, decimal()",e);
            return number;
        }
    }

    static encode64(inputStr) {
        let b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        let outputStr = "";
        let i = 0;

        while (i < inputStr.length) {
            let byte1 = inputStr.charCodeAt(i++) & 0xff;
            let byte2 = inputStr.charCodeAt(i++) & 0xff;
            let byte3 = inputStr.charCodeAt(i++) & 0xff;

            let enc1 = byte1 >> 2;
            let enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);

            let enc3, enc4;
            if (isNaN(byte2)) {
                enc3 = enc4 = 64;
            } else {
                enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
                if (isNaN(byte3)) {
                    enc4 = 64;
                } else {
                    enc4 = byte3 & 63;
                }
            }
            outputStr += b64.charAt(enc1) + b64.charAt(enc2) + b64.charAt(enc3) + b64.charAt(enc4);
        }
        return outputStr;
    }


    /*
    * Input
    * date:Date - javascript date
    * output:
    * timezone suffix like '+0200'
    * */
    static getTimezoneOffset(date:Date) {
        function z(n){return (n<10? '0' : '') + n}
        var offset = date.getTimezoneOffset();
        var sign = offset < 0? '+' : '-';
        offset = Math.abs(offset);
        return sign + z(offset/60 | 0) + z(offset%60);
    }

    /*
    * Input:
    * date:Date - javascript date
    * format:string - format as string
    * Output:
    * formatted date as string
    * defined format elements:
    * yyyy - 4 digit year
    * MM - month
    * dd - date
    * HH - Hour
    * mm - minute
    * ss - second
    * SSS - milliseconds
    * */
    static formatDate(date:Date, format:string, appendTimezoneOffset?:boolean):string{
        try{
            if(date && date.getFullYear()){
                format = format || 'yyyyMMdd';
                return format.replace(/(yyyy)|(MM)|(dd)|(HH)|(mm)|(ss)|(SSS)/g,(g1, g2, g3, g4, g5, g6, g7, g8)=>{
                    if(g2)
                        return `${date.getFullYear()}`;
                    if(g3)
                        return this.setZeroPrefix(`${date.getMonth() + 1}`);
                    if(g4)
                        return this.setZeroPrefix(`${date.getDate()}`);
                    if(g5)
                        return this.setZeroPrefix(`${date.getHours()}`);
                    if(g6)
                        return this.setZeroPrefix(`${date.getMinutes()}`);
                    if(g7)
                        return this.setZeroPrefix(`${date.getSeconds()}`);
                    if(g8)
                        return `${date.getMilliseconds()}`;
                }) + (appendTimezoneOffset ? j4care.getTimezoneOffset(date) : '');
            }
            return "";
        }catch (e) {
            this.log(`Error on formatting date, date=${date}, format=${format}`,e);
            return "";
        }
    }
    /*
    * Input:
    * range:string - javascript date
    * format:string - format as string
    * Output:
    * formatted date as string
    * defined format elements:
    * yyyy - 4 digit year
    * MM - month
    * dd - date
    * HH - Hour
    * mm - minute
    * ss - second
    * SSS - milliseconds
    * */
    static formatRangeString(range:string, format?:string):string{
        let localFormatRange = "yyyy-MM-dd HH:mm:ss";
        let singleFormat = "yyyy-MM-dd";
        let rangeObject:RangeObject = this.extractDateTimeFromString(range);
        if(rangeObject){
            if(rangeObject.mode === "range"){
                return `${this.formatDate(rangeObject.firstDateTime.dateObject,format || localFormatRange)} - ${this.formatDate(rangeObject.secondDateTime.dateObject,format || localFormatRange)}`;
            }
            if(rangeObject.mode === "single"){
                return `${this.formatDate(rangeObject.firstDateTime.dateObject,format || singleFormat)}`;
            }
        }
        return range;
    }
    /*
    *Adding 0 as prefix if the input is on  digit string for Example: 1 => 01
    */
    static setZeroPrefix(str){
        try{
            if(typeof str === "number"){
                str = str.toString();
            }
            return str.replace(/(\d*)(\d{1})/g,(g1, g2, g3)=>{
                if(!g2){
                    return `0${g3}`;
                }else{
                    return g1;
                }
            });
        }catch (e) {
            console.groupCollapsed("j4care setZeroPrefix(str)");
            console.error(e);
            console.groupEnd();
            return str;
        }
    }
    /*
    * create new Date javascript object while ignoring zone information in the date-time string
    * */
    static newDate(dateString:string):Date{
        try{
            return new Date(this.splitTimeAndTimezone(dateString).time);
        }catch (e) {
            return new Date(dateString);
        }
    }
    /*
    * Get difference of two date:Date, secondDate > firstDate return in the format HH:mm:ss:SSS
    * */
    static diff(firstDate:Date, secondDate:Date):string{
        try{
            let diff  = secondDate.getTime()  - firstDate.getTime();
            if(diff > -1){
                return `${
                    this.setZeroPrefix(parseInt(((diff/(1000*60*60))%24).toString()))
                    }:${
                    this.setZeroPrefix(parseInt(((diff/(1000*60))%60).toString()))
                    }:${
                    this.setZeroPrefix(parseInt(((diff/1000)%60).toString()))
                    }.${
                    parseInt((diff % 1000).toString())
                    }`;
            }
            return '';
        }catch (e) {
            console.groupCollapsed("j4care diff(date, date2)");
            console.error(e);
            console.groupEnd();
            return undefined;
        }
    }

    static getDifferenceTime(starttime, endtime,mode?){
        let start = new Date(starttime).getTime();
        let end = new Date(endtime).getTime();
        if (!start || !end || end < start){
            return null;
        }else{
            return this.msToTimeSimple(new Date(endtime).getTime() - new Date(starttime).getTime(),mode);
        }
    };

    static msToTimeSimple(duration,mode?) {
        if(mode)
            if(mode === "sec")
                return ((duration*6 / 6000).toFixed(4)).toString() + ' s';
            else
                return ((duration / 60000).toFixed(4)).toString() + ' min';
    }
    static msToTime(duration) {
        if (duration > 999){
            let milliseconds: any = parseInt((((duration % 1000))).toString());
            let seconds: any = parseInt(((duration / 1000) % 60).toString());
            let minutes: any = parseInt(((duration / (1000 * 60)) % 60).toString());
            let hours: any = parseInt(((duration / (1000 * 60 * 60))).toString());

            if (hours === 0){
                if (minutes === 0){
                    return seconds.toString() + '.' + milliseconds.toString() + $localize `:@@storage-commitment._sec: sec`;
                }else{
                    seconds = (seconds < 10) ? '0' + seconds : seconds;
                    return minutes.toString() + ':' + seconds.toString() + '.' + milliseconds.toString() + $localize `:@@storage-commitment._min: min`;
                }
            }else{
                hours = (hours < 10) ? '0' + hours : hours;
                minutes = (minutes < 10) ? '0' + minutes : minutes;
                seconds = (seconds < 10) ? '0' + seconds : seconds;

                return hours.toString() + ':' + minutes.toString() + ':' + seconds.toString() + '.' + milliseconds.toString() + $localize `:@@storage-commitment._h: h`;
            }
        }else{
            return duration.toString() + $localize `:@@storage-commitment._ms: ms`;
        }
    }

    modal(schema, callBack){
        this.openDialog(schema).subscribe(callBack);
    }
    // getDevices = ()=>this.httpJ4car.get('./rs/devices');

    static mapDevicesToDropdown(devices:Device[]):SelectDropdown<Device>[]|any{
        try{
            console.log("devices[0] instanceof SelectDropdown)", devices[0] instanceof SelectDropdown);
            if(devices && devices.length && devices.length > 0 && !(devices[0] instanceof SelectDropdown)){
                if(_.hasIn(devices, "0.value")){
                    return devices.map((device:any)=>new SelectDropdown(device.value, device.text));
                }else{
                    return devices.map((device:Device)=>new SelectDropdown(device.dicomDeviceName,device.dicomDeviceName,device.dicomDeviceDescription));
                }
            }
            return devices;
        }catch(e){
            this.log("Error on mapping devices", e);
            return devices;
        }
    }
    static mapAetToDropdown(aets:Aet[]):SelectDropdown<Aet>[]|any{
        try{
            console.log("aet[0] instanceof SelectDropdown)", aets[0] instanceof SelectDropdown);
            if(aets && aets.length && aets.length > 0 && !(aets[0] instanceof SelectDropdown)){
                if(_.hasIn(aets, "0.value")){
                    return aets.map((device:any)=>new SelectDropdown(device.value, device.text));
                }else{
                    return aets.map((device:Aet)=>new SelectDropdown(device.dicomAETitle,device.dicomAETitle,device.dicomDescription));
                }
            }
            return aets;
        }catch(e){
            this.log("Error on mapping aets", e);
            return aets;
        }
    }

    openDialog(parameters, width?, height?){
        this.dialogRef = this.dialog.open(ConfirmComponent, {
            height: height || 'auto',
            width: width || '500px'
        });
        this.dialogRef.componentInstance.parameters = parameters;
        return this.dialogRef.afterClosed();
    };
    static log(txt:string, e?:any){
        console.groupCollapsed(txt);
        console.trace();
        if(e)
            console.error(e);
        console.groupEnd();
    }

    static logObject(txt:string, object:Object){
        try{
            console.groupCollapsed(txt);
            Object.keys(object).forEach(key=>{
               console.log(`${key}:`,object[key]);
            });
            console.groupEnd();
        }catch(e){
            console.error(e);
        }
    }

    static getDateFromString(dateString:string):any|Date{
        let date:RangeObject = j4care.extractDateTimeFromString(dateString);
        if(date.mode === "single" || date.mode === "rightOpen"){
            return date.firstDateTime.dateObject;
        }
        if(date.mode === "range"){
            return new Date((date.firstDateTime.dateObject.getTime() + (date.secondDateTime.dateObject.getTime() - date.firstDateTime.dateObject.getTime()) / 2))
        }

        if(date.mode === "leftOpen"){
            return date.secondDateTime.dateObject
        }
        return dateString;
    }
    static convertFilterValueToRegex(value){
        return value ? `^${value.replace(/(\*|\?)/g,(match, p1)=>{
            if(p1 === "*"){
                return ".*";
            }
            if(p1 === "?")
                return ".";
        })}$`: '';
    }


    /*
    * Extending Array.join function so you can add to the last element a different join string
    * example: ["test1","test2","test3"] => "test1, test2 and test3" by calling join(["test1","test2","test3"],', ', " and ")
    * */
    static join(array:string[],joinString:string, lastJoinString?:string){
        try{
            if(array.length > 1){
                if(lastJoinString){
                    return `${array.slice(0,-1).join(joinString)}${lastJoinString}${array.slice(-1)}`;
                }else{
                    return array.join(joinString);
                }
            }else{
                return array.toString();
            }
        }catch(e){
            this.log("Error on join",e);
            return "";
        }
    }

    /*
    * get DicomNetworkConnection from reference
    * input:reference:string ("/dicomNetworkConnection/1"), dicomNetworkConnections[] (dicomNetworkConnections of a device)
    * return one dicomNetworkConnection
    * */
    static getConnectionFromReference(reference:string, connections:DicomNetworkConnection[]):(DicomNetworkConnection|string){
        try{
            const regex = /\w+\/(\d*)/;
            let match;
            if(reference && connections && (match = regex.exec(reference)) !== null){
                return connections[match[1]];
            }
            return reference;
        }catch (e) {
            this.log("Something went wrong on getting the connection from references",e);
            return reference;
        }
    }

    /*
    * Return the whole url from passed DcmWebApp
    * */
    static getUrlFromDcmWebApplication(dcmWebApp:DcmWebApp, baseUrl:string, withoutServicePath?:boolean):string{
        try{
            if(withoutServicePath){
                return `${this.getBaseUrlFromDicomNetworkConnection(dcmWebApp.dicomNetworkConnection || dcmWebApp.dicomNetworkConnectionReference) || ''}`;
            }
            return `${this.getBaseUrlFromDicomNetworkConnection(dcmWebApp.dicomNetworkConnection || dcmWebApp.dicomNetworkConnectionReference) || (baseUrl === "../" ? '': baseUrl)}${dcmWebApp.dcmWebServicePath}`.replace("/dcm4chee-arc/dcm4chee-arc","/dcm4chee-arc");;
        }catch (e) {
            this.log("Error on getting Url from DcmWebApplication",e);
            this.logObject("getUrlFromDcmWebApplication input:",{
                dcmWebApp:dcmWebApp,
                baseUrl:baseUrl,
                withoutServicePath:withoutServicePath
            });
        }
    }

    /*
    *Select one connection from the array of dicomnetowrkconnections and generate base url from that (http://localhost:8080)
    * */
    static getBaseUrlFromDicomNetworkConnection(conns:DicomNetworkConnection[]){
        try{
            let selectedConnection:DicomNetworkConnection;
            let filteredConnections:DicomNetworkConnection[];
            let connTemp;
            if(!_.isArray(conns) && conns){
                connTemp = [conns];
            }else{
                connTemp = conns;
            }
            //Get only connections with the protocol HTTP
            filteredConnections = connTemp.filter(conn=>{
                return this.getHTTPProtocolFromDicomNetworkConnection(conn) != '';
            });
            //If there are more than 1 than check if there is one with https protocol and return the first what you find.
            if(filteredConnections.length > 1){
                selectedConnection = filteredConnections.filter(conn=>{
                    return this.getHTTPProtocolFromDicomNetworkConnection(conn) === "https" && !(_.hasIn(conn,"dicomInstalled") && conn.dicomInstalled === false);
                })[0];
            }
            selectedConnection = selectedConnection || filteredConnections.filter(conn=>!(_.hasIn(conn,"dicomInstalled") && conn.dicomInstalled === false))[0];
            if(selectedConnection && _.hasIn(selectedConnection,"dicomHostname") && _.hasIn(selectedConnection, "dicomPort")){
                return `${this.getHTTPProtocolFromDicomNetworkConnection(selectedConnection)}://${selectedConnection.dicomHostname}:${selectedConnection.dicomPort}`;
            }else{
                return "";
            }
        }catch (e) {
            this.log("Something went wrong on getting base url from a dicom network connections",e);
            return "";
        }
    }

    /*
    * get Url from Dicom network Connection
    * */
    static getUrlFromDicomNetworkConnection(conns:DicomNetworkConnection){
        try{
            return `${this.getHTTPProtocolFromDicomNetworkConnection(conns)||'http'}://${conns.dicomHostname}:${conns.dicomPort}`;
        }catch (e) {
            return "";
        }
    }

    /*
    * If the passed connection has the protocol HTTP then return http or https otherwise return ''.
    * */
    static getHTTPProtocolFromDicomNetworkConnection(conn:DicomNetworkConnection):string{
        try{
            let pathToConn = '';
            if(_.hasIn(conn, "dcmNetworkConnection.dicomHostname")){
                pathToConn = "dcmNetworkConnection.";
            }
            if((_.hasIn(conn,`${pathToConn}dcmProtocol`) && _.get(conn,`${pathToConn}dcmProtocol`) === "HTTP") || !_.hasIn(conn,`${pathToConn}dcmProtocol`)){
                if(_.hasIn(conn, `${pathToConn}dicomTLSCipherSuite`) && _.isArray(<any[]>_.get(conn, `${pathToConn}dicomTLSCipherSuite`)) && (<any[]>_.get(conn, `${pathToConn}dicomTLSCipherSuite`)).length > 0){
                    return "https";
                }else{
                    return "http";
                }
            }
            return '';
        }catch (e) {
            this.log("Something went wrong on getting the protocol from a connection",e);
            return '';
        }
    }

    /*
    * get string with prefix and suffix if exist otherwise return empty string
    * */
    static meyGetString(object, path:string, prefix:string = "", suffix:string = "",showPrefixSuffixEvenIfEmpty?:boolean){
        if(_.hasIn(object, path)){
            return `${prefix}${_.get(object,path)}${suffix}`;
        }
        if(showPrefixSuffixEvenIfEmpty){
            return `${prefix}${suffix}`;
        }
        return "";
    }

    static changed(object, base, ignoreEmpty?:boolean) {
        function changes(object, base) {
            return _.transform(object, function(result, value, key) {
                if (!base || !_.isEqual(value, base[key])) {
                    if(ignoreEmpty){
                        if(_.isObject(value) && base && key && _.isObject(base[key])){
                            result[key] = changes(value, base[key])
                        }else{
                            if(!(_.isArray(value) && value.length === 0) && !(_.isObject(value) && Object.keys(value).length === 0) && value != undefined && value != "" && value != [""]){
                                result[key] = value;
                            }
                        }
                    }else{
                        result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
                    }
                }
            });
        }
        return changes(object, base);
    }

    static diffObjects(object, base, ignoreEmpty?:boolean, splited?:boolean){
        if(splited){
            const first:any = j4care.changed(object,base,ignoreEmpty);
            const second:any = j4care.changed(base, object, ignoreEmpty);
            return {
                first: first,
                second: second,
                diff:{...first,...second}
            }
        }else{
            return _.mergeWith(j4care.changed(object,base,ignoreEmpty), j4care.changed(base, object, ignoreEmpty));
        }
    }

    static intersection(firstObject, secondObject){
        if(_.isObject(firstObject) && _.isObject(secondObject)){
            let result = {};
            Object.keys(firstObject).forEach(k=>{
                if(_.hasIn(secondObject,k)){
                    result[k] = firstObject[k];
                }
            });
            return result;
        }
    }

    static generateOIDFromUUID(){
        let guid = uuid();                            //Generate UUID
        let guidBytes = `0${guid.replace(/-/g, "")}`; //add prefix 0 and remove `-`
        return `2.25.${bigInt(guidBytes,16).toString()}`;       //Output the previous parsed integer as string by adding `2.25.` as prefix
    }

    static position(element, behavior?:("auto"  | "smooth")){
        let pos = {};
        if(behavior)
            pos["behavior"] = behavior;
        pos["top"] = element.offsetTop;
        pos["left"] = element.offsetLeft;
        console.log("pos",pos);
        return pos;
    };

    static offset(el){
        let rect = el.getBoundingClientRect();
        return {
            top: rect.top + document.body.scrollTop,
            left: rect.left + document.body.scrollLeft
        }
    }

    static prepareCountMessage(preMessage:string, returnedObject:any){
        let msg = "<br>\n";
        try{
            if(_.hasIn(returnedObject,"count")){
                msg += $localize `:@@preparemsg.count:Count\:${returnedObject.count}:@@count:<br>\n`;
            }
            if(_.hasIn(returnedObject,"warning")){
                msg += $localize `:@@preparemsg.warning:Warning\:${returnedObject.warning}:@@warning:<br>\n`;
            }
            if(_.hasIn(returnedObject,"reject")){
                msg += $localize `:@@preparemsg.reject:Reject\:${returnedObject.reject}:@@reject:<br>\n`;
            }
            if(_.hasIn(returnedObject,"error")){
                msg += $localize `:@@preparemsg.error:Error\:${returnedObject.error}:@@error:<br>\n`;
            }
        }catch (e) {
            msg = "";
        }
        return `${preMessage}${msg != "" ? ':':''}${msg}`;
    }

    static extractLanguageDataFromString(ldapLanguageString:string){
        try{
            const regex = /([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)/;
            let m;
            if ((m = regex.exec(ldapLanguageString)) !== null) {
                return {
                    code:m[1],
                    name:m[2],
                    nativeName:m[3],
                    flag:m[4]
                }
            }
        }catch (e) {
            return undefined;
        }
        return undefined;
    }

    static getDefaultLanguageFromProfile(languageConfig:LanguageConfig,user:User){
        try{
            let validProfiles:LanguageProfile[] = languageConfig.dcmuiLanguageProfileObjects.filter((profile:LanguageProfile)=>{
                if(_.hasIn(profile, "dcmuiLanguageProfileUsername") && profile.dcmuiLanguageProfileUsername === user.user){
                    return true;
                }
                if(_.hasIn(profile, "dcmuiLanguageProfileRole")){
                    let valid = false;
                    profile.dcmuiLanguageProfileRole.forEach(role=>{
                        if(user.roles.indexOf(role) > -1){
                            valid = true;
                        }
                    });
                    return valid;
                }
                return false;
            });
            if(validProfiles && validProfiles.length > 0){
                return validProfiles[0].dcmDefaultLanguage;
            }
        }catch (e) {
            this.log("GetLanguageProfile in catch",e);
            if (_.hasIn(languageConfig,"dcmLanguages[0]")){
                return languageConfig.dcmLanguages[0];
            }
        }
    }

    static extractMessageFromWarningHeader(header:HttpHeaders){
        const regex = /(\d{3}) ([\w:\/-]*) (.*)/;
        let m;
        try{
            let warningMessage = header.get("Warning");
            if ((m = regex.exec(warningMessage)) !== null) {
                return m[3];
            }
        }catch (e) {
            return "";
        }
    }
    static is(object,path, value?){
        try{
            if(value && _.hasIn(object,path)){
                return value === _.get(object,path);
            }else{
                return _.hasIn(object,path) && _.get(object,path);
            }
        }catch (e){
            return false;
        }
    }

    static arrayIsNotEmpty(array, path?:string){
        try{
            return _.isArray(array) && array.length > 0;
        }catch (e){
            return false;
        }
    }

    static addLastSlash(url){
        if(_.last(url) != "/"){
            return `${url}/`;
        }else{
            return url;
        }
    }


    static MAP_STATUS_INDEX_TO_STRING(index:number):string{
        return [
            $localize `:@@NEW:NEW`,
            $localize `:@@IN_PROGRESS:IN PROGRESS`,
            $localize `:@@COMPLETED:COMPLETED`,
            $localize `:@@WARNING:WARNING`,
            $localize `:@@ERROR:ERROR`,
        ][index];
    }

    blobToUrl(blob:Blob):Observable<SafeUrl>{
        return new Observable(observer=>{
            try{
                let reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    let url:SafeUrl = this.sanitizer.bypassSecurityTrustUrl(<string> reader.result);
                    observer.next(url);
                    observer.complete();
                }
            }catch(e){
                observer.error(e);
                observer.complete();
            }
        });
    }



    static extractLastAetFromDiffPath(path){
        try{
            const regex = /diff\/(\w*)$/;
            let m;
            if ((m = regex.exec(path)) !== null) {
                return m[1];
            }
            return;
        }catch(e){
            j4care.log("Error on extratcing AET from path",e);
        }
    }

    static isFilesArray(files:(File[]|any)):boolean{
        try{
            return (files instanceof Array) && files.length > 0 && (files[0] instanceof File);
        }catch(e){
            return false;
        }
    }
}
