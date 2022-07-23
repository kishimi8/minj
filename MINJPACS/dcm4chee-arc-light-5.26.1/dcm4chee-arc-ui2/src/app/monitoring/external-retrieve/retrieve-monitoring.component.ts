import {Component, OnDestroy, OnInit, ViewContainerRef} from '@angular/core';
import {AppService} from "../../app.service";
import * as _ from 'lodash-es';
import {AeListService} from "../../configuration/ae-list/ae-list.service";
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";
import {ConfirmComponent} from "../../widgets/dialogs/confirm/confirm.component";
import {DatePipe} from "@angular/common";
import {j4care} from "../../helpers/j4care.service";
import {J4careHttpService} from "../../helpers/j4care-http.service";
import {LoadingBarService} from '@ngx-loading-bar/core';
import {CsvUploadComponent} from "../../widgets/dialogs/csv-upload/csv-upload.component";
import {Globalvar} from "../../constants/globalvar";
import {ActivatedRoute} from "@angular/router";
import {PermissionService} from "../../helpers/permissions/permission.service";
import {Validators} from "@angular/forms";
import {AppComponent} from "../../app.component";
import {SelectDropdown} from "../../interfaces";
import {RetrieveMonitoringService} from "./retrieve-monitoring.service";
import {DevicesService} from "../../configuration/devices/devices.service";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";
import {forkJoin} from "rxjs";
import {map} from "rxjs/operators";
import {environment} from "../../../environments/environment";

@Component({
  selector: 'retrieve-monitoring',
  templateUrl: './retrieve-monitoring.component.html'
})
export class RetrieveMonitoringComponent implements OnInit,OnDestroy {
    before;
    localAET;
    remoteAET;
    destinationAET;
    filterSchema;
    filterObject;
    isRole: any = (user)=>{return false;};
    user;
    externalRetrieveEntries;
    _ = _;
    dialogRef: MatDialogRef<any>;
    exporters;
    exporterID;
    datePipe = new DatePipe('us-US');
    devices;
    count;
    timer = {
        started:false,
        startText:$localize `:@@start_auto_refresh:Start Auto Refresh`,
        stopText:$localize `:@@stop_auto_refresh:Stop Auto Refresh`
    };
    allActionsActive = [];
    allActionsOptions = [
        {
            value:"cancel",
            label:$localize `:@@cancel_all_matching_tasks:Cancel all matching tasks`
        },{
            value:"reschedule",
            label:$localize `:@@reschedule_all_matching_tasks:Reschedule all matching tasks`
        },{
            value:"delete",
            label:$localize `:@@delete_all_matching_tasks:Delete all matching tasks`
        }
    ];
    allAction;
    statusValues = {};
    refreshInterval;
    interval = 10;
    tableHovered = false;
    Object = Object;
    batchGrouped = false;
    urlParam;
    queueNames:SelectDropdown<string>[];
    tableConfigNormal:any = {
        search:""
    };
    tableConfigGrouped:any = {
        search:""
    };
    moreTasks:boolean = false;
    constructor(
      public cfpLoadingBar: LoadingBarService,
      public mainservice: AppService,
      private appComponent:AppComponent,
      private route: ActivatedRoute,
      public aeListService:AeListService,
      public service:RetrieveMonitoringService,
      public httpErrorHandler:HttpErrorHandler,
      public dialog: MatDialog,
      public config: MatDialogConfig,
      public viewContainerRef: ViewContainerRef,
      private permissionService:PermissionService,
      private deviceService:DevicesService,
      private _keycloakService: KeycloakService
    ) { }

    ngOnInit(){
        this.initCheck(10);
    }
    initCheck(retries){
        let $this = this;
        if((KeycloakService.keycloakAuth && KeycloakService.keycloakAuth.authenticated) || (_.hasIn(this.mainservice,"global.notSecure") && this.mainservice.global.notSecure)){

            this.route.queryParams.subscribe(params => {
                console.log("params",params);
                this.urlParam = Object.assign({},params);
                this.init();
            });
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
        this.getQueueNames();
        this.appComponent.setServerTime();
        this.service.statusValues().forEach(val =>{
            this.statusValues[val.value] = {
                count: 0,
                loader: false,
                text:val.text
            };
        });
/*        if (!this.mainservice.user){
            this.mainservice.user = this.mainservice.getUserInfo().share();
            this.mainservice.user
                .subscribe(
                    (response) => {
                        $this.user.user  = response.user;
                        $this.mainservice.user.user = response.user;
                        $this.user.roles = response.roles;
                        $this.mainservice.user.roles = response.roles;
                        $this.isRole = (role) => {
                            if (response.user === null && response.roles.length === 0){
                                return true;
                            }else{
                                if (response.roles && response.roles.indexOf(role) > -1){
                                    return true;
                                }else{
                                    return false;
                                }
                            }
                        };
                    },
                    (response) => {
                        $this.user.user = 'user';
                        $this.mainservice.user.user = 'user';
                        $this.user.roles = ['user', 'admin'];
                        $this.mainservice.user.roles = ['user', 'admin'];
                        $this.isRole = (role) => {
                            if (role === 'admin'){
                                return false;
                            }else{
                                return true;
                            }
                        };
                    }
                );
        }else{
            this.user = this.mainservice.user;
            this.isRole = this.mainservice.isRole;
        }*/
/*        console.log("localStorage",localStorage.getItem('externalRetrieveFilters'));
        console.log("localStorageTES",localStorage.getItem('externalRetrieveFiltersTESG'));
        let savedFilters = localStorage.getItem('externalRetrieveFilters');
        if(savedFilters)
            this.filterObject = JSON.parse(savedFilters);
        else*/
        this.filterObject = {
            limit:20,
            offset:0
        };
        forkJoin(
            this.aeListService.getAes().pipe(map(aet=> this.permissionService.filterAetDependingOnUiConfig(aet,'external'))),
            this.aeListService.getAets().pipe(map(aet=> this.permissionService.filterAetDependingOnUiConfig(aet,'internal'))),
            this.service.getDevices()
        ).subscribe((response)=>{
            this.remoteAET = this.destinationAET = (<any[]>j4care.extendAetObjectWithAlias(response[0])).map(ae => {
                return {
                    value:ae.dicomAETitle,
                    text:ae.dicomAETitle
                }
            });
            this.localAET = (<any[]>j4care.extendAetObjectWithAlias(response[1])).map(ae => {
                return {
                    value:ae.dicomAETitle,
                    text:ae.dicomAETitle
                }
            });
            this.devices = (<any[]>response[2])
                .filter(dev => dev.hasArcDevExt)
                .map(device => {
                return {
                    value:device.dicomDeviceName,
                    text:device.dicomDeviceName
                }
            });
            this.initSchema();
        });
        this.initExporters(2);
        this.onFormChange(this.filterObject);
    }
    toggleAutoRefresh(){
        this.timer.started = !this.timer.started;
        if(this.timer.started){
            this.getCounts();
            this.refreshInterval = setInterval(()=>{
                this.getCounts();
            },this.interval*1000);
        }else
            clearInterval(this.refreshInterval);
    }
    tableMousEnter(){
        this.tableHovered = true;
    }
    tableMousLeave(){
        this.tableHovered = false;
    }
    getCounts(){
        let filters = Object.assign({},this.filterObject);
        if(!this.tableHovered)
            this.getTasks(0);
        Object.keys(this.statusValues).forEach(status=>{
            filters.status = status;
            this.statusValues[status].loader = true;
            this.service.getCount(filters).subscribe((count)=>{
            this.statusValues[status].loader = false;
                try{
                    this.statusValues[status].count = count.count;
                }catch (e){
                    this.statusValues[status].count = "";
                }
            },(err)=>{
                this.statusValues[status].loader = false;
                this.statusValues[status].count = "!";
            });
        });
    }
    hasOlder(objs) {
        return objs && (objs.length == this.filterObject.limit);
    };
    hasNewer(objs) {
        return objs && objs.length && objs[0].offset;
    };
    newerOffset(objs) {
        return Math.max(0, objs[0].offset - this.filterObject.limit*1);
    };
    olderOffset(objs) {
        return objs[0].offset + this.filterObject.limit*1;
    };
    initSchema(){
        this.filterSchema = this.service.getFilterSchema(this.localAET,this.destinationAET,this.remoteAET, this.devices,$localize `:@@count_param:COUNT ${((this.count || this.count == 0)?this.count:'')}:@@count:`, this.queueNames);
        if(this.urlParam){
            // this.filterObject = this.urlParam;
            _.extend(this.filterObject, this.urlParam);
            this.filterObject["limit"] = 20;
            this.filterObject["orderby"] = '-updatedTime';
            // this.getTasks(0);
        }
        this.setTableSchemas();
    }
    setTableSchemas(){
        this.tableConfigNormal = {
            table:j4care.calculateWidthOfTable(this.service.getTableSchema(this, this.action, {grouped:false, filterObject:this.filterObject})),
            filter:this.filterObject,
            search:"",
            showAttributes:false,
            calculate:false
        };
        this.tableConfigGrouped = {
            table:j4care.calculateWidthOfTable(this.service.getTableSchema(this, this.action, {grouped:true, filterObject:this.filterObject})),
            filter:this.filterObject,
            search:"",
            showAttributes:false,
            calculate:false
        };
    }


    action(mode, match){
        switch(mode){
            case "cancel-selected":
                this.executeAll('cancel');
                break;
            case "reschedule-selected":
                this.executeAll('reschedule');
                break;
            case "delete-selected":
                this.executeAll('delete');
                break;
            case "delete":
                this.delete(match);
                break;
            case "cancel":
                this.cancel(match);
                break;
            case "reschedule":
                this.reschedule(match);
                break;
            case "task-detail":
                this.showTaskDetail(match);
                break;
            case "delete-batched":
                this.deleteBatchedTask(match);
                break;
        }

    }

    confirm(confirmparameters){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(ConfirmComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.parameters = confirmparameters;
        return this.dialogRef.afterClosed();
    };
    downloadCsv(){
        this.confirm({
            content:$localize `:@@use_semicolon_delimiter:Do you want to use semicolon as delimiter?`,
            cancelButton:$localize `:@@no:No`,
            saveButton:$localize `:@@Yes:Yes`,
            result:$localize `:@@yes:yes`
        }).subscribe((ok)=>{
            let semicolon = false;
            if(ok)
                semicolon = true;
            let token;
            this._keycloakService.getToken().subscribe((response)=>{
                if(!this.mainservice.global.notSecure){
                    token = response.token;
                }
                let filterClone = _.cloneDeep(this.filterObject);
                delete filterClone.offset;
                delete filterClone.limit;
                if(!this.mainservice.global.notSecure){
                    // WindowRefService.nativeWindow.open(`../monitor/retrieve?accept=text/csv${(semicolon?';delimiter=semicolon':'')}&access_token=${token}${Object.keys(filterClone).length > 0 ?'&':''}${this.mainservice.param(filterClone)}`);
                    j4care.downloadFile(`../monitor/retrieve?accept=text/csv${(semicolon?';delimiter=semicolon':'')}&access_token=${token}${Object.keys(filterClone).length > 0 ?'&':''}${this.mainservice.param(filterClone)}`,"retrieve.csv")
                }else{
                    // WindowRefService.nativeWindow.open(`../monitor/retrieve?accept=text/csv${(semicolon?';delimiter=semicolon':'')}${Object.keys(filterClone).length > 0 ?'&':''}${this.mainservice.param(filterClone)}`);
                    j4care.downloadFile(`../monitor/retrieve?accept=text/csv${(semicolon?';delimiter=semicolon':'')}${Object.keys(filterClone).length > 0 ?'&':''}${this.mainservice.param(filterClone)}`,"retrieve.csv")
                }
            });
        })
    }
    uploadCsv(){
        this.dialogRef = this.dialog.open(CsvUploadComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.aes = this.remoteAET;
        this.dialogRef.componentInstance.params = {
            LocalAET:this.filterObject['LocalAET']||'',
            RemoteAET:this.filterObject['RemoteAET']||'',
            DestinationAET:this.filterObject['DestinationAET']||'',
            batchID:this.filterObject['batchID']||'',
            formSchema:[
                {
                    tag:"range-picker-time",
                    type:"text",
                    filterKey:"scheduledTime",
                    description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                },
                {
                    tag:"input",
                    type:"checkbox",
                    filterKey:"semicolon",
                    description:$localize `:@@use_semicolon_as_delimiter:Use semicolon as delimiter`
                },
                {
                    tag:"select",
                    options:this.remoteAET,
                    showStar:true,
                    filterKey:"LocalAET",
                    description:$localize `:@@local_aet:Local AET`,
                    placeholder:$localize `:@@local_aet:Local AET`,
                    validation:Validators.required
                },{
                    tag:"select",
                    options:this.remoteAET,
                    showStar:true,
                    filterKey:"RemoteAET",
                    description:$localize `:@@remote_aet:Remote AET`,
                    placeholder:$localize `:@@remote_aet:Remote AET`,
                    validation:Validators.required
                },{
                    tag:"input",
                    type:"number",
                    filterKey:"field",
                    description:$localize `:@@field:Field`,
                    placeholder:$localize `:@@field:Field`,
                    validation:Validators.minLength(1),
                    defaultValue:1
                },{
                    tag:"select",
                    options:this.remoteAET,
                    showStar:true,
                    filterKey:"DestinationAET",
                    description:$localize `:@@destination_aet:Destination AET`,
                    placeholder:$localize `:@@destination_aet:Destination AET`,
                    validation:Validators.required
                }
                ,{
                    tag:"select",
                    options:this.queueNames,
                    showStar:true,
                    filterKey:"dcmQueueName",
                    placeholder:$localize `:@@queue_name:Queue Name`,
                    description:$localize `:@@queue_name:Queue Name`
                },
                {
                    tag:"input",
                    type:"text",
                    filterKey:"batchID",
                    description:$localize `:@@batch_id:Batch ID`,
                    placeholder:$localize `:@@batch_id:Batch ID`
                }
            ],
            prepareUrl:(filter)=>{
                let clonedFilters = {};
                if(filter['priority']) clonedFilters['priority'] = filter['priority'];
                if(filter['batchID']) clonedFilters['batchID'] = filter['batchID'];
                if(filter['dcmQueueName']) clonedFilters['dcmQueueName'] = filter['dcmQueueName'];
                if(filter['scheduledTime']) clonedFilters['scheduledTime'] = filter['scheduledTime'];
                return `${j4care.addLastSlash(this.mainservice.baseUrl)}aets/${filter.LocalAET}/dimse/${filter.RemoteAET}/studies/csv:${filter.field}/export/dicom:${filter.DestinationAET}${j4care.getUrlParams(clonedFilters)}`;
            }
        };
        this.dialogRef.afterClosed().subscribe((ok)=>{
            if(ok){
                console.log("ok",ok);
                //TODO
            }
        });
    }
    allActionChanged(e){
        let text = $localize `:@@matching_task_question:Are you sure, you want to ${Globalvar.getActionText(this.allAction)} all matching tasks?`;
        let filter = Object.assign({}, this.filterObject);
        delete filter.limit;
        delete filter.offset;
                this.cfpLoadingBar.start();
                switch (this.allAction){
                case "cancel":
                    this.confirm({
                        content: text
                    }).subscribe((ok)=>{
                        if(ok){
                            this.service.cancelAll(this.filterObject).subscribe((res)=>{
                                this.mainservice.showMsg($localize `:@@tasks_canceled_param:${res.count} ' tasks canceled successfully!`);
                                this.cfpLoadingBar.complete();
                            }, (err) => {
                                this.cfpLoadingBar.complete();
                                this.httpErrorHandler.handleError(err);
                            });
                        }
                    });
                    break;
                case "reschedule":
                    this.deviceService.selectParametersForMatching((res)=>{
                            if(res){
                                let filter = Object.assign({},this.filterObject);
                                if(_.hasIn(res, "schema_model.newDeviceName") && res.schema_model.newDeviceName != ""){
                                    filter["newDeviceName"] = res.schema_model.newDeviceName;
                                }
                                if(_.hasIn(res, "schema_model.scheduledTime") && res.schema_model.scheduledTime != ""){
                                    filter["scheduledTime"] = res.schema_model.scheduledTime;
                                }
                                if(_.hasIn(res, "schema_model.newQueueName") && res.schema_model.newQueueName != ""){
                                    filter["newQueueName"] = res.schema_model.newQueueName;
                                }
                                this.service.rescheduleAll(filter).subscribe((res)=>{
                                    this.cfpLoadingBar.complete();
                                    if(_.hasIn(res,"count")){
                                        this.mainservice.showMsg($localize `:@@tasks_rescheduled_param:${res.count}:@@count: tasks rescheduled successfully!`);
                                    }else{
                                        this.mainservice.showMsg($localize `:@@task_rescheduled:Task rescheduled successfully!`);
                                    }
                                }, (err) => {
                                    this.cfpLoadingBar.complete();
                                    this.httpErrorHandler.handleError(err);
                                });
                            }
                        },
                        this.devices,
                        true,
                        this.queueNames);

                    break;
                case "delete":
                        this.confirm({
                            content: text
                        }).subscribe((ok)=>{
                            if(ok){
                                this.service.deleteAll(this.filterObject).subscribe((res)=>{
                                    this.mainservice.showMsg($localize `:@@task_deleted:${res.deleted} tasks deleted successfully!`)
                                    this.cfpLoadingBar.complete();
                                }, (err) => {
                                    this.cfpLoadingBar.complete();
                                    this.httpErrorHandler.handleError(err);
                                });
                            }
                        });
                    break;
                }
                this.cfpLoadingBar.complete();

            this.allAction = "";
            this.allAction = undefined;
    }
    deleteBatchedTask(batchedTask){
        this.confirm({
            content: $localize `:@@task_delete_question:Are you sure you want to delete all tasks to this batch?`
        }).subscribe(ok=>{
            if(ok){
                if(batchedTask.batchID){
                    let filter = Object.assign({},this.filterObject);
                    filter["batchID"] = batchedTask.batchID;
                    delete filter["limit"];
                    delete filter["offset"];
                    this.service.deleteAll(filter).subscribe((res)=>{
                        this.cfpLoadingBar.complete();
                        if(_.hasIn(res,"count")){
                            this.mainservice.showMsg($localize `:@@task_deleted:${res.count}:@@count: tasks deleted successfully!`);
                        }else{
                            this.mainservice.showMsg($localize `:@@task_deleted:Task deleted successfully!`);
                        }
                        this.getTasks(0)
                    }, (err) => {
                        this.cfpLoadingBar.complete();
                        this.httpErrorHandler.handleError(err);
                    });
                }else{
                    this.mainservice.showError($localize `:@@batch_id_not_found:Batch ID not found!`);
                }
            }
        });
    }
    delete(match){
        let $this = this;
        let parameters: any = {
            content: $localize `:@@delete_task_question:Are you sure you want to delete this task?`
        };
        this.confirm(parameters).subscribe(result => {
            if (result){
                $this.cfpLoadingBar.start();
                this.service.delete(match.taskID)
                    .subscribe(
                        (res) => {
                            // match.status = 'CANCELED';
                            $this.cfpLoadingBar.complete();
                            $this.getTasks(match.offset||0);
                            this.mainservice.showMsg($localize `:@@task_deleted:Task deleted successfully!`)
                        },
                        (err) => {
                            $this.cfpLoadingBar.complete();
                            $this.httpErrorHandler.handleError(err);
                        });
            }
        });
    }
    cancel(match) {
        let $this = this;
        let parameters: any = {
            content: $localize `:@@want_to_cancel_this_task:Are you sure you want to cancel this task?`
        };
        this.confirm(parameters).subscribe(result => {
            if (result){
                $this.cfpLoadingBar.start();
                this.service.cancel(match.taskID)
                    .subscribe(
                        (res) => {
                            match.status = 'CANCELED';
                            $this.cfpLoadingBar.complete();
                            this.mainservice.showMsg($localize `:@@task_canceled:Task canceled successfully!`)
                        },
                        (err) => {
                            $this.cfpLoadingBar.complete();
                            console.log('cancleerr', err);
                            $this.httpErrorHandler.handleError(err);
                        });
            }
        });
    };
    onFormChange(filters){
        this.setTableSchemas();
 /*       this.allActionsActive = this.allActionsOptions.filter((o)=>{
            if(filters.status == "SCHEDULED" || filters.status == $localize `:@@retrieve-monitoring.in_process:IN PROCESS`){
                return o.value != 'reschedule';
            }else{
                if(filters.status === '*' || !filters.status || filters.status === '')
                    return o.value != 'cancel' && o.value != 'reschedule';
                else
                    return o.value != 'cancel';
            }
        });*/
    }
    reschedule(match) {
        let $this = this;
        this.deviceService.selectParameters((res)=>{
                if(res){
                    let filter = {};
                    if(_.hasIn(res, "schema_model.newDeviceName") && res.schema_model.newDeviceName != ""){
                        filter["newDeviceName"] = res.schema_model.newDeviceName;
                    }
                    if(_.hasIn(res, "schema_model.scheduledTime") && res.schema_model.scheduledTime != ""){
                        filter["scheduledTime"] = res.schema_model.scheduledTime;
                    }
                    if(_.hasIn(res, "schema_model.newQueueName") && res.schema_model.newQueueName != ""){
                        filter["newQueueName"] = res.schema_model.newQueueName;
                    }
                    $this.cfpLoadingBar.start();
                    this.service.reschedule(match.taskID, filter)
                        .subscribe(
                            (res) => {
                                $this.getTasks(match.offset||0);
                                $this.cfpLoadingBar.complete();
                                this.mainservice.showMsg($localize `:@@task_rescheduled:Task rescheduled successfully!`)
                            },
                            (err) => {
                                $this.cfpLoadingBar.complete();
                                $this.httpErrorHandler.handleError(err);
                            });
                }
            },
            this.devices,
            true,
            true,
            this.queueNames
        );
    };
    checkAll(event){
        this.externalRetrieveEntries.forEach((match)=>{
            match.checked = event.target.checked;
        });
    }
    executeAll(mode){
        this.confirm({
            content: $localize `:@@action_selected_entries_question:Are you sure you want to ${Globalvar.getActionText(mode)} selected entries?`
        }).subscribe(result => {
            if (result){
                this.cfpLoadingBar.start();
                this.externalRetrieveEntries.forEach((match)=>{
                    if(match.selected){
                        this.service[mode](match.taskID)
                            .subscribe((res) => {
                            console.log("execute result=",res);
                            },(err)=>{
                                this.httpErrorHandler.handleError(err);
                            });
                    }
                });
                setTimeout(()=>{
                    this.getTasks(this.externalRetrieveEntries[0].offset || 0);
                    this.cfpLoadingBar.complete();
                },300);
            }
        });
    }
    onSubmit(object){
        if(_.hasIn(object,"id") && _.hasIn(object,"model")){
            this.filterObject = object.model;
            if(object.id === "count"){
                this.getCount();
            }else{
                // this.getTasks(0);
                this.getCounts();
            }
        }
    }
    showTaskDetail(task){
        this.filterObject.batchID = task.batchID;
        this.batchGrouped = false;
        this.getTasks(0);
    }
    getTasks(offset){
        let $this = this;
        $this.cfpLoadingBar.start();
        this.service.getExternalRetrieveEntries(this.filterObject,offset, this.batchGrouped).subscribe(
            res =>  {
                $this.cfpLoadingBar.complete();

                if(!environment.production){
                    if(this.batchGrouped){
                        res = [
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[2.25.253254299183063559800543717906499910894]",
                                "tasks": {
                                    "failed": "32"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - QIDO Study Instances",
                                    "ATS Prefetch NG - QIDO Study Series",
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-03-15T01:20:51.548+0100",
                                    "2022-03-15T01:20:51.929+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-03-15T19:39:00.706+0100",
                                    "2022-03-15T19:41:30.097+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-03-15T19:38:00.692+0100",
                                    "2022-03-15T19:41:00.721+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-03-15T19:39:00.584+0100",
                                    "2022-03-15T19:41:05.308+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-03-15T19:39:00.703+0100",
                                    "2022-03-15T19:41:29.900+0100"
                                ]
                            },
                            {
                                "batchID": "ATS Prefetch Priors on Store[1.2.276.0.37.1.406.201712.240110]",
                                "tasks": {
                                    "warning": "2"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "ATS Prefetch NG - Series Thumbnails",
                                    "ATS Prefetch NG - Series WADO Metadata"
                                ],
                                "createdTimeRange": [
                                    "2022-02-08T18:45:29.656+0100",
                                    "2022-02-08T18:45:29.664+0100"
                                ],
                                "updatedTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.111+0100"
                                ],
                                "scheduledTimeRange": [
                                    "2022-02-08T18:45:29.489+0100",
                                    "2022-02-08T18:45:29.489+0100"
                                ],
                                "processingStartTimeRange": [
                                    "2022-02-08T18:45:48.149+0100",
                                    "2022-02-08T18:45:48.585+0100"
                                ],
                                "processingEndTimeRange": [
                                    "2022-02-08T18:45:49.821+0100",
                                    "2022-02-08T18:45:50.110+0100"
                                ]
                            },
                            {
                                "batchID": "recreate-tasks-5.24.iuids",
                                "tasks": {
                                    "warning": "9"
                                },
                                "dicomDeviceName": [
                                    "demoj4c"
                                ],
                                "ExporterID": [
                                    "Export Objects to STORESCP"
                                ],
                                "createdTimeRange": [
                                    "2021-09-24T16:17:16.929+0200",
                                    "2021-09-24T16:17:17.092+0200"
                                ],
                                "updatedTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ],
                                "scheduledTimeRange": [
                                    "2021-09-24T16:27:46.633+0200",
                                    "2021-09-24T16:27:46.633+0200"
                                ],
                                "processingStartTimeRange": [
                                    "2021-09-24T16:27:46.765+0200",
                                    "2021-09-24T16:27:46.864+0200"
                                ],
                                "processingEndTimeRange": [
                                    "2021-09-24T16:27:46.787+0200",
                                    "2021-09-24T16:27:46.884+0200"
                                ]
                            }
                        ];
                    }else{
                        res = [{"taskID":"62","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.690-0600","updatedTime":"2022-03-17T11:52:14.100-0600","scheduledTime":"2022-03-17T11:52:05.689-0600","processingStartTime":"2022-03-17T11:52:14.019-0600","processingEndTime":"2022-03-17T11:52:14.100-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5732.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5732.0","completed":"1","statusCode":"0000"},{"taskID":"61","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.683-0600","updatedTime":"2022-03-17T11:52:14.013-0600","scheduledTime":"2022-03-17T11:52:05.681-0600","processingStartTime":"2022-03-17T11:52:13.869-0600","processingEndTime":"2022-03-17T11:52:14.013-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775771.5705.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775771.5705.0","completed":"1","statusCode":"0000"},{"taskID":"60","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.676-0600","updatedTime":"2022-03-17T11:52:13.859-0600","scheduledTime":"2022-03-17T11:52:05.675-0600","processingStartTime":"2022-03-17T11:52:13.778-0600","processingEndTime":"2022-03-17T11:52:13.859-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775771.5711.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775771.5711.0","completed":"1","statusCode":"0000"},{"taskID":"59","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.670-0600","updatedTime":"2022-03-17T11:52:13.770-0600","scheduledTime":"2022-03-17T11:52:05.669-0600","processingStartTime":"2022-03-17T11:52:13.692-0600","processingEndTime":"2022-03-17T11:52:13.769-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775771.5714.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775771.5714.0","completed":"1","statusCode":"0000"},{"taskID":"58","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.661-0600","updatedTime":"2022-03-17T11:52:13.684-0600","scheduledTime":"2022-03-17T11:52:05.660-0600","processingStartTime":"2022-03-17T11:52:13.622-0600","processingEndTime":"2022-03-17T11:52:13.683-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775771.5708.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775771.5708.0","completed":"1","statusCode":"0000"},{"taskID":"57","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.653-0600","updatedTime":"2022-03-17T11:52:13.614-0600","scheduledTime":"2022-03-17T11:52:05.651-0600","processingStartTime":"2022-03-17T11:52:13.549-0600","processingEndTime":"2022-03-17T11:52:13.614-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5729.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5729.0","completed":"1","statusCode":"0000"},{"taskID":"56","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.639-0600","updatedTime":"2022-03-17T11:52:13.541-0600","scheduledTime":"2022-03-17T11:52:05.638-0600","processingStartTime":"2022-03-17T11:52:13.471-0600","processingEndTime":"2022-03-17T11:52:13.540-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5717.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5717.0","completed":"1","statusCode":"0000"},{"taskID":"55","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.631-0600","updatedTime":"2022-03-17T11:52:13.463-0600","scheduledTime":"2022-03-17T11:52:05.629-0600","processingStartTime":"2022-03-17T11:52:13.384-0600","processingEndTime":"2022-03-17T11:52:13.463-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5720.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5720.0","completed":"1","statusCode":"0000"},{"taskID":"54","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.621-0600","updatedTime":"2022-03-17T11:52:13.374-0600","scheduledTime":"2022-03-17T11:52:05.620-0600","processingStartTime":"2022-03-17T11:52:13.291-0600","processingEndTime":"2022-03-17T11:52:13.373-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5726.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5726.0","completed":"1","statusCode":"0000"},{"taskID":"53","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.614-0600","updatedTime":"2022-03-17T11:52:13.280-0600","scheduledTime":"2022-03-17T11:52:05.612-0600","processingStartTime":"2022-03-17T11:52:13.185-0600","processingEndTime":"2022-03-17T11:52:13.280-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775771.5702.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775771.5702.0","completed":"1","statusCode":"0000"},{"taskID":"52","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.607-0600","updatedTime":"2022-03-17T11:52:13.176-0600","scheduledTime":"2022-03-17T11:52:05.606-0600","processingStartTime":"2022-03-17T11:52:13.047-0600","processingEndTime":"2022-03-17T11:52:13.176-0600","outcomeMessage":"Export STUDY[suid:1.3.6.1.4.1.5962.1.2.0.1175775772.5723.0] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.6.1.4.1.5962.1.2.0.1175775772.5723.0","completed":"1","statusCode":"0000"},{"taskID":"51","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.596-0600","updatedTime":"2022-03-17T11:52:13.031-0600","scheduledTime":"2022-03-17T11:52:05.594-0600","processingStartTime":"2022-03-17T11:52:12.770-0600","processingEndTime":"2022-03-17T11:52:13.031-0600","outcomeMessage":"Export STUDY[suid:1.3.12.2.1107.5.8.1.123456789.199507271758050705910] from DCM4CHEE to DCM4CHEE - completed:26","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.3.12.2.1107.5.8.1.123456789.199507271758050705910","completed":"26","statusCode":"0000"},{"taskID":"50","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.588-0600","updatedTime":"2022-03-17T11:52:12.764-0600","scheduledTime":"2022-03-17T11:52:05.587-0600","processingStartTime":"2022-03-17T11:52:12.718-0600","processingEndTime":"2022-03-17T11:52:12.764-0600","outcomeMessage":"Export STUDY[suid:1.2.840.113701.4.1.6653.3.264] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.840.113701.4.1.6653.3.264","completed":"1","statusCode":"0000"},{"taskID":"49","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.579-0600","updatedTime":"2022-03-17T11:52:12.713-0600","scheduledTime":"2022-03-17T11:52:05.576-0600","processingStartTime":"2022-03-17T11:52:12.524-0600","processingEndTime":"2022-03-17T11:52:12.712-0600","outcomeMessage":"Export STUDY[suid:1.2.840.113674.514.212.200] from DCM4CHEE to DCM4CHEE - completed:11","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.840.113674.514.212.200","completed":"11","statusCode":"0000"},{"taskID":"48","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.567-0600","updatedTime":"2022-03-17T11:52:12.516-0600","scheduledTime":"2022-03-17T11:52:05.566-0600","processingStartTime":"2022-03-17T11:52:11.394-0600","processingEndTime":"2022-03-17T11:52:12.516-0600","outcomeMessage":"Export STUDY[suid:1.2.840.113674.1140.196.200] from DCM4CHEE to DCM4CHEE - completed:94","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.840.113674.1140.196.200","completed":"94","statusCode":"0000"},{"taskID":"47","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.553-0600","updatedTime":"2022-03-17T11:52:11.386-0600","scheduledTime":"2022-03-17T11:52:05.549-0600","processingStartTime":"2022-03-17T11:52:11.294-0600","processingEndTime":"2022-03-17T11:52:11.386-0600","outcomeMessage":"Export STUDY[suid:1.2.840.113701.4.1.1.3.3477] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.840.113701.4.1.1.3.3477","completed":"1","statusCode":"0000"},{"taskID":"46","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.542-0600","updatedTime":"2022-03-17T11:52:11.288-0600","scheduledTime":"2022-03-17T11:52:05.541-0600","processingStartTime":"2022-03-17T11:52:11.067-0600","processingEndTime":"2022-03-17T11:52:11.287-0600","outcomeMessage":"Export STUDY[suid:1.2.840.113674.1242.214.200] from DCM4CHEE to DCM4CHEE - completed:16","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.840.113674.1242.214.200","completed":"16","statusCode":"0000"},{"taskID":"45","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.529-0600","updatedTime":"2022-03-17T11:52:11.055-0600","scheduledTime":"2022-03-17T11:52:05.527-0600","processingStartTime":"2022-03-17T11:52:10.298-0600","processingEndTime":"2022-03-17T11:52:11.055-0600","outcomeMessage":"Export STUDY[suid:2.16.840.1.113662.4.8796818069641.798806497.93296077602350.10] from DCM4CHEE to DCM4CHEE - completed:42","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"2.16.840.1.113662.4.8796818069641.798806497.93296077602350.10","completed":"42","statusCode":"0000"},{"taskID":"44","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"SCHEDULED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.522-0600","updatedTime":"2022-03-17T11:52:10.292-0600","scheduledTime":"2022-03-17T11:52:05.520-0600","processingStartTime":"2022-03-17T11:52:09.775-0600","processingEndTime":"2022-03-17T11:52:10.291-0600","outcomeMessage":"Export STUDY[suid:2.16.840.1.113662.4.8796818069641.798806497.93296077602350.30] from DCM4CHEE to DCM4CHEE - completed:41","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"2.16.840.1.113662.4.8796818069641.798806497.93296077602350.30","completed":"41","statusCode":"0000"},{"taskID":"43","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.508-0600","updatedTime":"2022-03-17T11:52:09.768-0600","scheduledTime":"2022-03-17T11:52:05.507-0600","processingStartTime":"2022-03-17T11:52:09.661-0600","processingEndTime":"2022-03-17T11:52:09.767-0600","outcomeMessage":"Export STUDY[suid:1.2.392.200036.9125.0.199212251200.28] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.392.200036.9125.0.199212251200.28","completed":"1","statusCode":"0000"},{"taskID":"43","dicomDeviceName":"dcm4chee-arc","queue":"Retrieve","type":"RETRIEVE","status":"COMPLETED","batchID":"2221711523","createdTime":"2022-03-17T11:52:05.508-0600","updatedTime":"2022-03-17T11:52:09.768-0600","scheduledTime":"2022-03-17T11:52:05.507-0600","processingStartTime":"2022-03-17T11:52:09.661-0600","processingEndTime":"2022-03-17T11:52:09.767-0600","outcomeMessage":"Export STUDY[suid:1.2.392.200036.9125.0.199212251200.28] from DCM4CHEE to DCM4CHEE - completed:1","RequesterUserID":"admin","RequesterHostName":"192.168.0.87","RequestURI":"http://shefki-lifebook:8080/dcm4chee-arc/aets/DCM4CHEE/dimse/DCM4CHEE/query:DCM4CHEE/studies/export/dicom:DCM4CHEE","LocalAET":"DCM4CHEE","RemoteAET":"DCM4CHEE","DestinationAET":"DCM4CHEE","FindSCP":"DCM4CHEE","StudyInstanceUID":"1.2.392.200036.9125.0.199212251200.28","completed":"1","statusCode":"0000"}];
                    }
                }

                if (res && res.length > 0){
                    this.externalRetrieveEntries =  res.map((properties, index) => {
                        if(this.batchGrouped){
                            let propertiesAttr = Object.assign({},properties);
                            if(_.hasIn(properties, 'tasks')){
                                let taskPrepared = [];
                                Globalvar.TASK_NAMES.forEach(task=>{
                                 if(properties.tasks[task])
                                     taskPrepared.push({[task]:properties.tasks[task]});
                                });
                                properties.tasks = taskPrepared;
                            }
                            j4care.stringifyArrayOrObject(properties, ['tasks']);
                            j4care.stringifyArrayOrObject(propertiesAttr,[]);
/*                            return {
                                offset: offset + index,
                                properties: properties,
                                propertiesAttr: propertiesAttr,
                                showProperties: false
                            };*/
                            return properties;
                        }else{
                            if (_.hasIn(properties, 'Modality')){
                                properties.Modality = properties.Modality.join(', ');
                            }
                            properties.taskState = (properties.completed ? properties.completed*1:0) + ' / ' + (properties.remaining ? properties.remaining*1:0) + ' / '+ (properties.failed ? properties.failed*1:0);
                            let endTime:Date =  properties.processingEndTime ? new Date(properties.processingEndTime) :  this.mainservice.serverTime;
                            try{
                                properties.NumberOfInstances = properties.NumberOfInstances || ((properties.completed ? properties.completed*1:0) + (properties.remaining ? properties.remaining*1:0) + (properties.failed ? properties.failed*1:0));
                                properties.InstancePerSec = (Math.round(((properties.completed ? properties.completed*1:0)/((endTime.getTime()/1000) - (new Date(properties.processingStartTime).getTime()/1000)))*100)/100) || '-';
                                if(!properties.processingEndTime)
                                    properties.approximatelyEndTime = Math.round((properties.remaining / properties.InstancePerSec)*100)/100 ? `${this.secToMinSecString((properties.remaining / properties.InstancePerSec))}`:'-';
                            }catch (e){
                                properties.InstancePerSec = '';
                            }
/*                            return {
                                offset: offset + index,
                                properties: properties,
                                propertiesAttr: properties,
                                showProperties: false
                            };*/
                            return properties;
                        }
                    });
                    this.moreTasks = res.length > this.filterObject['limit'];
                    if(this.moreTasks)
                        this.externalRetrieveEntries.splice(this.externalRetrieveEntries.length-1,1);
                    $this.count = undefined;
                }else{
                    $this.cfpLoadingBar.complete();
                    $this.externalRetrieveEntries = [];
                    this.mainservice.showMsg($localize `:@@no_tasks_found:No tasks found!`)
                }
            },
            err => {
                $this.externalRetrieveEntries = [];
                $this.cfpLoadingBar.complete();
                $this.httpErrorHandler.handleError(err);
            });
    }
/*    mscFormat(duration){
        if (duration > 999){

            let milliseconds: any = parseInt((((duration % 1000))).toString())
                , seconds: any = parseInt(((duration / 1000) % 60).toString())
                , minutes: any = parseInt(((duration / (1000 * 60)) % 60).toString())
                , hours: any = parseInt(((duration / (1000 * 60 * 60))).toString());
            if (hours === 0){
                if (minutes === 0){
                    return seconds.toString() + '.' + milliseconds.toString() + ' sec';
                }else{
                    seconds = (seconds < 10) ? '0' + seconds : seconds;
                    return minutes.toString() + ':' + seconds.toString() + '.' + milliseconds.toString() + ' min';
                }
            }else{

                hours = (hours < 10) ? '0' + hours : hours;
                minutes = (minutes < 10) ? '0' + minutes : minutes;
                seconds = (seconds < 10) ? '0' + seconds : seconds;

                return hours.toString() + ':' + minutes.toString() + ':' + seconds.toString() + '.' + milliseconds.toString() + ' h';
            }
        }else{
            return duration.toString() + ' ms';
    }*/

    next(){
        if(this.moreTasks){
            let filter = Object.assign({},this.filterObject);
            if(filter['limit']){
                this.filterObject['offset'] = filter['offset'] = filter['offset']*1 + this.filterObject['limit']*1;
                filter['limit']++;
            }
            this.getTasks(filter.offset);
        }
    }
    prev(){
        if(this.filterObject["offset"] > 0){
            let filter = Object.assign({},this.filterObject);
            if(filter['limit'])
                this.filterObject['offset'] = filter['offset'] = filter['offset']*1 - this.filterObject['limit']*1;
            this.getTasks(filter.offset);
        }
    }

    secToMinSecString(rawSec){
        let min;
        let sec;
        try {
            if (rawSec > 59) {
                min = parseInt(((rawSec / 60)).toString());
                sec = Math.round(((rawSec / 60) - min) * 60);
                return `${min} min ${sec} s`;
            } else {
                return `${Math.round(rawSec)} s`;
            }
        }catch(e){
            return "-";
        }
    }
    getCount(){
        this.cfpLoadingBar.start();
        this.service.getCount(this.filterObject).subscribe((count)=>{

            try{
                this.count = count.count;
            }catch (e){
                this.count = "";
            }
            this.urlParam = {};
            this.initSchema();
            this.cfpLoadingBar.complete();
        },(err)=>{
            this.cfpLoadingBar.complete();
            this.initSchema();
            this.httpErrorHandler.handleError(err);
        });
    }
    initExporters(retries) {
        let $this = this;
        this.service.getExporters().subscribe(
                (res) => {$this.exporters = res;
                    if (res && res[0] && res[0].id){
                        $this.exporterID = res[0].id;
                    }
                    // $this.mainservice.setGlobal({exporterID:$this.exporterID});
                },
                (res) => {
                    if (retries)
                        $this.initExporters(retries - 1);
                });
    }
/*    getDevices(){
        this.cfpLoadingBar.start();
        this.service.getDevices().subscribe(devices=>{
            this.cfpLoadingBar.complete();
            this.devices = devices.filter(dev => dev.hasArcDevExt);
        },(err)=>{
            this.cfpLoadingBar.complete();
            console.error("Could not get devices",err);
        });
    }*/
    getQueueNames(){
        this.service.getQueueNames().subscribe(names=>{
            this.queueNames = names
                .filter(name=> name.name.toLowerCase().indexOf("retrieve") > -1)
                .sort((a,b)=>{
                    try{
                        return parseInt(a.name.replace(/Retrieve/g,"")) - parseInt(b.name.replace(/Retrieve/g,""))
                    }catch (e) {
                        return 1;
                    }
                })
                .map(name=> new SelectDropdown(name.name, name.description));
        },err=>{
            this.httpErrorHandler.handleError(err);
        })
    }
    ngOnDestroy(){
        if(this.timer.started){
            this.timer.started = false;
            clearInterval(this.refreshInterval);
        }
        // localStorage.setItem('externalRetrieveFilters',JSON.stringify(this.filterObject));
    }
}
