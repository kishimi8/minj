import {Component, OnInit} from '@angular/core';


import {ControlService} from './control.service';
import * as _ from 'lodash-es';
import {LoadingBarService} from "@ngx-loading-bar/core";
import {AppService} from "../../app.service";
import {J4careHttpService} from "../../helpers/j4care-http.service";
import {DevicesService} from "../devices/devices.service";
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";

@Component({
    selector: 'app-control',
    templateUrl: './control.component.html',
    styleUrls: ['./control.component.css']
})
export class ControlComponent implements OnInit{
    status: any;
    message = '';
    devices = {};
    allDevices;
    Object = Object;
    tableSchema;
    constructor(
        public $http:J4careHttpService,
        public appService: AppService,
        private cfpLoadingBar: LoadingBarService,
        private service: ControlService,
        private devicesService:DevicesService,
        public httpErrorHandler:HttpErrorHandler
    ) {}
    ngOnInit(){
        this.initCheck(10);
    }
    initCheck(retries){
        let $this = this;
        if((KeycloakService.keycloakAuth && KeycloakService.keycloakAuth.authenticated) || (_.hasIn(this.appService,"global.notSecure") && this.appService.global.notSecure)){
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
        this.tableSchema = this.service.getTableSchema();
        this.calculateWidthOfTable("tableSchema");
    }
    fetchStatus(d?) {
        Object.keys(this.devices).forEach((device)=>{
            this.service.fetchStatus(this.devices[device].dcmuiDeviceURL).subscribe(res=>{
                this.devices[device].status = res.status;
                this.appService.showMsg( $localize `:@@control.status_refetched:Status of ${this.devices[device].dcmuiDeviceURLName}:@@dcmuiDeviceURLName: was successfully refetched!`);
            },err=>{
                console.error("Status not fetchable",err);
                this.httpErrorHandler.handleError(err);
            })
        });
    };
    start(object){
        this.cfpLoadingBar.start();
        this.service.startArchive(object.dcmuiDeviceURL).subscribe((res) => {
            this.fetchStatus();
            this.appService.showMsg($localize `:@@control.archive_started:Archive ${object.dcmuiDeviceURLName}:@@dcmuiDeviceURLName: started successfully`);
            this.cfpLoadingBar.complete();
        },(err)=>{
            this.cfpLoadingBar.complete();
            this.httpErrorHandler.handleError(err);
        });
    };
    stop(object) {
        this.cfpLoadingBar.start();
        this.service.stopArchive(object.dcmuiDeviceURL).subscribe((res) => {
            this.fetchStatus();
            this.appService.showMsg($localize`:@@control.archive_stopped:Archive ${object.dcmuiDeviceURLName}:@@dcmuiDeviceURLName: stopped successfully`);
            this.cfpLoadingBar.complete();
        },(err)=>{
            this.cfpLoadingBar.complete();
            this.httpErrorHandler.handleError(err);
        });
    };
    reload(object) {
        this.cfpLoadingBar.start();
        this.service.reloadArchive().subscribe((res) => {
            this.appService.showMsg($localize `:@@control.archive_reloaded:Archive ${object.dcmuiDeviceURLName}:@@dcmuiDeviceURLName: reloaded successfully`);
            this.cfpLoadingBar.complete();
        },(err)=>{
            this.cfpLoadingBar.complete();
            this.httpErrorHandler.handleError(err);
        });
    };
    toggleState(object){
        if(object.status && object.status === "STARTED"){
            this.stop(object);
        }else{
            this.start(object);
        }
    }

    getDevices(){
        this.devicesService.getDevices().subscribe((devices)=>{
            this.service.getMyArchivesFromConfig(this, devices,(devices)=>{
                this.devices = devices;
                this.fetchStatus();
            });
        },(err)=>{
            this.httpErrorHandler.handleError(err);
        });
    }
    calculateWidthOfTable(tableName){
        let summ = 0;
        _.forEach(this[tableName],(m,i)=>{
            summ += m.widthWeight;
        });
        _.forEach(this[tableName],(m,i)=>{
            m.calculatedWidth =  ((m.widthWeight * 100)/summ)+"%";
        });
    };
}
