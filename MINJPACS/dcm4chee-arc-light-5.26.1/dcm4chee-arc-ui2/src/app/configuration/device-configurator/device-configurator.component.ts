import {Component, OnInit, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormElement} from '../../helpers/form/form-element';
import {DeviceConfiguratorService} from './device-configurator.service';
import * as _ from 'lodash-es';
import { combineLatest} from 'rxjs';
import {AppService} from '../../app.service';
import {ControlService} from '../control/control.service';
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import {AeListService} from "../ae-list/ae-list.service";
import {Hl7ApplicationsService} from "../hl7-applications/hl7-applications.service";
import {DevicesService} from "../devices/devices.service";
import {J4careHttpService} from "../../helpers/j4care-http.service";
import {LoadingBarService} from "@ngx-loading-bar/core";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";
import {j4care} from "../../helpers/j4care.service";
import { loadTranslations } from '@angular/localize';
import {LocalLanguageObject} from "../../interfaces";

@Component({
  selector: 'app-device-configurator',
  templateUrl: './device-configurator.component.html'
})
export class DeviceConfiguratorComponent implements OnInit, OnDestroy {
    formObj: FormElement<any>[];
    model;
    device;
    schema;
    showForm;
    params = [];
    recentParams;
    inClone;
    pressedKey = [];
    submitValue;
    isNew = false;
    searchBreadcrum = [];
    emptyExtension = false;
    currentSavedLanguage:LocalLanguageObject;
    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private service: DeviceConfiguratorService,
        private $http:J4careHttpService,
        private mainservice: AppService,
        private controlService: ControlService,
        private cfpLoadingBar: LoadingBarService,
        private httpErrorHandler:HttpErrorHandler,
        private aeService:AeListService,
        private hl7Service:Hl7ApplicationsService,
        private devicesService:DevicesService
    ) { }
    addModel(){
        let explod = this.params['device'].split('|');
        this.model = this.device[explod[1]];
    }
    submitFunction(value){
        let extensionAdded = false;
        let form;
        console.log('in submit');
        let $this = this;
        this.cfpLoadingBar.start();
        let deviceClone = _.cloneDeep(this.service.device);

        if(this.isNew && this.service.checkIfDuplicatedChild(value,this.recentParams)){
            $this.mainservice.showError($localize `:@@device-configurator.child_exist:Child already exist, change some value and try saving again!`);
            $this.cfpLoadingBar.complete();
        }else{
            if(this.inClone){
                let clonePart =  _.cloneDeep(_.get(this.service.device, this.recentParams.clone));
                this.service.replaceOldAETitleWithTheNew(clonePart,value.dicomAETitle);
                _.set(this.service.device,  this.recentParams.devicereff,  clonePart);
            }
            this.service.addChangesToDevice(value, this.recentParams.devicereff);
            if (_.hasIn(this.recentParams, 'schema')){
                let newSchema = this.service.getSchemaFromPath(this.service.schema, this.recentParams['schema']);
                let title = this.service.getBreadcrumbTitleFromModel(value, newSchema);
                this.service.breadcrumbs[this.service.breadcrumbs.length - 1].title = title;
                let key;
                let diff = j4care.diffObjects(_.get(deviceClone, this.recentParams.devicereff), value, true, true);
                if(_.hasIn(newSchema, "properties") || _.hasIn(newSchema, "items.properties")){
                    if(_.hasIn(newSchema, "properties")){
                        key = "properties";
                    }
                    if(_.hasIn(newSchema, "items.properties")){
                        key = "items.properties";
                    }
                }

                let schemaBase = _.get(newSchema, key);

                Object.keys(schemaBase).forEach(k=>{
                    if(_.hasIn(schemaBase[k],"use") && _.hasIn(diff,`diff.${k}`)){
                        this.service.setValueToReferences(_.get(diff,`first.${k}`), value[k], schemaBase[k]["use"]);
                    }
                });

                //Adding archive extension to the network ae if the device has archive extension
                if(
                    _.hasIn(this.service.device,"dcmArchiveDevice") &&
                    this.recentParams.schema === "properties.dicomNetworkAE" &&
                    _.hasIn(this.service.device,"dicomNetworkAE") &&
                    this.service.device.dicomNetworkAE.length > 0
                ){
                    _.forEach(this.service.device.dicomNetworkAE, (m,i)=>{
                        if(!_.hasIn(m,"dcmArchiveNetworkAE")){
                            this.service.device.dicomNetworkAE[i]["dcmArchiveNetworkAE"] = {};
                            extensionAdded = true;
                        }
                    });
                }
            }
            if (_.hasIn(this.service.breadcrumbs, '[1].title') && this.service.breadcrumbs[1].title === '[new_device]'){
                let createDevice = this.service.createDevice();
                if (createDevice){
                    createDevice
                        .subscribe(
                            (success) => {
                                console.log('succes', success);
                                $this.mainservice.showMsg($localize `:@@device-configurator.device_created:Device created successfully!`);
                                try {
                                    $this.recentParams = {};
                                    $this.service.breadcrumbs = $this.params = [
                                        {
                                            url: '/device/devicelist',
                                            title: $localize `:@@devicelist:devicelist`,
                                            prefixArray:[],
                                            suffixArray:[],
                                            allArray:[],
                                            devicereff: undefined,
                                            childObjectTitle:'',
                                            clone:this.inClone
                                        }
                                    ];
                                }catch (e){
                                    console.warn('error on chagning breadcrumbs', e);
                                }
                                $this.controlService.reloadArchive().subscribe((res) => {
                                    console.log('res', res);
                                    // $this.message = 'Reload successful';
                                    $this.mainservice.showMsg( $localize `:@@reload_successful:Reload successful`);
                                        $this.cfpLoadingBar.complete();
                                }, (err) => {
                                    $this.cfpLoadingBar.complete();
                                    }
                                );
                                setTimeout(() => {
                                    $this.router.navigateByUrl(`/device/edit/${value.dicomDeviceName}`);
                                }, 200);
                            },
                            (err) => {
                                _.assign($this.service.device, deviceClone);
                                console.log('error', err);
                                $this.httpErrorHandler.handleError(err);
                                $this.cfpLoadingBar.complete();
                            }

                        );
                }else{
                    _.assign($this.service.device, deviceClone);
                    console.warn('devicename is missing', this.service.device);
                    $this.mainservice.showError($localize `:@@device_name_missing:Device name is missing!`);
                }
            }else{
                let updateDevice = this.service.updateDevice();
                if (updateDevice){
                    updateDevice
                        .subscribe(
                            (success) => {
                                console.log('succes', success);
                                $this.mainservice.showMsg($localize `:@@device_saved:Device saved successfully!`);
                                if(extensionAdded){
                                    // $this.setFormFromParameters($this.recentParams, form);
                                    $this.deleteForm();
                                    $this.showForm = false;
                                    let url = window.location.hash.substr(1);
                                    if(url){
                                        setTimeout(() => {
                                            $this.router.navigateByUrl('blank').then(() => {
                                                $this.router.navigateByUrl(url);
                                                $this.showForm = true;
                                            });
                                        });
                                    }
                                }
                                $this.controlService.reloadArchive().subscribe((res) => {
                                    console.log('res', res);
                                    // $this.message = 'Reload successful';
                                    $this.mainservice.showMsg($localize `:@@reload_successful:Reload successful`);
                                    if(this.mainservice.deviceName === this.service.device.dicomDeviceName){
                                        try{
                                            let global = _.cloneDeep(this.mainservice.global);
                                            global["uiConfig"] =  _.get($this.service.device, "dcmDevice.dcmuiConfig[0]");
                                            this.mainservice.setGlobal(global);
                                        }catch (e){
                                            console.error("Ui Config could not be updated", e);
                                        }
                                    }
                                    $this.cfpLoadingBar.complete();
                                }, (err) => {

                                        $this.cfpLoadingBar.complete();
                                    }
                                );
                                $this.refreshExternalReferences();
                            },
                            (err) => {
                                _.assign($this.service.device, deviceClone);
                                console.log('error', err);
                                $this.httpErrorHandler.handleError(err);
                                $this.cfpLoadingBar.complete();
                            }

                        );
                }else{
                    _.assign($this.service.device, deviceClone);
                    $this.mainservice.showError($localize `:@@device_name_missing:Device name is missing!`);
                    console.warn('devicename is missing', this.service.device);
                    $this.cfpLoadingBar.complete();
                }
            }
        }
    }
    refreshExternalReferences(){
        this.getAes();
        this.getHl7ApplicationsList();
        this.getDevices();
    }
    getAes(){
        let $this = this;
        this.aeService.getAes()
            .subscribe((response) => {
                if ($this.mainservice.global && !$this.mainservice.global.aes){
                    let global = _.cloneDeep($this.mainservice.global);
                    global.aes = response;
                    $this.mainservice.setGlobal(global);
                }else{
                    if ($this.mainservice.global && $this.mainservice.global.aes){
                        $this.mainservice.global.aes = response;
                    }else{
                        $this.mainservice.setGlobal({aes: response});
                    }
                }
            }, (response) => {
                // vex.dialog.alert("Error loading aes, please reload the page and try again!");
            });
        // }
    }
    getHl7ApplicationsList(){
        let $this = this;
        this.hl7Service.getHl7ApplicationsList('').subscribe(
            (response)=>{
                if ($this.mainservice.global && !$this.mainservice.global.hl7){
                    let global = _.cloneDeep($this.mainservice.global); //,...[{hl7:response}]];
                    global.hl7 = response;
                    $this.mainservice.setGlobal(global);
                }else{
                    if ($this.mainservice.global && $this.mainservice.global.hl7){
                        $this.mainservice.global.hl7 = response;
                    }else{
                        $this.mainservice.setGlobal({hl7: response});
                    }
                }
            },
            (err)=>{
            }
        );
    }
    getDevices(){
        let $this = this;
        this.devicesService.getDevices().subscribe((response) => {
            if ($this.mainservice.global && !$this.mainservice.global.devices){
                let global = _.cloneDeep($this.mainservice.global); //,...[{devices:response}]];
                global.devices = response;
                $this.mainservice.setGlobal(global);
            }else{
                if ($this.mainservice.global && $this.mainservice.global.devices){
                    $this.mainservice.global.devices = response;
                }else{
                    $this.mainservice.setGlobal({devices: response});
                }
            }
        }, (err) => {
            // vex.dialog.alert("Error loading device names, please reload the page and try again!");
        });
        // }
    };
    ngOnInit(){
        this.currentSavedLanguage = <LocalLanguageObject> JSON.parse(localStorage.getItem('current_language'));
        this.initCheck(10);
    }
    initCheck(retries){
        let $this = this;
        if((KeycloakService.keycloakAuth && KeycloakService.keycloakAuth.authenticated) || (_.hasIn(this.mainservice,"global.notSecure") && this.mainservice.global.notSecure)){
            this.init();
        }else{
            if (retries){
                setTimeout(()=>{
                    $this.initCheck(retries-1);
                },20);
            }else{
                this.init();
            }
        }
    }
    init() {
        let $this = this;
        let form;
        this.params = $this.service.breadcrumbs;
        this.inClone = false;
        this.service.breadcrumbs.forEach((m, i)=>{
            this.searchBreadcrum[i] = '';
        });
        $this.cfpLoadingBar.start();
        this.route.params
            .subscribe((params) => {
                if(this.service.device && !_.hasIn(this.service.device,params.devicereff)){
                    console.log("this.service.device",this.service.device);
                    // _.set(this.service.device,"dcmDevice.dcmArchiveDevice",{});
                    this.emptyExtension = true;
                }
                console.log("allOptions",this.service.allOptions);
                if (
                    ($this.service.breadcrumbs.length < 3) // If the deepest breadcrumb level is the device than go one
                        ||
                    (_.size(params.devicereff) < _.size($this.service.breadcrumbs[$this.service.breadcrumbs.length - 1].devicereff)) //If the user goes back allow it
                        ||
                    (
                        $this.service.breadcrumbs.length > 2 &&
                        _.hasIn($this.service.breadcrumbs, [$this.service.breadcrumbs.length - 1, 'devicereff']) &&
                        $this.service.breadcrumbs[$this.service.breadcrumbs.length - 1].devicereff &&
                        _.hasIn(this.service.device, $this.service.breadcrumbs[$this.service.breadcrumbs.length - 1].devicereff)
                    )
                ){
                $this.recentParams = params;
                // $this.service.getSchema('device.schema.json').subscribe(schema => {
                /*                $this.formObj = undefined;
                 $this.model = undefined;*/
                if (!(_.hasIn(params, 'devicereff') && _.hasIn(params, 'schema')) || !$this.service.schema) {
                    let newBreadcrumbObject = {
                        url: '/device/edit/' + params['device'],
                        title: params['device'],
                        prefixArray:[],
                        suffixArray:[],
                        allArray:[],
                        devicereff: '',
                        childObjectTitle:'',
                        clone:this.inClone
                    };
                    let newBreadcrumbIndex = _.findIndex($this.service.breadcrumbs, (p) => {
                        return p.url === newBreadcrumbObject.url;
                    });
                    if (newBreadcrumbIndex > -1) {
                        let droppedBreadcrumbs = _.dropRight($this.service.breadcrumbs, $this.service.breadcrumbs.length - newBreadcrumbIndex - 1);
                        $this.service.breadcrumbs = droppedBreadcrumbs;
                        $this.params = droppedBreadcrumbs;
                    } else {
                        $this.service.breadcrumbs.push(newBreadcrumbObject);
                    }
                        let deviceSchemaURL = `./assets/schema/device.schema.json`;
                        if(_.hasIn(this.currentSavedLanguage,"language.code") && this.currentSavedLanguage.language.code && this.currentSavedLanguage.language.code != "en"){
                            deviceSchemaURL = `./assets/schema/${this.currentSavedLanguage.language.code}/device.schema.json`;
                        }
                        if (params['device'] == '[new_device]') {
                            $this.$http.get(deviceSchemaURL)
                                // .map(res => {let resjson; try{ let pattern = new RegExp("[^:]*:\/\/[^\/]*\/auth\/"); if(pattern.exec(res.url)){ WindowRefService.nativeWindow.location = "/dcm4chee-arc/ui2/";} resjson = res; }catch (e){ resjson = [];} return resjson;})
                                .subscribe((schema) => {
                                $this.showForm = false;
                                $this.device = {};
                                $this.service.device = {};
                                $this.schema = schema;
                                $this.service.schema = schema;
                                let formObject = $this.service.convertSchemaToForm($this.device, $this.schema, params, 'attr');
                                $this.formObj = formObject;
                                $this.model = {};
                                setTimeout(() => {
                                    $this.showForm = true;
                                    $this.cfpLoadingBar.complete();
                                }, 1);
                            });
                        } else {

                            combineLatest(
                                $this.service.getDevice(params['device']),
                                $this.$http.get(deviceSchemaURL)
                                    // .map(res => {let resjson; try{ let pattern = new RegExp("[^:]*:\/\/[^\/]*\/auth\/"); if(pattern.exec(res.url)){ WindowRefService.nativeWindow.location = "/dcm4chee-arc/ui2/";} resjson = res; }catch (e){ resjson = [];} return resjson;})
                            ).subscribe(deviceschema => {
                                $this.service.device = deviceschema[0];
                                $this.service.schema = deviceschema[1];
                                if (_.hasIn(params, 'devicereff') && _.hasIn(params, 'schema')){
                                    this.setFormFromParameters(params, form);
                                }else{
                                    $this.showForm = false;
                                    console.log('deviceschema', deviceschema);
                                    $this.device = deviceschema[0];
                                    $this.schema = deviceschema[1];
                                    let formObject = $this.service.convertSchemaToForm($this.device, $this.schema, params, ( this.inClone || this.isNew || this.emptyExtension) ? 'attr':'ext');
                                    $this.formObj = formObject;
                                    $this.model = {};
                                    setTimeout(() => {
                                        $this.cfpLoadingBar.complete();
                                        $this.showForm = true;
                                    }, 1);
                                }
                            },(err)=>{
                                console.log("error",err);
                                $this.cfpLoadingBar.complete();
                                $this.httpErrorHandler.handleError(err);
                            });
                        }
                    // }
                } else {
                    this.setFormFromParameters(params, form);
                }
            }else {
                //We assume that the user tryes to go one level deeper than allowed
                $this.mainservice.showError($localize `:@@device-configurator.parent_dont_exist:Parent didn't exist, save first the parent`);
                $this.router.navigateByUrl($this.service.breadcrumbs[$this.service.breadcrumbs.length - 1].url);
                $this.cfpLoadingBar.complete();
            }
            });

    }

    setFormFromParameters(params, form){
        let $this = this;
        let newModel: any = {};
        let newSchema = $this.service.getSchemaFromPath($this.service.schema, params['schema']);
        if (_.hasIn(params, 'clone')){
            newModel = _.get(this.service.device, params['clone']);
            //TODO
            if(params["schema"] === "properties.dicomNetworkAE"){

            }
            this.inClone = true;
        }else{
            newModel = _.get(this.service.device, params['devicereff']);
        }
        if (newSchema === null){
            this.service.getSchemaDeep($this.service.schema, params["schema"]).subscribe(schema=>{
                $this.service.schema = schema;
                newSchema = _.get(schema, params["schema"]);
                let title = $this.service.getBreadcrumbTitleFromModel(newModel, newSchema);
                if(title == '[NEW]'){
                    this.isNew = true;
                }else{
                    this.isNew = false;
                }
                let prefixSuffix;
                let newUrl = '/device/edit/' + params['device'] + '/' + params['devicereff'] + '/' + params['schema'];
                if(this.inClone)
                    prefixSuffix = this.service.getPrefixAndSuffixArray(newUrl,this.service.allOptions[params['clone']]);
                else
                    prefixSuffix = this.service.getPrefixAndSuffixArray(newUrl,this.service.allOptions[params['schema']]);

                let newBreadcrumbObject = {
                    url: newUrl,
                    // title:_.replace(newTitle,lastreff,''),
                    title: title,
                    prefixArray:prefixSuffix.prefix,
                    suffixArray:prefixSuffix.suffix,
                    allArray:[...prefixSuffix.prefix,...prefixSuffix.suffix],
                    devicereff: params['devicereff'],
                    materialIconName:this.service.getMaterialIconNameForBreadcrumbs(params['devicereff']),
                    childObjectTitle: (newSchema && newSchema.title) ? newSchema.title : '',
                    clone:this.inClone
                };
                // this.service.generateMissingBreadcrumbs($this.service.breadcrumbs, params);
                // console.log("missingbreadcrumb",this.service.getMissingBreadcrumbObjects(newBreadcrumbObject, []));
                this.service.breadcrumbs = [...this.service.breadcrumbs, ...this.service.getMissingBreadcrumbObjects(newBreadcrumbObject, [])];
                let newBreadcrumbIndex = _.findIndex($this.service.breadcrumbs, (p) => {
                    return this.service.isSameSiblingUrl(p.url,newBreadcrumbObject.url);
                });
                if (newBreadcrumbIndex > -1) {
                    let droppedBreadcrumbs = _.dropRight($this.service.breadcrumbs, $this.service.breadcrumbs.length - newBreadcrumbIndex - 1);
                    if(this.service.isSameSiblingUrl(newUrl, droppedBreadcrumbs[droppedBreadcrumbs.length-1].url) && newUrl !== droppedBreadcrumbs[droppedBreadcrumbs.length-1].url){
                        droppedBreadcrumbs[droppedBreadcrumbs.length-1] = newBreadcrumbObject;
                    }
                    $this.service.breadcrumbs = droppedBreadcrumbs;
                    $this.params = droppedBreadcrumbs;

                } else {

                    if(this.service.isSameSiblingUrl(this.service.breadcrumbs[this.service.breadcrumbs.length-1].url,newBreadcrumbObject.url)){
                        this.service.breadcrumbs[this.service.breadcrumbs.length-1] = newBreadcrumbObject;
                        $this.params = this.service.breadcrumbs;
                    }else{
                        $this.service.breadcrumbs.push(newBreadcrumbObject);
                        $this.params = this.service.breadcrumbs;
                    }
                }

                $this.deleteForm();
                $this.showForm = false;
                $this.model = newModel;
                if (_.hasIn(newSchema, '$ref') || _.hasIn(newSchema, 'items.$ref') || _.hasIn(newSchema, 'properties.$ref')) {
                    let schemaName;
                    let deleteRef;
                    let refPath = '';
                    if (_.hasIn(newSchema, 'properties.$ref')) {
                        schemaName = newSchema.properties.$ref;
                        refPath = 'properties';
                        deleteRef = () => {
                            delete newSchema.properties.$ref;
                        };
                    }
                    if (_.hasIn(newSchema, 'items.$ref')) {
                        schemaName = newSchema.items.$ref;
                        refPath = 'items';
                        deleteRef = () => {
                            delete newSchema.items.$ref;
                        };
                    }
                    if (_.hasIn(newSchema, '$ref')) {
                        schemaName = newSchema.$ref;
                        deleteRef = () => {
                            delete newSchema.$ref;
                        };
                    }
                    $this.service.getSchema(schemaName).subscribe(subRefSchema => {
                            deleteRef();
                            if (refPath === '') {
                                _.merge(newSchema, subRefSchema);
                            } else {
                                _.set(newSchema, refPath, subRefSchema);
                                refPath = '.' + refPath;
                            }
                            if(this.inClone){
                                //TODO
                            }
                            _.set($this.service.schema, params['schema'], newSchema);
                            form = $this.service.convertSchemaToForm($this.model, newSchema, params, (this.inClone||this.isNew || this.emptyExtension)?'attr':'ext');
                            $this.formObj = form;
                            setTimeout(() => {
                                $this.showForm = true;
                                $this.cfpLoadingBar.complete();
                            }, 1);
                        }, (err) => {
                            $this.cfpLoadingBar.complete();
                        }
                    );
                } else {
                    // let newSchema = $this.service.getSchemaFromPath($this.service.schema,schemaparam);
                    form = $this.service.convertSchemaToForm(newModel, newSchema, params, (this.inClone||this.isNew || this.emptyExtension)?'attr':'ext');
                    _.set($this.service.schema, params['schema'], newSchema);
                    $this.formObj = form;
                    setTimeout(() => {
                        $this.showForm = true;
                        $this.cfpLoadingBar.complete();
                    }, 1);
                    // this._changeDetectionRef.detectChanges();

                }
            });
/*            if (_.hasIn(params, 'device')){
                this.router.navigateByUrl(`/device/edit/${params['device']}`);
            }else{
                this.router.navigateByUrl('/device/devicelist');
            }*/
        }else{

            let title = $this.service.getBreadcrumbTitleFromModel(newModel, newSchema);
            if(title == '[NEW]'){
                this.isNew = true;
            }else{
                this.isNew = false;
            }
            let prefixSuffix;
            let newUrl = '/device/edit/' + params['device'] + '/' + params['devicereff'] + '/' + params['schema'];
            if(this.inClone)
                prefixSuffix = this.service.getPrefixAndSuffixArray(newUrl,this.service.allOptions[params['clone']]);
            else
                prefixSuffix = this.service.getPrefixAndSuffixArray(newUrl,this.service.allOptions[params['schema']]);

            let newBreadcrumbObject = {
                url: newUrl,
                // title:_.replace(newTitle,lastreff,''),
                title: title,
                prefixArray:prefixSuffix.prefix,
                suffixArray:prefixSuffix.suffix,
                allArray:[...prefixSuffix.prefix,...prefixSuffix.suffix],
                devicereff: params['devicereff'],
                materialIconName:this.service.getMaterialIconNameForBreadcrumbs(params['devicereff']),
                childObjectTitle: (newSchema && newSchema.title) ? newSchema.title : '',
                clone:this.inClone
            };
            let newBreadcrumbIndex = _.findIndex($this.service.breadcrumbs, (p) => {
                return this.service.isSameSiblingUrl(p.url,newBreadcrumbObject.url);
            });
            if (newBreadcrumbIndex > -1) {
                let droppedBreadcrumbs = _.dropRight($this.service.breadcrumbs, $this.service.breadcrumbs.length - newBreadcrumbIndex - 1);
                if(this.service.isSameSiblingUrl(newUrl, droppedBreadcrumbs[droppedBreadcrumbs.length-1].url) && newUrl !== droppedBreadcrumbs[droppedBreadcrumbs.length-1].url){
                    droppedBreadcrumbs[droppedBreadcrumbs.length-1] = newBreadcrumbObject;
                }
                $this.service.breadcrumbs = droppedBreadcrumbs;
                $this.params = droppedBreadcrumbs;

            } else {

                if(this.service.isSameSiblingUrl(this.service.breadcrumbs[this.service.breadcrumbs.length-1].url,newBreadcrumbObject.url)){
                    this.service.breadcrumbs[this.service.breadcrumbs.length-1] = newBreadcrumbObject;
                    $this.params = this.service.breadcrumbs;
                }else{
                    $this.service.breadcrumbs.push(newBreadcrumbObject);
                    $this.params = this.service.breadcrumbs;
                }
            }

            $this.deleteForm();
            $this.showForm = false;
            $this.model = newModel;
            if (_.hasIn(newSchema, '$ref') || _.hasIn(newSchema, 'items.$ref') || _.hasIn(newSchema, 'properties.$ref')) {
                let schemaName;
                let deleteRef;
                let refPath = '';
                if (_.hasIn(newSchema, 'properties.$ref')) {
                    schemaName = newSchema.properties.$ref;
                    refPath = 'properties';
                    deleteRef = () => {
                        delete newSchema.properties.$ref;
                    };
                }
                if (_.hasIn(newSchema, 'items.$ref')) {
                    schemaName = newSchema.items.$ref;
                    refPath = 'items';
                    deleteRef = () => {
                        delete newSchema.items.$ref;
                    };
                }
                if (_.hasIn(newSchema, '$ref')) {
                    schemaName = newSchema.$ref;
                    deleteRef = () => {
                        delete newSchema.$ref;
                    };
                }
                $this.service.getSchema(schemaName).subscribe(subRefSchema => {
                    deleteRef();
                    if (refPath === '') {
                        _.merge(newSchema, subRefSchema);
                    } else {
                        _.set(newSchema, refPath, subRefSchema);
                        refPath = '.' + refPath;
                    }
                    if(this.inClone){
                        //TODO
                    }
                    _.set($this.service.schema, params['schema'], newSchema);
                    form = $this.service.convertSchemaToForm($this.model, newSchema, params, (this.inClone||this.isNew || this.emptyExtension)?'attr':'ext');
                    $this.formObj = form;
                    setTimeout(() => {
                        $this.showForm = true;
                        $this.cfpLoadingBar.complete();
                    }, 1);
                }, (err) => {
                    $this.cfpLoadingBar.complete();
                }
                );
            } else {
                // let newSchema = $this.service.getSchemaFromPath($this.service.schema,schemaparam);
                form = $this.service.convertSchemaToForm(newModel, newSchema, params, (this.inClone||this.isNew || this.emptyExtension)?'attr':'ext');
                _.set($this.service.schema, params['schema'], newSchema);
                $this.formObj = form;
                setTimeout(() => {
                    $this.showForm = true;
                    $this.cfpLoadingBar.complete();
                }, 1);
                // this._changeDetectionRef.detectChanges();

            }
        }
    }
    deleteForm(){
        this.model = {};
        this.formObj = [];
    }
    clearSearch(){
        this.searchBreadcrum.forEach((m,i) =>{
            this.searchBreadcrum[i] = '';
        });
    }
    fireBreadcrumb(breadcrumb){
        this.clearSearch();
        if (breadcrumb.url ===  '/device/devicelist'){ // for some reason when the user visited the device configurator and than comes back while trying to create new device, the old device is still in the breadcrumb
            this.params = this.service.breadcrumbs = [
                 {
                     url: '/device/devicelist',
                     title: $localize `:@@devicelist:devicelist`,
                     prefixArray:[],
                     suffixArray:[],
                     allArray:[],
                     devicereff: undefined,
                     childObjectTitle:'',
                     clone:this.inClone
                 }
             ];
        }
        this.router.navigateByUrl(breadcrumb.url);
    }
    hoveredElement(element){
            console.log("element",element);
            console.log("device",this.service.device);
            console.log("obj",this.service.getObjectsFromPath(element.url));
    }
    toCompareObject;
    toCompareFormelement;
    showCompare = false;
    compare(element){
        console.log("param",this.params);
        this.showCompare = false;
        this.toCompareObject = undefined;
        this.toCompareObject = undefined;
        setTimeout(()=>{
            let objects = this.service.getObjectsFromPath(element.url);
            this.toCompareFormelement =  this.service.convertSchemaToForm(objects.model, objects.schemaObject, {
                device:'dcm4chee-arc',
                devicereff:objects.devicereff,
                schema:objects.schema
            },(this.inClone||this.isNew || this.emptyExtension)?'attr':'ext');
            this.toCompareObject = objects.model;
            this.showCompare = true;
        },1)
    }
        ngOnDestroy(){
/*            this.service.breadcrumbs = [
                {
                    url: '/device/devicelist',
                    title: 'devicelist',
                    devicereff: undefined
                }
            ];*/
            console.log("param",this.recentParams);
            console.log("ondestroy",this.service.breadcrumbs);
        }
}
