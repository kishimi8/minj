import {Component, OnInit, ViewContainerRef} from '@angular/core';
import * as _ from 'lodash-es';
import {ConfirmComponent} from '../../widgets/dialogs/confirm/confirm.component';
import {AppService} from '../../app.service';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import {DevicesService} from './devices.service';
import {HostListener} from '@angular/core';
import {CreateExporterComponent} from '../../widgets/dialogs/create-exporter/create-exporter.component';
import {Router} from '@angular/router';
import {WindowRefService} from "../../helpers/window-ref.service";
import {Hl7ApplicationsService} from "../hl7-applications/hl7-applications.service";
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import {J4careHttpService} from "../../helpers/j4care-http.service";
import {DeviceConfiguratorService} from "../device-configurator/device-configurator.service";
import {LoadingBarService} from "@ngx-loading-bar/core";
import {Globalvar} from "../../constants/globalvar";
import {HttpHeaders} from "@angular/common/http";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";
import {j4care} from "../../helpers/j4care.service";
import {SelectDropdown} from "../../interfaces";
import {WebAppsListService} from "../web-apps-list/web-apps-list.service";
import { loadTranslations } from '@angular/localize';
import {DeviceCloneComponent} from "../../widgets/dialogs/device-clone/device-clone.component";

@Component({
  selector: 'app-devices',
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit{
    debugpre = false;
    _ = _;
    devices;
    advancedConfig = false;
    filterHeight = 2;
    showDeviceList= true;
    devicefilter = '';
    filter = {};
    moreDevices = {
        limit: 30,
        start: 0,
        loaderActive: false
    };
    aes;
    dialogRef: MatDialogRef<any>;
    filterSchema;
    w = 2;
    moreFunctionConfig = {
        placeholder: $localize `:@@more_functions:More functions`,
        options:[
            new SelectDropdown("create_exporter",$localize `:@@devices.create_exporter:Create exporter`),
            new SelectDropdown("create_device",$localize `:@@devices.create_device:Create device`)
        ],
        model:undefined
    };

    constructor(
        public $http:J4careHttpService,
        public cfpLoadingBar: LoadingBarService,
        public mainservice: AppService,
        public viewContainerRef: ViewContainerRef ,
        public dialog: MatDialog,
        public config: MatDialogConfig,
        public service: DevicesService,
        private router: Router,
        private hl7service:Hl7ApplicationsService,
        public httpErrorHandler:HttpErrorHandler,
        private deviceConfigurator:DeviceConfiguratorService,
        private webAppListService:WebAppsListService
    ) {}
    ngOnInit(){
        this.initCheck(10);
        this.filterSchema = this.service.getFiltersSchema();
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
    init(){
        this.getDevices();
        this.getAes();
        this.getHl7ApplicationsList(2);
        this.getWebApps(2);
        console.log("deviceconfiguratorservice paginantion",this.deviceConfigurator.breadcrumbs)
        if(this.deviceConfigurator.breadcrumbs){
            this.deviceConfigurator.breadcrumbs = [
                {
                    url: '/device/devicelist',
                    title: 'devicelist',
                    devicereff: undefined
                }
            ];
        }
    }

    @HostListener('window:scroll', ['$event'])
    loadMoreDeviceOnScroll(event) {
        // let hT = ($('.load_more').offset()) ? $('.load_more').offset().top : 0,
        let hT = WindowRefService.nativeWindow.document.getElementsByClassName("load_more")[0] ? j4care.offset(WindowRefService.nativeWindow.document.getElementsByClassName("load_more")[0]).top : 0,
            hH =  WindowRefService.nativeWindow.document.getElementsByClassName("load_more")[0].offsetHeight,
            wH = WindowRefService.nativeWindow.innerHeight,
            wS = window.pageYOffset;
        if (wS > (hT + hH - wH)){
            this.loadMoreDevices();
        }
    }
    moreFunctionChanged(e){
        if(e === "create_exporter")
            this.createExporter();
        if(e === "create_device")
            this.createDevice();
        setTimeout(()=>{
            this.moreFunctionConfig.model = undefined;
        },1);
    }
    editDevice(devicename){
        if (devicename && devicename != ''){
            this.router.navigateByUrl('/device/edit/' + devicename);
        }
    }
    loadMoreDevices(){
        this.moreDevices.loaderActive = true;
        this.moreDevices.limit += 20;
        // if(this.moreDevices.limit > 50){
            // this.moreAes.start +=20;
        // }
        this.moreDevices.loaderActive = false;
    }
    searchDevices(e?){
        this.cfpLoadingBar.start();
        let $this = this;
        this.$http.get(
            `${j4care.addLastSlash(this.mainservice.baseUrl)}devices${j4care.param(this.filter)}`
        )
            // .map(res => {let resjson; try{ let pattern = new RegExp("[^:]*:\/\/[^\/]*\/auth\/"); if(pattern.exec(res.url)){ WindowRefService.nativeWindow.location = "/dcm4chee-arc/ui2/";} resjson = res; }catch (e){ resjson = [];} return resjson;})
        .subscribe((response) => {
            $this.devices = response;
            $this.cfpLoadingBar.complete();
        }, function errorCallback(response) {
/*            $log.error("Error loading device names", response);
            vex.dialog.alert("Error loading device names, please reload the page and try again!");*/
        });
    };

    clearForm(){
        let $this = this;
        _.forEach($this.filter, (m, i) => {
            $this.filter[i] = '';
        });
        this.searchDevices();
    };

    confirm(confirmparameters){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(ConfirmComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.parameters = confirmparameters;
        return this.dialogRef.afterClosed();
    };
    deleteDevice(device) {
        if (device && device.dicomDeviceName) {
            let $this = this;
            this.confirm({
                content: $localize `:@@devices.are_you_sure_you_want_to_delete_the_device_:Are you sure you want to delete the device ${device.dicomDeviceName}:@@dicomDeviceName:?`
            }).subscribe(result => {
                if (result){
                    $this.cfpLoadingBar.start();
                    $this.$http.delete(`${j4care.addLastSlash(this.mainservice.baseUrl)}devices/${device.dicomDeviceName}`).subscribe((res) => {
                        $this.mainservice.showMsg($localize `:@@device_deleted_successfully:Device deleted successfully!`);
                        $this.getDevices();
                        $this.cfpLoadingBar.complete();
                    }, (err) => {
                        $this.httpErrorHandler.handleError(err);
                        $this.cfpLoadingBar.complete();
                    });
                }
            });
        }
    };

    cloneDevice(devicename){
        let $this = this;
        this.$http.get(`${j4care.addLastSlash(this.mainservice.baseUrl)}devices/${devicename.dicomDeviceName}`).subscribe((device) => {
            let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
            let deviceNameList = this.devices.map(res => {
                return res.dicomDeviceName;
            });

            this.config.viewContainerRef = this.viewContainerRef;
            this.dialogRef = this.dialog.open(DeviceCloneComponent, {
                height: 'auto',
                width: '90vw'
            });
            this.dialogRef.componentInstance.device = device;
            this.dialogRef.afterClosed().subscribe(cloneDevice=>{
                console.log("cloneDevice",cloneDevice);
                if(cloneDevice){
                    this.cfpLoadingBar.start();
                    this.service.createDevice(_.get(cloneDevice, "dicomDeviceName"), cloneDevice).subscribe(res => {
                            console.log('res succes', res);
                            $this.cfpLoadingBar.complete();
                            $this.mainservice.showMsg($localize `:@@devices.device_cloned:Device cloned successfully!`);

                            $this.cloneVendorData(devicename.dicomDeviceName, _.get(cloneDevice, "dicomDeviceName"));
                            $this.service.getAes().subscribe((response) => {
                                $this.aes = response;
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
                            });
                            $this.cfpLoadingBar.complete();
                            $this.getWebApps(0);
                        },
                        err => {
                            console.log('error');
                            $this.cfpLoadingBar.complete();
                            $this.httpErrorHandler.handleError(err);
                        });
                }
            });
        }, (err) => {
            this.httpErrorHandler.handleError(err);
            this.cfpLoadingBar.complete();
        });
    };
    cloneVendorData(oldDeviceName, newDeviceName){
        this.cfpLoadingBar.start();
        this.service.cloneVendorData(oldDeviceName, newDeviceName).subscribe(res=>{
            this.cfpLoadingBar.complete();
            this.mainservice.showMsg($localize `:@@vendor_data_cloned_successfully:Vendor data cloned successfully`);
            this.getDevices();
        },err=>{
            this.cfpLoadingBar.complete();
            this.mainservice.showError($localize `:@@error_on_cloning_vendor_data:Error on cloning vendor data!`);
            j4care.log("Error on cloning vendordata",err);
            this.getDevices();
        });
    }
    createExporter(){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(CreateExporterComponent, {
            height: 'auto',
            width: '90%'
        });
        let $this = this;
        this.dialogRef.componentInstance.devices = this.devices.filter((dev)=>{
            return (_.hasIn(dev,"hasArcDevExt") && dev.hasArcDevExt === true);
        });
        this.dialogRef.componentInstance.aes = this.aes;
        this.dialogRef.afterClosed().subscribe(re => {
            console.log('re', re);
            if (re && re.device && re.device.dicomDeviceName && re.exporter){
                let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
                let i = 0;
                if(_.hasIn(re.device,Globalvar.EXPORTER_CONFIG_PATH)){
                    i = (<any>_.get(re.device,Globalvar.EXPORTER_CONFIG_PATH)).length;
                }
                this.deviceConfigurator.addChangesToDevice(re.exporter,`${Globalvar.EXPORTER_CONFIG_PATH}[${i}]`,re.device);
                $this.$http.put(`${j4care.addLastSlash(this.mainservice.baseUrl)}devices/${re.device.dicomDeviceName}`,re.device, headers).subscribe(res => {
                    $this.mainservice.showMsg($localize `:@@devices.exporter_description_appended:The new exporter description appended successfully to the device: ${re.device.dicomDeviceName}:@@dicomDeviceName:`);
                    $this.$http.post(`${j4care.addLastSlash(this.mainservice.baseUrl)}ctrl/reload`, {}, headers).subscribe((res) => {
                        $this.mainservice.showMsg($localize `:@@archive_reloaded_successfully:Archive reloaded successfully!`);
                    });
                }, (err) => {
                    $this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    getAes(){
        let $this = this;
        if ($this.mainservice.global && $this.mainservice.global.aes) {
            this.aes = this.mainservice.global.aes;
        }else{
            this.service.getAes().subscribe((response) => {
                    $this.aes = response;
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
        }
    }
    createDevice(){
        this.router.navigateByUrl('/device/edit/[new_device]');
    }
    getDevices(){
        let $this = this;
        // if(this.mainservice.global && this.mainservice.global.devices){
        //     this.devices = this.mainservice.global.devices;
        // }else{
        this.service.getDevices().subscribe((response) => {
                    console.log('getdevices response', response);
                    console.log('global', $this.mainservice.global);
                    $this.devices = response;
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
    getHl7ApplicationsList(retries){
        let $this = this;
        this.hl7service.getHl7ApplicationsList('').subscribe(
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
                if(retries){
                    $this.getHl7ApplicationsList(retries - 1);
                }
            }
        );
    }
    getWebApps(retries){
        let $this = this;
        this.webAppListService.getWebApps().subscribe(
            (response)=>{
                if ($this.mainservice.global && !$this.mainservice.global.webApps){
                    let global = _.cloneDeep($this.mainservice.global); //,...[{hl7:response}]];
                    global.webApps = response;
                    $this.mainservice.setGlobal(global);
                }else{
                    if ($this.mainservice.global && $this.mainservice.global.webApps){
                        $this.mainservice.global.webApps = response;
                    }else{
                        $this.mainservice.setGlobal({webApps: response});
                    }
                }
            },
            (err)=>{
                if(retries){
                    $this.getWebApps(retries - 1);
                }
            }
        );
    }


}
