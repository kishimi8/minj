import {
    Component,
    ElementRef,
    HostListener,
    OnInit,
    ViewChild,
    ViewContainerRef,
    AfterContentChecked, OnDestroy,
} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {
    StudyFilterConfig,
    StudyPageConfig,
    DicomMode,
    SelectDropdown,
    DicomLevel,
    Quantity,
    DicomResponseType, DiffAttributeSet, StorageSystems, AccessControlIDMode, UPSModifyMode, ModifyConfig,
} from "../../interfaces";
import {StudyService} from "./study.service";
import {j4care} from "../../helpers/j4care.service";
import {Aet} from "../../models/aet";
import {PermissionService} from "../../helpers/permissions/permission.service";
import {AppService} from "../../app.service";
import {Globalvar} from "../../constants/globalvar";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {HttpErrorHandler} from "../../helpers/http-error-handler";
import {PatientDicom} from "../../models/patient-dicom";
import {Patient1Dicom} from "../../models/patient1-dicom";
import {StudyDicom} from "../../models/study-dicom";
import {Study1Dicom} from "../../models/study1-dicom";
import {Series1Dicom} from "../../models/series1-dicom";
import * as _  from "lodash-es";
import {LoadingBarService} from "@ngx-loading-bar/core";
import {
    StudyTrash, TableParam,
} from "../../helpers/dicom-studies-table/dicom-studies-table.interfaces";
import {SeriesDicom} from "../../models/series-dicom";
import {InstanceDicom} from "../../models/instance-dicom";
import {WadoQueryParams} from "./wado-wuery-params";
import {GSPSQueryParams} from "../../models/gsps-query-params";
import {DeviceConfiguratorService} from "../../configuration/device-configurator/device-configurator.service";
import {EditPatientComponent} from "../../widgets/dialogs/edit-patient/edit-patient.component";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";
import {KeycloakService} from "../../helpers/keycloak-service/keycloak.service";
import {HttpHeaders} from "@angular/common/http";
import {EditMwlComponent} from "../../widgets/dialogs/edit-mwl/edit-mwl.component";
import {ComparewithiodPipe} from "../../pipes/comparewithiod.pipe";
import {ConfirmComponent} from "../../widgets/dialogs/confirm/confirm.component";
import {EditStudyComponent} from "../../widgets/dialogs/edit-study/edit-study.component";
import {EditSeriesComponent} from "../../widgets/dialogs/edit-series/edit-series.component";
import {ExportDialogComponent} from "../../widgets/dialogs/export/export.component";
import {UploadFilesComponent} from "../../widgets/dialogs/upload-files/upload-files.component";
import {DcmWebApp} from "../../models/dcm-web-app";
import {StudyWebService} from "./study-web-service.model";
import {DeleteRejectedInstancesComponent} from "../../widgets/dialogs/delete-rejected-instances/delete-rejected-instances.component";
import {ViewerComponent} from "../../widgets/dialogs/viewer/viewer.component";
import {WindowRefService} from "../../helpers/window-ref.service";
import {LargeIntFormatPipe} from "../../pipes/large-int-format.pipe";
import {UploadDicomComponent} from "../../widgets/dialogs/upload-dicom/upload-dicom.component";
import {SelectionActionElement} from "./selection-action-element.models";
import {StudyTransferringOverviewComponent} from "../../widgets/dialogs/study-transferring-overview/study-transferring-overview.component";
import {MwlDicom} from "../../models/mwl-dicom";
import {MppsDicom} from "../../models/mpps-dicom";
import {ChangeDetectorRef} from "@angular/core";
import {Observable} from "rxjs";
import {DiffDicom} from "../../models/diff-dicom";
import {UwlDicom} from "../../models/uwl-dicom";
import {filter, map, switchMap} from "rxjs/operators";
import {ModifyUpsComponent} from "../../widgets/dialogs/modify-ups/modify-ups.component";
import {Subscriber} from "rxjs/index";
import {Device} from "../../models/device";
import {environment} from "../../../environments/environment";
declare var DCM4CHE: any;


@Component({
    selector: 'app-study',
    templateUrl: './study.component.html',
    styleUrls: ['./study.component.scss'],
    animations:[
        trigger("showHide",[
            state("show",style({
                padding:"*",
                height:'*',
                opacity:1
            })),
            state("hide",style({
                padding:"0",
                opacity:0,
                height:'0px',
                margin:"0"
            })),
            transition("show => hide",[
                animate('0.2s')
            ]),
            transition("hide => show",[
                animate('0.3s')
            ])
        ])
    ]
})
export class StudyComponent implements OnInit, OnDestroy, AfterContentChecked{

    // model = new SelectDropdown('StudyDate,StudyTime','','', '', `<label>Study</label><span class="orderbydatedesc"></span>`);
    isOpen = true;
    testToggle(){
        this.isOpen = !this.isOpen;
    }
    Object = Object;
    studyConfig:StudyPageConfig = {
        tab:"study",
        title:$localize `:@@studies:Studies`
    };

    patientAttributes;
    studyAttributes;
    devices;
    private _filter:StudyFilterConfig = {
        filterSchemaEntry:{
            lineLength:undefined,
            schema:[]
        },
        filterSchemaMain:{
            lineLength:undefined,
            schema:[]
        },
        filterSchemaExpand:{
            lineLength:2,
            schema:[]
        },
        filterEntryModel:{
        },
        filterModel:{
            limit:20,
            offset:0,
            includefield:"all"
        },
        expand:false,
        quantityText:{
            count:$localize `:@@COUNT:COUNT`,
            size:$localize `:@@SIZE:SIZE`
        }
    };

    get filter(): StudyFilterConfig {
        return this._filter;
    }

    set filter(value: StudyFilterConfig) {
        this.tableParam.config.offset = value.filterModel.offset;
        this._filter = value;
    }

    applicationEntities = {
        aes:[],
        aets:[],
        aetsAreSet:false
    };
    trash:StudyTrash = {
        reject:undefined,
        rjnotes:undefined,
        rjcode:undefined,
        active:false
    };
    studyWebService:StudyWebService;
    selectedElements:SelectionActionElement;
    tableParam:TableParam = {
        tableSchema:this.getSchema(),
        config:{
            offset:0,
            showCheckboxes:false
        }
    };
    // studyDevice:StudyDevice;
    testModel;
    // studyWebService:StudystudyWebServiceModel;
/*    private _selectedWebAppService:DcmWebApp;
    webApps:DcmWebApp[];*/

    showClipboardContent:boolean = false;
    dialogRef: MatDialogRef<any>;
    lastPressedCode;
    moreFunctionConfig = {
        placeholder: $localize `:@@more_functions:More functions`,
        options:[
            new SelectDropdown("create_patient",$localize `:@@study.create_patient:Create patient`),
            new SelectDropdown("supplement_issuer",$localize `:@@supplement_issuer:Supplement Issuer`),
            new SelectDropdown("update_charset",$localize `:@@update_charset:Update Character Set of patients`),
            new SelectDropdown("create_ups",$localize `:@@create_new_ups:Create new UPS Workitem`),
            new SelectDropdown("upload_dicom",$localize`:@@study.upload_dicom_object:Upload DICOM Object`),
            new SelectDropdown("permanent_delete",$localize `:@@study.short_permanent_delete:Permanent delete`, $localize `:@@study.permanent_delete:Delete rejected Instances permanently`),
            new SelectDropdown("export_multiple_study",$localize `:@@study.export_multiple:Export matching studies`),
            new SelectDropdown("export_multiple_series",$localize `:@@study.export_multiple_series:Export matching series`),
            new SelectDropdown("reject_multiple_study",$localize `:@@study.reject_multiple:Reject matching studies`),
            new SelectDropdown("reject_multiple_series",$localize `:@@study.reject_multiple_series:Reject matching series`),
            new SelectDropdown("retrieve_multiple",$localize `:@@study.retrieve_multiple:Retrieve matching studies`),
            new SelectDropdown("update_access_control_id_to_matching",$localize `:@@study.update_access_control_id_to_matching:Update access Control ID`),
            new SelectDropdown("storage_verification_studies",$localize `:@@storage_verification_studies:Storage Verification Studies`),
            new SelectDropdown("storage_verification_series",$localize `:@@storage_verification_series:Storage Verification Series`),
            new SelectDropdown("download_patients",$localize `:@@study.download_patients:Download patients as CSV`),
            new SelectDropdown("download_studies",$localize `:@@study.download_studies:Download studies as CSV`),
            new SelectDropdown("download_series",$localize `:@@study.download_series:Download series as CSV`),
            new SelectDropdown("download_mwl",$localize `:@@study.download_mwl:Download MWL as CSV`),
            new SelectDropdown("trigger_diff",$localize `:@@trigger_diff:Trigger Diff`),
            new SelectDropdown("change_sps_status_on_matching",$localize `:@@mwl.change_sps_status_on_matching:Change SPS Status on matching MWL`),
            new SelectDropdown("import_matching_sps_to_archive",$localize `:@@mwl.import_matching_sps_to_archive:Import matching SPS to archive`),
            new SelectDropdown("schedule_storage_commit_for_matching_studies",$localize `:@@schedule_storage_commit_for_matching_studies:Schedule Storage Commitment for matching Studies`),
            new SelectDropdown("schedule_storage_commit_for_matching_series",$localize `:@@schedule_storage_commit_for_matching_series:Schedule Storage Commitment for matching Series`),
            new SelectDropdown("instance_availability_notification_for_matching_studies",$localize `:@@instance_availability_notification_for_matching_studies:Instance Availability Notification for matching Studies`),
            new SelectDropdown("instance_availability_notification_for_matching_series",$localize `:@@instance_availability_notification_for_matching_series:Instance Availability Notification for matching Series`),
        ],
        model:undefined
    };
    internal = true;
    actionsSelections = {
        placeholder: $localize `:@@actions_for_selections:Actions for selections`,
        options:[
            new SelectDropdown("toggle_checkboxes", $localize `:@@toggle_checkboxes:Toggle checkboxes`, $localize `:@@toggle_checkboxes_for_selection:Toggle checkboxes for selection`),
            new SelectDropdown("export_object",
                this.internal ? $localize `:@@study.short_export_object:Export selections`:$localize `:@@retrieve_selections:Retrieve selections`,
                this.internal ? $localize `:@@study.export_object:Export selected studies, series or instances`: $localize `:@@retrieve_selected_objects:Retrieve selected studies, series or instances`),
            new SelectDropdown("reject_object", $localize `:@@study.short_reject_object:Reject selections`, $localize `:@@study.reject_object:Reject selected studies, series or instances`),
            new SelectDropdown("restore_object", $localize `:@@study.short_restore_object:Restore selections`, $localize `:@@study.restore_object:Restore selected studies, series or instances`),
            new SelectDropdown("update_access_control_id_to_selections", $localize `:@@study.short_update_access_control_id_to_selections:Access Control ID to selections`, $localize `:@@study.update_access_control_id_to_selections:Updated Access Control ID to selected studies`),
            new SelectDropdown("storage_verification_for_selections", $localize `:@@storage_verification_selections:Storage Verification for selections`, $localize `:@@storage_verification_selected_objects:Storage Verification for selected objects`),
            new SelectDropdown("send_storage_commitment_request_for_selections", $localize `:@@send_storage_commitment_request_for_selections:Send Storage Commitment Request for selections`, $localize `:@@send_storage_commitment_request_for_selected_objects:Send Storage Commitment Request for selected objects`),
            new SelectDropdown("send_ian_request_for_selections", $localize `:@@send_ian_request_for_selections:Send IAN for selections`, $localize `:@@send_instance_availability_notification_request_for_selected_objects:Send Instance Availability Notification Request for selected objects`),
            new SelectDropdown("delete_object", $localize `:@@study.short_delete_object:Delete selections`, $localize `:@@study.delete_object:Delete selected studies, series or instances permanently`),
            new SelectDropdown("change_sps_status_on_selections", $localize `:@@sps_status_on_selections:SPS Status on selections`, $localize `:@@change_sps_status_on_selected_mwl:Change SPS Status on selected MWL`)
        ],
        model:undefined
    };
    exporters;
    testShow = true;
    fixedHeader = false;
    patients:PatientDicom[] = [];
    patients1:Patient1Dicom[] = [];
    studies:Study1Dicom[] = [];
    moreState = {
        "study":false,
        "patient":false,
        "series":false,
        "mwl":false,
        "mpps":false,
        "uwl":false,
        "diff":false,
        "export":false
    };
    queues;
    retrieveQueues;

    searchCurrentList = '';
    @ViewChild('stickyHeader', {static: true}) stickyHeaderView: ElementRef;
    largeIntFormat;
    filterButtonPath = {
        count:[],
        size:[]
    };
    checkboxFunctions = false;
    currentWebAppClass = "QIDO_RS";
    diffAttributeSets:SelectDropdown<DiffAttributeSet>[];
    storages:SelectDropdown<StorageSystems>[];

    constructor(
        private route:ActivatedRoute,
        private service:StudyService,
        private permissionService:PermissionService,
        public appService:AppService,
        private httpErrorHandler:HttpErrorHandler,
        private cfpLoadingBar:LoadingBarService,
        private deviceConfigurator:DeviceConfiguratorService,
        private viewContainerRef: ViewContainerRef,
        private dialog: MatDialog,
        private config: MatDialogConfig,
        private _keycloakService:KeycloakService,
        private changeDetector: ChangeDetectorRef
    ) {
        console.log("in construct",this.service.selectedElements);
    }

    ngOnInit() {

        this.largeIntFormat = new LargeIntFormatPipe();
        if(this.service.selectedElements){
            this.selectedElements = this.service.selectedElements;
        }else{
            this.selectedElements = new SelectionActionElement({});
        }
        console.log("this.studyWebService",this.studyWebService);
        this.getPatientAttributeFilters();
        this.getStudyAttributeFilters();
        this.route.params.subscribe(params => {
            this.patients = [];
            this.patients1 = [];
            this.internal = !this.internal;
            this.service.clearFilterObject(params.tab, this.filter);
            this.studyConfig.tab = undefined;
            console.log("this.studyWebService",this.studyWebService);
            setTimeout(()=>{
                this.internal = !this.internal;
                this.studyConfig.tab = params.tab;
                /*                const id = `study_${this.studyConfig.tab}`;
                                if (_.hasIn(this.appService.global, id) && this.appService.global[id]){
                                    _.forEach(this.appService.global[id], (m, i) => {
                                        this[i] = m;
                                    });
                                    delete this.appService.global[id];
                                }else{*/
                /*                    if(this.studyConfig.tab === "diff"){
                                        this.currentWebAppClass = "DCM4CHEE_ARC_AET_DIFF";
                                    }else{
                                        this.currentWebAppClass = "QIDO_RS";
                                    }*/
                switch (this.studyConfig.tab) {
                    case "diff":
                        this.currentWebAppClass = "DCM4CHEE_ARC_AET_DIFF";
                        break;
                    case "mwl":
                        this.currentWebAppClass = "MWL_RS";
                        break;
                    case "mpps":
                        this.currentWebAppClass = "DCM4CHEE_ARC_AET";
                        break;
                    case "uwl":
                        this.currentWebAppClass = "UPS_RS";
                        break;
                    default:
                        this.currentWebAppClass = "QIDO_RS";
                }
                if(_.hasIn(this.studyWebService,"selectedWebService") && !_.hasIn(this._filter,"filterModel.webApp")){
                    this._filter.filterModel["webApp"] = this.studyWebService.selectedWebService;
                };
                this.studyConfig.title = this.tabToTitleMap(params.tab);
                if(this.studyConfig.tab === "diff"){
                    this.getDiffAttributeSet(this, ()=>{
                        this.getApplicationEntities();
                    });
                }
                if (this.studyConfig.tab === "study" || this.studyConfig.tab === "series") {
                    this.getStorages(this, () => {
                        this.getApplicationEntities();
                    });
                }
                this.more = false;
                this._filter.filterModel.offset = 0;
                this.tableParam.tableSchema  = this.getSchema();
                this.initWebApps();
                /*                    if(!this.studyWebService){
                                    }else{
                                        this.setSchema();
                                        this.initExporters(2);
                                        this.initRjNotes(2);
                                        this.getQueueNames();
                                    }*/
                // }
            },1);
        });
        this.moreFunctionConfig.options.filter(option=>{
            if(option.value === "retrieve_multiple" || option.value === "import_matching_sps_to_archive"){
                return !this.internal;
            }else{
                return true;
            }
        });

    }

    onFilterTemplateSet(object){
        console.log("object",object);
        this.filter.filterModel = {};
        if(object && _.hasIn(object,"webApp") && object.webApp){
            Object.keys(object).forEach(key=>{
                if(key === "webApp" &&  this.studyWebService && this.studyWebService.webServices){
                    this.studyWebService.seletWebAppFromWebAppName(object.webApp.dcmWebAppName)
                    this.filter.filterModel["webApp"] = this.studyWebService.selectedWebService;
                    this.tableParam.tableSchema  = this.getSchema();
                    this.setMainSchema();
                }else{
                    this.filter.filterModel[key] = object[key];
                }
            })
        }else{
            Object.assign(this.filter.filterModel, object);
        }
        //
        console.log("this.studyWebService",this.studyWebService);
    }

    tabToTitleMap(tab:DicomMode){
        return {
            "study": $localize `:@@studies:Studies`,
            "patient": $localize `:@@patients:Patients`,
            "series": $localize `:@@series:Series`,
            "mwl": $localize `:@@mwl:MWL`,
            "uwl": $localize `:@@uwl:UWL`,
            "diff": $localize `:@@study.difference:Difference`,
            "mpps": $localize `:@@mpps:MPPS`
        }[tab] || $localize `:@@studies:Studies`;
    };

    get more(): boolean {
        return this.moreState[this.studyConfig.tab];
    }

    set more(value: boolean) {
        this.moreState[this.studyConfig.tab] = value;
    }

    //
    setTopToTableHeader(){
        if(this.stickyHeaderView.nativeElement.scrollHeight && this.stickyHeaderView.nativeElement.scrollHeight > 0 && this.tableParam.config.headerTop != `${this.stickyHeaderView.nativeElement.scrollHeight}px`){
            this.tableParam.config.headerTop = `${this.stickyHeaderView.nativeElement.scrollHeight}px`;
        }
    }

    @HostListener("window:scroll", ['$event'])
    onWindowScroll(e) {
        let html = document.documentElement;
        if(html.scrollTop > 63){
            this.fixedHeader = true;
            this.testShow = false;
            this.filter.expand = false;
        }else{
            this.fixedHeader = false;
            this.testShow = true;
        }

    }


    moreFunctionChanged(e){
        console.log("e",e);
        switch (e){
            case "create_patient":
                this.createPatient();
                break;
            case "supplement_issuer":
                this.supplementIssuer();
                break;
            case "update_charset":
                this.updateCharset();
                break;
            case "create_ups":
                this.createUPS();
                break;
            case "permanent_delete":
                this.deleteRejectedInstances();
                break;
            case "upload_dicom":
                this.uploadDicom();
               break;
            case "export_multiple_study":
                this.exportMultipleStudies();
               break;
            case "export_multiple_series":
                this.exportMatchingSeries();
               break;
            case "reject_multiple_study":
                this.rejectMatchingStudies();
               break;
            case "reject_multiple_series":
                this.rejectMatchingSeries();
               break;
            case "retrieve_multiple":
                this.retrieveMultipleStudies();
               break;
            case "storage_verification_studies":
                this.storageVerificationStudies();
               break;
            case "storage_verification_series":
                this.storageVerificationSeries();
               break;
            case "download_patients":
                this.downloadCSV(undefined, "patient");
                break;
            case "download_studies":
                this.downloadCSV(undefined, "study");
               break;
            case "download_series":
                this.downloadCSV(undefined, "series");
               break;
            case "download_mwl":
                this.downloadCSV(undefined, "mwl");
                break;
            case "update_access_control_id_to_matching":
                this.updateAccessControlId(e);
               break;
            case "schedule_storage_commit_for_matching_studies":
                this.sendStorageCommitmentRequestMatchingStudies();
               break;
            case "schedule_storage_commit_for_matching_series":
                this.sendStorageCommitmentRequestMatchingSeries();
               break;
            case "instance_availability_notification_for_matching_studies":
                this.sendInstanceAvailabilityNotificationMatchingStudies();
               break;
            case "instance_availability_notification_for_matching_series":
                this.sendInstanceAvailabilityNotificationMatchingSeries();
               break;
            case "change_sps_status_on_matching":
                this.changeSPSStatus(e, "matching");
               break;
            case "import_matching_sps_to_archive":
                this.importMatchingSPS();
                break;
        }
        setTimeout(()=>{
            this.moreFunctionConfig.model = undefined;
        },1);
    }
    actionsSelectionsChanged(e){
        if(e === "toggle_checkboxes"){
            this.tableParam.config.showCheckboxes = !this.tableParam.config.showCheckboxes;
            this.tableParam.tableSchema  = this.getSchema();
        }
        if(e === "export_object"){
            if(this.internal){
                this.exporter(
                        undefined,
                    $localize `:@@study.export_selected_object:Export selected objects`,
                    $localize `:@@single:single`,
                        undefined,
                        undefined,
                       this.selectedElements
                );
            }else{
                this.retrieveObject(undefined,undefined,this.selectedElements);
            }
        }
        if(e === "reject_object" || e === "restore_object"){
            this.rejectRestoreMultipleObjects();
        }
        if(e === "update_access_control_id_to_selections"){
            this.updateAccessControlId(e);
        }
        if(e === "change_sps_status_on_selections"){
            this.changeSPSStatus(e,"selected");
        }
        if(e === "storage_verification_for_selections"){
            this.storageCommitmen(undefined, undefined);
        }
        if(e === "send_storage_commitment_request_for_selections"){
            this.sendStorageCommitmentRequestSingle();
        }
        if(e === "send_ian_request_for_selections"){
            this.sendInstanceAvailabilityNotificationSingle();
        }
        setTimeout(()=>{
            this.actionsSelections.model = undefined;
        },1);
    }
    selectionAction(id){
        console.log("this.patient",this.patients);
        switch (id){
            case "checkbox_functions":{
                this.checkboxFunctions = !this.checkboxFunctions;
                break;
            }
            case "copy":{
                this.setSelectedElementAction(id);
                this.resetSetSelectionObject(undefined, undefined, true);
                break;
            }
            case "move":{
                this.setSelectedElementAction(id);
                this.resetSetSelectionObject(undefined, undefined, true);
                break;
            }
            case "link":{
                this.setSelectedElementAction(id);
                this.resetSetSelectionObject(undefined, undefined, true);
                break;
            }
            case "patient_merge":{
                this.setSelectedElementAction("merge");
                this.resetSetSelectionObject(undefined, undefined, true);
                break;
            }
            case "paste":{
                this.paste();
                break;
            }
            case 'remove_selection':{
                this.resetSetSelectionObject();
                break;
            }
            case 'uncheck_selection_study':{
                this.resetSetSelectionObject(['study'],false);
                this.checkboxFunctions = false;
                break;
            }
            case 'check_selection_study':{
                this.resetSetSelectionObject(['study'],true);
                this.checkboxFunctions = false;
                break;
            }
            case 'check_selection_patient':{
                this.resetSetSelectionObject(['patient'],true);
                this.checkboxFunctions = false;
                break;
            }
            case 'uncheck_selection_patient':{
                this.resetSetSelectionObject(['patient'],false);
                this.checkboxFunctions = false;
                break;
            }
            case 'hide_checkboxes':{
                this.resetSetSelectionObject();
                this.tableParam.config.showCheckboxes = false;
                this.tableParam.tableSchema  = this.getSchema();
                break;
            }
        }
    }
    paste(){
        console.log("past,this.selectedEleents",this.selectedElements);
        if (this.selectedElements && this.selectedElements.postActionElements && this.selectedElements.postActionElements.size > 0 && this.selectedElements.preActionElements && this.selectedElements.preActionElements.size > 0 ) {
            if (!this.selectedElements.postActionElements || this.selectedElements.postActionElements.currentIndexes.length > 1) {
                this.appService.showError($localize `:@@study.more_than_one_target_selected:More than one target selected!`);
            }
            if (this.selectedElements.action == "merge" && this.selectedElements.preActionElements.currentIndexes.length > 1) {
                this.appService.showError($localize `:@@study.more_than_one_source_patient_selected:More than one source patient selected for merge!`);
            }
            else {
                if (this.selectedElements.preActionElements.currentIndexes.indexOf(this.selectedElements.postActionElements.currentIndexes[0]) > -1) {
                    this.appService.showError($localize `:@@study.target_object_can_not_be_in_clipboard:Target object can not be in the clipboard`);
                }else{
                    this.config.viewContainerRef = this.viewContainerRef;
                    this.dialogRef = this.dialog.open(StudyTransferringOverviewComponent, {
                        height: 'auto',
                        width: '90%'
                    });
                    let select:SelectDropdown<any>[] =  [];
                    _.forEach(this.trash.rjnotes, (m, i) => {
                        select.push( new SelectDropdown<any>(m.codeValue + '^' + m.codingSchemeDesignator,m.label, m.codeMeaning));
                    });
                    this.dialogRef.componentInstance.selectedElements = this.selectedElements;
                    this.dialogRef.componentInstance.rjnotes = select;
                    this.dialogRef.componentInstance.title = this.service.getTextFromAction(this.selectedElements.action);
                    this.dialogRef.afterClosed().subscribe(result => {
                        console.log("result",result);
                        console.log("selectedElements",this.selectedElements);
                        if (result) {
                            this.cfpLoadingBar.start();
                            switch (this.selectedElements.action) {
                                case 'merge':
                                    this.service.mergePatients(this.selectedElements,this.studyWebService)
                                        .subscribe((response) => {
                                            this.appService.showMsg($localize `:@@study.patients_merged_successfully:Patients merged successfully!`);
                                            this.clearClipboard();
                                            this.cfpLoadingBar.complete();
                                        }, (response) => {
                                            this.cfpLoadingBar.complete();
                                            this.httpErrorHandler.handleError(response);
                                        });
                                    break;
                                case 'link':
                                    this.service.linkStudyToMwl(this.selectedElements, this.studyWebService.selectedWebService, result.reject).subscribe(res=>{
                                        console.log("res",res);
                                        this.cfpLoadingBar.complete();
                                        this.appService.showMsgCopyMoveLink(res, this.service.getTextFromAction(this.selectedElements.action));
                                        this.clearClipboard();
                                    },err=>{
                                        this.cfpLoadingBar.complete();
                                        this.httpErrorHandler.handleError(err);
                                    });
                                    break;
                                default:
                                    this.service.copyMove(this.selectedElements, this.studyWebService.selectedWebService,result.reject).subscribe(res=>{
                                        try{
                                            console.log("res",res);
                                            this.appService.showMsgCopyMoveLink(res, this.service.getTextFromAction(this.selectedElements.action));
                                        }catch (e) {
                                            this.httpErrorHandler.handleError(res);
                                        }
                                        this.clearClipboard();
                                        this.cfpLoadingBar.complete();
                                    },err=>{
                                        this.cfpLoadingBar.complete();
                                        this.httpErrorHandler.handleError(err);
                                    });
                            }
                        }else{
/*                            if(this.selectedElements.action === "link" && this.studyConfig.tab === "mwl"){
                                this.resetSetSelectionObject(["mwl"],false,true);
                            }else{*/
                                this.clearClipboard();
                            // }
                        }
                        this.dialogRef = null;
                    });
                }
            }
        }else {
            if(!this.selectedElements.postActionElements || !this.selectedElements.postActionElements.size || this.selectedElements.postActionElements.size === 0){
                this.appService.showWarning($localize `:@@study.no_target_selected:No target object was selected!`);
            }
        }
    }
    setSelectedElementAction(id){
        if((this.selectedElements.postActionElements && this.selectedElements.postActionElements.size > 0) || (this.selectedElements.preActionElements && this.selectedElements.preActionElements.size > 0)){
            this.selectedElements.action = id;
        }
    }
    resetSetSelectionObject(resetIds?:string[], selectedValue?:boolean, noResetSelectElements?:boolean, allReset?:boolean){
        let newObject = {};
        selectedValue = selectedValue || false;
        resetIds = resetIds || [
            "instance",
            "series",
            "patient",
            "study",
            "mwl"
        ];
        resetIds.forEach(id=>{
            newObject[id] = {};
        });

        if(!noResetSelectElements){
            if(this.selectedElements){
                this.selectedElements.reset(allReset);
            }
        }

        this.patients.forEach(patient=>{
            if(resetIds.indexOf("patient") > -1){
                patient.selected = selectedValue;
            }
            if(patient.studies && resetIds.indexOf("study") > -1)
                patient.studies.forEach(study=>{
                    study.selected = selectedValue;
                    if(study.series && resetIds.indexOf("series") > -1)
                        study.series.forEach(serie=>{
                            serie.selected = selectedValue;
                            if(serie.instances && resetIds.indexOf("instance") > -1)
                                serie.instances.forEach(instance=>{
                                    instance.selected = selectedValue;
                                })
                        })
                });
            if(patient.mwls && resetIds.indexOf("mwl") > -1)
                patient.mwls.forEach(study=>{
                    study.selected = selectedValue;
                });
        })
    }

    select(object, dicomLevel:DicomLevel){
        this.selectedElements.toggle(dicomLevel, this.service.getObjectUniqueId(object.attrs, dicomLevel), object);
        console.log("selectedElements",this.selectedElements);
    }
    clearClipboard(){
        this.resetSetSelectionObject(undefined,undefined,undefined,true);
    }
    onFilterClear(e){
        console.log("e",e);
        if(_.hasIn(e,"webApp") && e.webApp === ""){
            this.studyWebService.selectedWebService = undefined;
        }
    }
    onRemoveFromSelection(e){
        console.log("e",e);
        this.selectedElements.toggle(e.dicomLevel,e.uniqueSelectIdObject, e.object, "preActionElements");
    }
    actions(id, model){
        console.log("id",id);
        console.log("model",model);
        if(this.studyWebService.selectedWebService){ //selectedWebAppService

            if(id.action === "select"){
                // console.log("getid",this.service.getObjectUniqueId(model.attrs, id.level));
                this.select(model, id.level);
                console.log("this.selectedElement",this.selectedElements);
            }

            if(id.action === "toggle_studies"){
                if(!model.studies || model.studies.length === 0){
                    // this.getStudies(model);
                    console.log("models",model);
                    //TODO getStudies (needed for patient mode)
                    let filterModel =  this.getFilterClone();
                    if(filterModel.limit){
                        filterModel.limit++;
                    }
                    this.getAllStudiesToPatient(model,filterModel, 0);
                    //getAllStudies
                }else{
                    model.studies = [];
                    model.showStudies = !model.showStudies;
                }

            }
            if(id.action === "toggle_series"){
                if(!model.series){
                    this.getSeriesOfStudy(model, 0);
                }else{
                    model.showSeries = !model.showSeries;
                }

            }
            if(id.action === "toggle_instances"){
                if(!model.instances){
                    this.getInstances(model, 0);
                }else{
                    model.showInstances = !model.showInstances;
                }

            }
            if(id.action === "edit_patient"){
                this.editPatient(model);
            }
            if(id.action === "edit_uwl"){
                this.editUPS(model);
            }
            if(id.action === "clone_uwl"){
                this.cloneUPS(model);
            }
            if(id.action === "reschedule_uwl"){
                this.rescheduleUPS(model);
            }
            if(id.action === "cancel_uwl"){
                this.cancelUPS(model);
            }
            if(id.action === "delete_patient"){
                this.deletePatient(model);
            }
            if(id.action === "unmerge_patient"){
                this.unmergePatient(model);
            }
            if(id.action === "pdq_patient"){
                this.queryNationalPatientRegister(model);
            }
            if(id.action === "download"){
                if(id.level === "instance"){
                    if(id.mode === "uncompressed"){
                        this.downloadURL(model);
                    }else{
                        this.downloadURL(model, "*");
                    }
                }else{
                    this.downloadZip(model,id.level,id.mode);
                }
            }
            if(id.action === "reject"){
                if(id.level === "study"){
                    this.rejectStudy(model);
                }
                if(id.level === "series"){
                    this.rejectSeries(model);
                }
                if(id.level === "instance"){
                    this.rejectInstance(model);
                }
            }
            if(id.action === "delete"){
                if(id.level === "study"){
                    this.deleteStudy(model);
                }
            }
            if(id.action === "verify_storage"){
                this.storageCommitmen(id.level, model);
            }
            if(id.action === "export"){
                if(this.internal){
                    if(id.level === "study"){
                        this.exportStudy(model);
                    }
                    if(id.level === "instance"){
                        this.exportInstance(model);
                    }
                    if(id.level === "series"){
                        this.exportSeries(model);
                    }
                }else{
                    this.retrieveObject(id.level, model);
                }
            }
            if(id.action === "edit_study"){
                this.editStudy(model);
            }
            if(id.action === "edit_series"){
                this.editSeries(model);
            }
            if(id.action === "edit_study"){
               // this.editMWL(model);
            }
            if(id.action === "delete_mwl"){
               this.deleteMWL(model);
            }
            if(id.action === "modify_expired_date"){
                this.setExpiredDate(model);
            }
            if(id.action === "create_mwl"){
                this.createMWL(model);
            }
            if(id.action === "edit_mwl"){
                console.log("id",id);
                console.log("model", model);
                this.editMWL(model.patient,model);
            }
            if(id.action === "download_csv"){
                this.downloadCSV(model.attrs, id.level);
            }
            if(id.action === "open_viewer"){
                this.openViewer(model.attrs, id.level);
            }
            if(id.action === "upload_file"){
/*                switch (id.level) {
                    case "patient":
                        this.uploadInPatient(model);
                        break;
                    case "mwl":
                        this.uploadFile(model, id.level);
                        break;
                    default:
                        this.uploadFile(model, id.level);

                }*/
                this.uploadFile(model, id.level);
/*                if(id.level === "patient"){
                    this.uploadInPatient(model);
                }else{
                    this.uploadFile(model, id.level);
                }*/
            }
            if(id.action === "view"){
                this.viewInstance(model);
            }
            if(id.action === "update_access_control_id"){
                this.updateAccessControlId(id.action, model);
            }
            if(id.action === "change_sps_status"){
                this.changeSPSStatus(model, "single");
            }
            if(id.action === "send_storage_commit"){
                this.sendStorageCommitmentRequestSingle(id.level , model);
            }
            if(id.action === "send_instance_availability_notification"){
                this.sendInstanceAvailabilityNotificationSingle(id.level , model);
            }
        }else{
            this.appService.showError($localize `:@@study.no_webapp_selected:No Web Application Service was selected!`);
        }
    }

    uploadDicom(){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(UploadDicomComponent, {
            height: 'auto',
            width: '500px'
        });
/*        this.dialogRef.componentInstance.aes = this.aes;
        this.dialogRef.componentInstance.selectedAe = this.aetmodel.dicomAETitle;*/
        this.dialogRef.componentInstance.selectedWebApp = this.studyWebService.selectedWebService;
        this.dialogRef.afterClosed().subscribe((result) => {
            console.log('result', result);
            if (result){
            }
        });
    };
    uploadInPatient(object){
        console.log("in uuploadInPatient",object);
        this.service.createEmptyStudy(object.attrs, this.studyWebService.selectedWebService).subscribe(res=>{
            this.uploadFile({attrs:res},"patient");
        },err=>{
            this.httpErrorHandler.handleError(err);
        });
    }
    uploadFile(object,mode){
        // this.service.getUploadFileWebApp(this.studyWebService).subscribe((webApp:DcmWebApp)=>{


            if(mode === "mwl"){
                //perpare mwl object for study upload
                let newObject = {
                    "00400275":{
                        "Value":[{}],
                        "vr":"SQ"
                    }
                };
                let inSequenceCodes = [
                    "00401001",
                    "00321060",
                    "00400009",
                    "00400007",
                    "00400008"
                ];
                let mapCodes = {
                    "00401001":{
                        "code":"00200010",
                        "vr":"SH"
                    },
                    "00321060":{
                        "code":"00081030",
                        "vr":"LO"
                    },
                    "00400100":[
                        {
                            "map":"Value[0]['00400002']",
                            "code":"00080020",
                            "vr":"DA"
                        },
                        {
                            "map":"Value[0]['00400003']",
                            "code":"00080030",
                            "vr":"TM"
                        }
                    ]
                };
                let removeCode = [
                    "00401001",
                    "00400100",
                    "00321060",
                    "00321064"
                ];
                _.forEach(object.attrs,(m,i)=>{
                    if(_.indexOf(inSequenceCodes,i) > -1){
                        newObject["00400275"].Value[0][i] = m;
                        this.service.mapCode(m,i,newObject,mapCodes);
                    }else{
                        if(_.indexOf(removeCode,i) === -1){
                            newObject[i] = m;
                        }else{
                            this.service.mapCode(m,i,newObject,mapCodes);
                        }
                    }
                });

                object.attrs = newObject;
            }
            this.config.viewContainerRef = this.viewContainerRef;
            this.dialogRef = this.dialog.open(UploadFilesComponent, {
                height: 'auto',
                width: '900px'
            });
    /*        this.dialogRef.componentInstance.aes = this.aes;
            this.dialogRef.componentInstance.selectedAe = this.aetmodel.dicomAETitle;*/
            this.dialogRef.componentInstance.preselectedWebApp = this.studyWebService.selectedWebService;
            // this.dialogRef.componentInstance.studyWebService = this.studyWebService;
            this.dialogRef.componentInstance.dicomObject = _.cloneDeep(object);
            this.dialogRef.componentInstance.mode = mode;
            this.dialogRef.afterClosed().subscribe((result) => {
                console.log('result', result);
                if (result){
                }
                this.dialogRef.componentInstance.dicomObject = undefined;
                this.dialogRef.componentInstance.tempAttributes = undefined;
            });
        // });
    }
    deletePatient(patient){
        // console.log("study",study);
        // if (!_.hasIn(patient, 'attrs["00201200"].Value[0]') || patient.attrs['00201200'].Value[0] === ''){
        const patientId = this.service.getPatientId(patient.attrs);
        if (!patientId || patientId === ""){
            this.appService.showError($localize `:@@study.cant_delete_with_empty_id:Cannot delete patient with empty Patient ID!`);
            this.cfpLoadingBar.complete();
        }else{
            let $this = this;
            this.confirm({
                content: 'Are you sure you want to delete this patient?'
            }).subscribe(result => {
                if (result){
                    $this.cfpLoadingBar.start();
                    this.service.deletePatient(this.studyWebService.selectedWebService, patientId).subscribe(
                        (response) => {
                            $this.appService.showMsg($localize `:@@study.patient_deleted:Patient deleted successfully!`);
                            // patients.splice(patientkey,1);
                            $this.cfpLoadingBar.complete();
                        },
                        (err) => {
                            $this.httpErrorHandler.handleError(err);
                            // angular.element("#querypatients").trigger('click');
                            $this.cfpLoadingBar.complete();
                        }
                    );
                }
            });
        }
    };
    unmergePatient(patient){
        const patientId = this.service.getPatientId(patient.attrs);
        if (!patientId || patientId === ""){
            this.appService.showError($localize `:@@unmerge_with_empty_id_not_allowed:Cannot unmerge patient with empty Patient ID!`);
            this.cfpLoadingBar.complete();
        }else{
            let $this = this;
            this.confirm({
                content: $localize `:@@unmerge_patient_ask_confirmation:Are you sure you want to unmerge this patient?`
            }).subscribe(result => {
                if (result){
                    $this.cfpLoadingBar.start();
                    this.service.unmergePatient(this.studyWebService.selectedWebService, patientId).subscribe(
                        (response) => {
                            $this.appService.showMsg($localize `:@@unmerged_patient_successfully:Patient unmerged successfully!`);
                            $this.cfpLoadingBar.complete();
                        },
                        (err) => {
                            $this.httpErrorHandler.handleError(err);
                            $this.cfpLoadingBar.complete();
                        }
                    );
                }
            });
        }
    };
    deleteMWL(mwl){
        this.confirm({
            content: $localize `:@@study.delete_this_mwl:Are you sure you want to delete this MWL?`
        }).subscribe(result => {
            if (result){
                this.cfpLoadingBar.start();
                let studyInstanceUID = j4care.valueOf(mwl.attrs['0020000D']);
                let scheduledProcedureStepID = (<string>_.get(mwl.attrs, "['00400100'].Value[0]['00400009'].Value[0]"));
                if(studyInstanceUID && scheduledProcedureStepID){
                    this.service.deleteMWL(this.studyWebService.selectedWebService, studyInstanceUID, scheduledProcedureStepID).subscribe(
                        (response) => {
                            this.appService.showMsg('MWL deleted successfully!');
                            this.cfpLoadingBar.complete();
                            this.search("current",{id:"submit"});
                        },
                        (err) => {
                            this.httpErrorHandler.handleError(err);
                            this.cfpLoadingBar.complete();
                        }
                    );
                }else{
                    this.appService.showError($localize `:@@study.study_or_scheduled_missing:Study Instance UID or Scheduled Procedure Step ID is missing!`);
                }
            }
        });
    };
    editMWL(patient, mwl){
        let config = {
            saveLabel:$localize `:@@SAVE:SAVE`,
            titleLabel:$localize `:@@study.edit_mwl:Edit MWL of patient `
        };
        config.titleLabel = $localize `:@@study.edit_mwl:Edit MWL of patient `;
        config.titleLabel += ((_.hasIn(patient, 'attrs.00100010.Value.0.Alphabetic')) ? '<b>' + patient.attrs['00100010'].Value[0]['Alphabetic'] + '</b>' : ' ');
        config.titleLabel += ((_.hasIn(patient, 'attrs.00100020.Value.0')) ? ' with ID: <b>' + patient.attrs['00100020'].Value[0] + '</b>' : '');
        this.modifyMWL(patient, 'edit', '', '', mwl, config);
    };
    createMWL(patient){
        let mwl: any = {
            'attrs': {
                '00400100': {
                    'vr': 'SQ',
                    'Value': [{
                        '00400001': { 'vr': 'AE', 'Value': ['']},
                        '00400009': { 'vr': 'SH', 'Value': ['']},
                    }]
                },
                '0020000D': { 'vr': 'UI', 'Value': ['']},
                '00080050': { 'vr': 'SH', 'Value': ['']},
                '00401001': { 'vr': 'SH', 'Value': ['']}
            }
        };
        let config = {
            saveLabel:$localize `:@@CREATE:CREATE`,
            titleLabel:$localize `:@@study.create_mwl:Create new MWL`
        };
        this.modifyMWL(patient, 'create', '', '', mwl, config);
    };
    modifyMWL(patient, mode, patientkey, mwlkey, mwl, config:{saveLabel:string, titleLabel:string}){
        let originalMwlObject = _.cloneDeep(mwl);
        this.config.viewContainerRef = this.viewContainerRef;

        this.lastPressedCode = 0;
        if (mode === 'edit'){
            _.forEach(mwl.attrs, function(value, index) {
                let checkValue = '';
                if (value.Value && value.Value.length){
                    checkValue = value.Value.join('');
                }
                if (!(value.Value && checkValue != '')){
                    delete mwl.attrs[index];
                }
            });
            if (mwl.attrs['00400100'].Value[0]['00400002'] && !mwl.attrs['00400100'].Value[0]['00400002'].Value){
                mwl.attrs['00400100'].Value[0]['00400002']['Value'] = [''];
            }
        }

        // this.config.width = "800";

        let $this = this;
        this.service.getMwlIod().subscribe((res) => {
            let iod = $this.service.replaceKeyInJson(res, 'items', 'Value');
            let mwlFiltered = _.cloneDeep(mwl);
            mwlFiltered.attrs = new ComparewithiodPipe().transform(mwl.attrs, iod);
            $this.service.initEmptyValue(mwlFiltered.attrs);
            $this.dialogRef = $this.dialog.open(EditMwlComponent, {
                height: 'auto',
                width: '90%'
            });
            $this.dialogRef.componentInstance.iod = iod;
            $this.dialogRef.componentInstance.mode = mode;
            $this.dialogRef.componentInstance.dropdown = $this.service.getArrayFromIod(res);
            $this.dialogRef.componentInstance.mwl = mwlFiltered;
            $this.dialogRef.componentInstance.mwlkey = mwlkey;
            $this.dialogRef.componentInstance.saveLabel = config.saveLabel;
            $this.dialogRef.componentInstance.titleLabel = config.titleLabel;
            $this.dialogRef.afterClosed().subscribe(result => {
                //If user clicked save
                console.log('result', result);
                if (result){
                    $this.service.clearPatientObject(mwlFiltered.attrs);
                    $this.service.convertStringToNumber(mwlFiltered.attrs);
                    // StudiesService.convertDateToString($scope, "mwl");
                    let local = {};

                    $this.service.appendPatientIdTo(patient.attrs, local);

                    _.forEach(mwlFiltered.attrs, function(m, i){
                        if (res[i]){
                            local[i] = m;
                        }
                    });
                    _.forEach(mwlFiltered.attrs, function(m, i){
                        if ((res && res[i] && res[i].vr != 'SQ') && m.Value && m.Value.length === 1 && m.Value[0] === ''){
                            delete mwlFiltered.attrs[i];
                        }
                    });
                    console.log('on post', local);
                    this.service.modifyMWL(local,this.studyWebService, new HttpHeaders({ 'Content-Type': 'application/dicom+json' })).subscribe((response) => {
                        if (mode === 'edit'){
                            // _.assign(mwl, mwlFiltered);
                            $this.appService.showMsg($localize `:@@study.mwl_saved:MWL saved successfully!`);
                        }else{
                            $this.appService.showMsg($localize `:@@study.mwl_create:MWL created successfully!`);
                        }
                    }, (response) => {
                        $this.httpErrorHandler.handleError(response);
                    });
                }else{
                    _.assign(mwl, originalMwlObject);
                }
                $this.dialogRef = null;
            });
        }, (err) => {
            console.log('error', err);
        });
    }

    importMatchingSPS() {
        this.confirm({
            content: $localize `:@@mwl.import_matching_sps:Import matching Scheduled Procedure Steps to archive`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@destination_aet:Destination AET`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName == this.appService.archiveDeviceName),
                            filterKey:"destination",
                            description:$localize `:@@destination_aet:Destination AET`,
                            placeholder:$localize `:@@destination_aet:Destination AET`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@mwl.filter_by_scu:Filter By SCU`
                        },
                        {
                            tag: "checkbox",
                            filterKey: "filterbyscu",
                            description:$localize `:@@mwl.filter_by_scu_desc:Apply specified filter on matches returned by external MWL SCP`,
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@title.delete:Delete`
                        },
                        {
                            tag: "checkbox",
                            filterKey: "delete",
                            description:$localize `:@@mwl.delete_desc:Delete Scheduled Procedure Steps from local MWL not returned by external MWL SCP`,
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@test:Test`
                        },
                        {
                            tag: "checkbox",
                            filterKey: "test",
                            description:$localize `:@@mwl.test_desc:Only test import from external MWL SCP without performing the operation`,
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@IMPORT:IMPORT`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.destination")){
                this.service.importMatchingSPS(this.studyWebService.selectedWebService,
                                                ok.schema_model.destination,
                                                this.createStudyFilterParams(true,true))
                            .subscribe(res => {
                                console.log("res",res);
                                this.cfpLoadingBar.complete();
                                let count = _.get(res, "count");
                                let created = _.hasIn(res, "created") ? _.get(res, "created") : '';
                                let updated = _.hasIn(res, "updated") ? _.get(res, "updated") : '';
                                let deleted = _.hasIn(res, "deleted") ? _.get(res, "deleted") : '';
                                let failures = _.hasIn(res, "failures") ? _.get(res, "failures") : '';
                                let error = _.hasIn(res, "error") ? _.get(res, "error") : '';

                                let msg = `Count: ` + count;
                                if (created != '')
                                    msg = msg + `<br>\nCreated: ` + created;
                                if (updated != '')
                                    msg = msg + `<br>\nUpdated: ` + updated;
                                if (deleted != '')
                                    msg = msg + `<br>\nDeleted: ` + deleted;
                                if (failures != '')
                                    msg = msg + `<br>\nFailures: ` + failures;
                                if (error != '')
                                    msg = msg + `<br>\nError: ` + error;
                                if (failures  != '' || error != '') {
                                    if (count != '' || created  != '' || updated  != '' || deleted  != '')
                                        this.appService.showWarning(msg);
                                    else
                                        this.appService.showError(msg);
                                } else
                                    this.appService.showMsg(msg);
                            }, err => {
                                this.cfpLoadingBar.complete();
                                this.httpErrorHandler.handleError(err);
                            });
            }
        });
    }

    changeSPSStatus(model, spsMode?:("single"|"selected"|"matching")){
        console.log("model",model);
        console.log("status",_.get(model,"attrs[00400100].Value[0][00400020].Value[0]"));
        console.log("spsID",_.get(model,"attrs[00400100].Value[0][00400009].Value[0]"));
        const currentStatus = _.get(model,"attrs[00400100].Value[0][00400020].Value[0]");
        let headerMsg:string;
        switch (spsMode) {
            case "single":
                headerMsg = $localize `:@@change_sps_single:Change Scheduled Procedure Step Status of the MWL`;
                break;
            case "matching":
                headerMsg = $localize `:@@change_sps_matching:Change Scheduled Procedure Step Status of the matching MWL`;
                break;
            case "selected":
                headerMsg = $localize `:@@change_sps_selected:Change Scheduled Procedure Step Status of the selected MWL`;
                break;
        }
        this.confirm({
            content: headerMsg,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label_large",
                            text:$localize `:@@select_scheduled_procedure_step_status:Select the Scheduled Procedure Step Status`
                        }
                    ],
                    [
                        {
                            tag:"label",
                            text:$localize `:@@sps_status:SPS Status`
                        },
                        {
                            tag:"select",
                            options:[
                                new SelectDropdown("SCHEDULED", $localize `:@@SCHEDULED:SCHEDULED`),
                                new SelectDropdown("ARRIVED", $localize `:@@ARRIVED:ARRIVED`),
                                new SelectDropdown("READY", $localize `:@@READY:READY`),
                                new SelectDropdown("STARTED", $localize `:@@STARTED:STARTED`),
                                new SelectDropdown("DEPARTED", $localize `:@@DEPARTED:DEPARTED`),
                                new SelectDropdown("CANCELED", $localize `:@@CANCELED:CANCELED`),
                                new SelectDropdown("DISCONTINUED", $localize `:@@DISCONTINUED:DISCONTINUED`),
                                new SelectDropdown("COMPLETED", $localize `:@@COMPLETED:COMPLETED`),
                            ],
                            filterKey:"spsState",
                            description:$localize `:@@scheduled_procedure_step_status:Scheduled Procedure Step Status`,
                            placeholder:$localize `:@@sps_status:SPS Status`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {
                    spsState:currentStatus
                }
            },
            saveButton: $localize `:@@APPLY:APPLY`
        }).subscribe(ok=>{
            if(ok && ok.schema_model.spsState &&  ((spsMode === "single" && ok.schema_model.spsState != currentStatus) || spsMode != "single")){
                this.cfpLoadingBar.start();
                switch (spsMode) {
                    case "single":
                        this.service.changeSPSStatusSingleMWL(
                            this.studyWebService.selectedWebService,
                            ok.schema_model.spsState,
                            model
                        ).subscribe(res=>{
                            this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                            this.cfpLoadingBar.complete();
                            _.set(model,"attrs[00400100].Value[0][00400020].Value[0]",ok.schema_model.spsState);
                        },err=>{
                            this.cfpLoadingBar.complete();
                            this.httpErrorHandler.handleError(err);
                        });
                        break;
                    case "matching":
                        this.service.changeSPSStatusMatchingMWL(this.studyWebService.selectedWebService,ok.schema_model.spsState, this.createStudyFilterParams(true,true, true)).subscribe(res=>{
                            this.cfpLoadingBar.complete();
                            this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                            this.search("current",{id:"submit"});
                        },err=>{
                            this.cfpLoadingBar.complete();
                            this.httpErrorHandler.handleError(err);
                        });
                        break;
                    case "selected":
                        this.service.changeSPSStatusSelectedMWL(
                            this.selectedElements,
                            this.studyWebService.selectedWebService,
                            ok.schema_model.spsState
                        ).subscribe(res=>{
                            this.cfpLoadingBar.complete();
                            try{
                                const errorCount = res.filter((result:any)=>result && result.isError).length;
                                if(errorCount > 0){
                                    this.appService.showMsg($localize `:@@mwl.process_executed_successfully_detailed:Process executed successfully:<br>\nErrors: ${errorCount}:@@error:<br>\nSuccessful: ${res.length - errorCount}:@@successful:`);
                                }else{
                                    this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                                }
                                this.clearClipboard();
                            }catch (e) {
                                j4care.log("Error on change sps status on selected mode result",e);
                                this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                            }
                        },err=>{
                            this.cfpLoadingBar.complete();
                            this.httpErrorHandler.handleError(err);
                        });
                        break;
                }
/*                if(spsMode === "matching"){
                    this.service.changeSPSStatusMatchingMWL(this.studyWebService.selectedWebService,ok.schema_model.spsState, this.createStudyFilterParams(true,true, true)).subscribe(res=>{
                        this.cfpLoadingBar.complete();
                        this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                        this.search("current",{id:"submit"});
                    },err=>{
                        this.cfpLoadingBar.complete();
                        this.httpErrorHandler.handleError(err);
                    })
                }else{
                    this.service.changeSPSStatusSingleMWL(
                            this.studyWebService.selectedWebService,
                            ok.schema_model.spsState,
                            model
                    ).subscribe(res=>{
                        this.appService.showMsg($localize `:@@mwl.status_changed_successfully:Status changed successfully`);
                        this.cfpLoadingBar.complete();
                        _.set(model,"attrs[00400100].Value[0][00400020].Value[0]",ok.schema_model.spsState);
                    },err=>{
                        this.cfpLoadingBar.complete();
                        this.httpErrorHandler.handleError(err);
                    })
                }*/

            }
        })
    }

    /*
    * @confirmparameters is an object that can contain title, content
    * */
    confirm(confirmparameters){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(ConfirmComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.parameters = confirmparameters;
        return this.dialogRef.afterClosed();
    };
    openViewer(model, mode){
        try {
            let token;
            let url;
            const target = this.studyWebService.selectedWebService['IID_URL_TARGET'] || '';
            let configuredUrlString = mode === "study" ? this.studyWebService.selectedWebService['IID_STUDY_URL'] : this.studyWebService.selectedWebService['IID_PATIENT_URL'];
            let studyUID = this.service.getStudyInstanceUID(model) || "";
            let patientID = this.service.getPatientId(model);
            let patientBirthDate = _.get(model, "00100030.Value.0");
            let accessionNumber = _.get(model, "00080050.Value.0");
            let patientName = _.get(model, "00100010.Value[0].Alphabetic");
            let dcmWebServicePath = this.studyWebService.selectedWebService.dcmWebServicePath;
            let qidoBaseURL = j4care.getUrlFromDcmWebApplication(this.studyWebService.selectedWebService,this.appService.baseUrl, true);
            let replaceDoubleBraces = (url, result) => {
                return url.replace(/{{(currentDateTime-)?(.+?)}}/g, (match, g1, g2) => {
                    if(g1){
                        return j4care.formatDate(j4care.createDateFromDuration(j4care.extractDurationFromValue(g2)),"yyyy-MM-dd");
                    }else{
                        return result[g2] == null ? g2 : result[g2];
                    }
                })
            };
            let substitutions;
            this.service.getTokenService(this.studyWebService).subscribe((response) => {
                if (!this.appService.global.notSecure) {
                    token = response.token;
                }
                substitutions = {
                    "patientID": patientID,
                    "patientBirthDate":patientBirthDate,
                    "studyUID": studyUID,
                    "patientName": patientName,
                    "accessionNumber": accessionNumber,
                    "access_token": token,
                    "qidoBasePath": dcmWebServicePath,
                    "qidoBaseURL": qidoBaseURL
                };
                url = replaceDoubleBraces(configuredUrlString, substitutions).trim();
                console.log("Prepared URL: ", url);
                console.groupEnd();
                if (target) {
                    window.open(encodeURI(url), target);
                } else {
                    window.open(encodeURI(url));
                }
            });
        }catch(e){
            j4care.log("Something went wrong while opening the Viewer",e);
            this.appService.showError($localize `:@@study_error_on_opening_viewer:Something went wrong while opening the Viewer open the inspect to see more details`);
        }
    };
    viewInstance(inst) {
        let token;
        // let url:string;
        let urlObservable:Observable<string>;
        let contentType;
        this.service.getTokenService(this.studyWebService).subscribe((response)=>{
            if(!this.appService.global.notSecure){
                token = response.token;
            }
            // this.select_show = false;
            if(inst.video || inst.image || inst.numberOfFrames || inst.gspsQueryParams.length){
                if (inst.gspsQueryParams.length){
                    urlObservable =  this.service.wadoURL(this.studyWebService,inst.gspsQueryParams[inst.view - 1]);
                }
                if (inst.numberOfFrames || (inst.image && !inst.video)){
                    contentType = 'image/jpeg';
                    urlObservable =  this.service.wadoURL(this.studyWebService,inst.wadoQueryParams, { contentType: 'image/jpeg'});
                }
                if (inst.video){
                    contentType = 'video/*';
                    urlObservable =  this.service.wadoURL(this.studyWebService,inst.wadoQueryParams, { contentType: 'video/*' });
                }
            }else{
                urlObservable = this.service.wadoURL(this.studyWebService,inst.wadoQueryParams);
            }
            if(!contentType){
                if(_.hasIn(inst,"attrs.00420012.Value.0") && inst.attrs['00420012'].Value[0] != ''){
                    contentType = inst.attrs['00420012'].Value[0];
                }
            }
            if(!contentType || contentType.toLowerCase() === 'application/pdf' || contentType.toLowerCase().indexOf("video") > -1 || contentType.toLowerCase() === 'text/xml'){
                // this.j4care.download(url);
                this.service.renderURL(this.studyWebService, inst).subscribe(renderUrl=>{
                    if(!this.appService.global.notSecure){
                        // console.log("te",this.service.renderURL(this.studyWebService, inst));
                        WindowRefService.nativeWindow.open(renderUrl+ `&access_token=${token}`);
                    }else{
                        WindowRefService.nativeWindow.open(renderUrl);
                    }
                });
            }else{
                urlObservable.subscribe(url=>{
                    this.config.viewContainerRef = this.viewContainerRef;
                    this.dialogRef = this.dialog.open(ViewerComponent, {
                        height: 'auto',
                        width: 'auto',
                        panelClass:"viewer_dialog"
                    });
                    this.dialogRef.componentInstance.views = inst.views;
                    this.dialogRef.componentInstance.view = inst.view;
                    this.dialogRef.componentInstance.studyWebService = this.studyWebService;
                    this.dialogRef.componentInstance.contentType = contentType;
                    this.dialogRef.componentInstance.url = url;
                    this.dialogRef.afterClosed().subscribe();
                })
            }
            // window.open(this.renderURL(inst));
        });
    };
    downloadCSV(attr?, mode?){
        let queryParameters = this.createQueryParams(0, 1000, this.createStudyFilterParams());
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
            let url;
            this.service.getTokenService(this.studyWebService).subscribe((response)=>{
                if(!this.appService.global.notSecure){
                    token = response.token;
                }
                let filterClone = _.cloneDeep(queryParameters);
                delete filterClone['offset'];
                delete filterClone['limit'];
                filterClone["accept"] = `text/csv${(semicolon?';delimiter=semicolon':'')}`;
                let fileName = "dcm4chee.csv";
                if(attr && mode){
                    url = this.service.getDicomURL("study",this.studyWebService.selectedWebService);
                    filterClone["PatientID"] =  j4care.valueOf(attr['00100020']);
                    filterClone["IssuerOfPatientID"] = j4care.valueOf(attr['00100021']);
                    if(mode === "series" && _.hasIn(attr,'0020000D')){
                        url =`${url}/${j4care.valueOf(attr['0020000D'])}/series`;
                        fileName = `${j4care.valueOf(attr['0020000D'])}.csv`;
                    }
                    if(mode === "instance"){
                        url =`${url}/${j4care.valueOf(attr['0020000D'])}/series/${j4care.valueOf(attr['0020000E'])}/instances`;
                        fileName = `${j4care.valueOf(attr['0020000D'])}_${j4care.valueOf(attr['0020000E'])}.csv`;
                    }
                }else{
                    if(attr === undefined && mode === "patient"){
                        url = `${this.service.getDicomURL("patient",this.studyWebService.selectedWebService)}`;
                    }
                    if(attr === undefined && mode === "study"){
                        url = `${this.service.getDicomURL("study",this.studyWebService.selectedWebService)}`;
                    }
                    if(attr === undefined && mode === "series"){
                        url = `${this.service.getDicomURL("series",this.studyWebService.selectedWebService)}`;
                    }
                    if(attr === undefined && mode === "mwl"){
                        url = `${this.service.getDicomURL("mwl",this.studyWebService.selectedWebService)}`;
                    }
                }
                if(!this.appService.global.notSecure){
                    filterClone["access_token"] = token;
                }
                j4care.downloadFile(`${url}?${this.appService.param(filterClone)}`,fileName);
                // WindowRefService.nativeWindow.open(`${url}?${this.appService.param(filterClone)}`);
            });
        })
    }

    downloadZip(object, level, mode) {
        this.confirm({
            content: $localize `:@@download_this_leveltext:Download this ${this.service.getLevelText(level)}:@@levelText:`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@compress:Compress`
                        },
                        {
                            tag:"checkbox",
                            filterKey:"compressed"
                        }
                    ],
                    [
                        {
                            tag:"label",
                            text:$localize `:@@including_dicomdir:Include DICOMDIR`
                        },
                        {
                            tag:"checkbox",
                            filterKey:"includingdicomdir"
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@download:Download`
        }).subscribe((ok)=>{
            if(ok){
                let token;
                let param = {
                    accept:'application/zip'
                };
                // dicomdir:true
                console.log("url",this.service.getDicomURL(mode, this.studyWebService.selectedWebService));
                let url = this.service.studyURL(object.attrs, this.studyWebService.selectedWebService);
                let fileName = this.service.studyFileName(object.attrs);
                if(_.hasIn(ok,"schema_model.compressed") && _.get(ok,"schema_model.compressed")){
                    param.accept += ';transfer-syntax=*';
                }
                if(_.hasIn(ok,"schema_model.includingdicomdir") && _.get(ok,"schema_model.includingdicomdir")) {
                    param["dicomdir"] = true;
                }
                if(level === 'series'){
                    url = this.service.seriesURL(object.attrs, this.studyWebService.selectedWebService);
                    fileName = this.service.seriesFileName(object.attrs);
                }
                this.service.getTokenService(this.studyWebService).subscribe((response)=>{
                    if(!this.appService.global.notSecure){
                        token = response.token;
                    }
                    if(!this.appService.global.notSecure){
                        j4care.downloadFile(`${url}?${j4care.objToUrlParams(param)}&access_token=${token}`,`${fileName}.zip`)
                    }else{
                        j4care.downloadFile(`${url}?${j4care.objToUrlParams(param)}`,`${fileName}.zip`)
                    }
                });
            }
        });
    };
    downloadURL(inst, transferSyntax?:string) {
        let token;
        let url:string = "";
        let fileName = "dcm4che.dcm";
        this.confirm({
            content: $localize `:@@download_this_leveltext:Download this ${this.service.getLevelText("instance")}:@@levelText:`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@compress:Compress`
                        },
                        {
                            tag:"checkbox",
                            filterKey:"compressed"
                        }
                    ],
                    [
                        {
                            tag:"label",
                            text:$localize `:@@including_dicomdir:Include DICOMDIR`
                        },
                        {
                            tag:"checkbox",
                            filterKey:"includingdicomdir"
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@download:Download`
        }).subscribe((ok)=>{
            if(ok) {
                this.service.getTokenService(this.studyWebService).subscribe((response) => {
                    if (!this.appService.global.notSecure) {
                        token = response.token;
                    }
                    var includeDicomDir = _.hasIn(ok,"schema_model.includingdicomdir") && _.get(ok,"schema_model.includingdicomdir");
                    let exQueryParams = includeDicomDir === true
                                            ? {accept: 'application/zip'}
                                            : {contentType: 'application/dicom'};
                    var compressed = _.hasIn(ok,"schema_model.compressed") && _.get(ok,"schema_model.compressed");
                    console.log("keys", Object.keys(inst.wadoQueryParams));
                    console.log("keys", Object.getOwnPropertyNames(inst.wadoQueryParams));
                    console.log("keys", inst.wadoQueryParams);
                    if(includeDicomDir === true){
                        exQueryParams["dicomdir"] = true;
                        if(compressed === true)
                            exQueryParams.accept += ';transfer-syntax=*';
                        url = this.service.instanceURL(inst.attrs, this.studyWebService.selectedWebService);
                        fileName = this.service.instanceFileName(inst.attrs);
                        this.service.getTokenService(this.studyWebService).subscribe((response)=>{
                            if(!this.appService.global.notSecure){
                                token = response.token;
                            }
                            if(!this.appService.global.notSecure){
                                j4care.downloadFile(`${url}?${j4care.objToUrlParams(exQueryParams)}&access_token=${token}`,`${fileName}.zip`)
                            }else{
                                j4care.downloadFile(`${url}?${j4care.objToUrlParams(exQueryParams)}`,`${fileName}.zip`)
                            }
                        });
                    } else {
                        if(compressed === true)
                            exQueryParams["transferSyntax"] = transferSyntax;
                        this.service.wadoURL(this.studyWebService, inst.wadoQueryParams, exQueryParams).subscribe((urlWebApp: string) => {
                            if (!this.appService.global.notSecure) {
                                // WindowRefService.nativeWindow.open(this.wadoURL(inst.wadoQueryParams, exQueryParams) + `&access_token=${token}`);
                                url = urlWebApp + `&access_token=${token}`;
                            } else {
                                // WindowRefService.nativeWindow.open(this.service.wadoURL(this.studyWebService.selectedWebService, inst.wadoQueryParams, exQueryParams));
                                url = urlWebApp;
                            }
                            if (j4care.hasSet(inst, "attrs[00080018].Value[0]")) {
                                fileName = `${_.get(inst, "attrs[00080018].Value[0]")}.dcm`
                            }
                            j4care.downloadFile(url, fileName);
                        })
                    }
                });
            }
        });
    };

    createQueryParams(offset, limit, filter) {
        let params = {
            offset: offset,
            limit: limit
        };
/*        if(this._filter.filterModel["allAttributes"]){
            params["includefield"] = 'all';
        }
        delete this._filter.filterModel["allAttributes"];*/

        for (let key in filter){
            if ((filter[key] || filter[key] === false) && key != "allAttributes" && key != "webApp"){
                params[key] = filter[key];
            }
        }
        return params;
    }
    createStudyFilterParams(withoutPagination?:boolean, withoutDefaultQueryStudyParam?:boolean, leaveSPSparamters?:boolean) {
        let filter = this.getFilterClone();
        if(!leaveSPSparamters){
            delete filter['ScheduledProcedureStepSequence.ScheduledProcedureStepStartDate'];
            delete filter['ScheduledProcedureStepSequence.ScheduledProcedureStepStartTime'];
        }
        if(withoutPagination){
            delete filter["offset"];
        }
        if(withoutDefaultQueryStudyParam){
            delete filter["orderby"];
            delete filter["includefield"];
            delete filter["limit"];
        }
        return filter;
    }
    createPatientFilterParams(withoutPagination?:boolean) {
        let filter = this.getFilterClone();
        if(withoutPagination) {
            delete filter["offset"];
            delete filter["orderby"];
            delete filter["limit"];
            delete filter["includefield"];
        }
        return filter;
    }
    onSubPaginationClick(e){
        console.log("e",e);
        if(e.level === "instance"){
            console.log("e.object",e.object);
            if(e.direction === "next"){
                this.getInstances(e.object,e.object.instances[0].offset * 1 + this._filter.filterModel.limit * 1);
            }
            if(e.direction === "prev"){
                this.getInstances(e.object,e.object.instances[0].offset - this._filter.filterModel.limit);
            }

        }
        if(e.level === "series"){
            console.log("e.object",e.object);
            if(e.direction === "next"){
                this.getSeriesOfStudy(e.object,e.object.series[0].offset * 1 + this._filter.filterModel.limit * 1);
            }
            if(e.direction === "prev"){
                this.getSeriesOfStudy(e.object,e.object.series[0].offset - this._filter.filterModel.limit);
            }

        }
        if(e.level === "study"){
            console.log("e.object",e.object);
            let filterModel =  this.getFilterClone();
            if(filterModel.limit){
                filterModel.limit++;
            }
            if(e.direction === "next"){
                this.getAllStudiesToPatient(e.object,filterModel, e.object.studies[0].offset * 1 + this._filter.filterModel.limit * 1);
            }
            if(e.direction === "prev"){
                this.getAllStudiesToPatient(e.object,filterModel, e.object.studies[0].offset - this._filter.filterModel.limit);
            }

        }
    }

    getFilterClone():any{
        let filterModel =  _.clone(this._filter.filterModel);
        // if(!filterModel["allAttributes"]){
        //     filterModel["includefield"] = 'all';
        // }
        // delete filterModel["allAttributes"];
        delete filterModel.webApp;
        return filterModel;
    }

    search(mode:('next'|'prev'|'current'), e){
        console.log("e",e);
        console.log("this",this.filter);
        let filterModel =  this.getFilterClone();
        if(this.studyWebService.selectedWebService || (this.studyConfig.tab === "diff" && _.hasIn(filterModel, "batchID"))){

            if(filterModel.limit){
                filterModel.limit++;
            }
            if(e.id === "submit"){
                if(!mode || mode === "current"){
                    filterModel.offset = 0;
                    this.submit(filterModel);
                }else{
                    if(mode === "next" && this.more){
                        filterModel.offset = filterModel.offset * 1 + this._filter.filterModel.limit * 1;
                        this.submit(filterModel);
                    }
                    if(mode === "prev" && filterModel.offset > 0){
                        filterModel.offset = filterModel.offset - this._filter.filterModel.limit;
                        this.submit(filterModel);
                    }
                }
            }
            if(e.id === "count"){
                console.log("filter",this._filter.filterSchemaMain);
                this.getQuantity("count")
            }
            if(e.id === "size"){
                console.log("filter",this._filter.filterSchemaMain);
                this.getQuantity("size")
            }
            if(e.id === "show_diff"){
                //
            }
/*            if(e.id === "trigger_diff"){
/!*                filterModel.offset = filterModel.offset - this._filter.filterModel.limit;
                this.submit(filterModel);*!/
            }*/
    /*        }else{
                this.appService.showError("Calling AET is missing!");
            }*/
        }else{
            this.appService.showError($localize `:@@study.no_webapp_selected:No Web Application Service was selected!`);
        }
    }
    submit(filterModel){
        if (this.showNoFilterWarning(filterModel)) {
            this.confirm({
                content: $localize `:@@no_filter_set_warning:No filter are set, are you sure you want to continue?`
            }).subscribe(result => {
                if (result){
                    this.triggerQueries(filterModel);
                }
            });
        }else{
            this.triggerQueries(filterModel);
        }

    }
    triggerQueries(filterModel){
        switch (this.studyConfig.tab){
            case "study":
                this.getStudies(filterModel);
                break;
            case "patient":
                this.getPatients(filterModel);
                break;
            case "series":
                this.getSeries(filterModel);
                break;
            case "mwl":
                this.getMWL(filterModel);
                break;
            case "mpps":
                this.getMPPS(filterModel);
                break;
            case "uwl":
                this.getUWL(filterModel);
                break;
            case "diff":
                this.getDiff(filterModel);
                break;
        }
    };
    getDiff(filterModel){
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
/*        let filter = Object.assign({},params);
        filter['offset'] = offset ? offset:0;
        filter['limit'] = this.limit + 1;
        let mode = 'pk';
        this.cfpLoadingBar.start();
        if(this.taskPK != ''){
            filter['pk'] = this.taskPK;
        }else{
            mode = 'batch';
            filter['batchID'] = this.batchID;
        }*/
        delete filterModel.orderby;

        if(_.hasIn(filterModel,"taskID") || (_.hasIn(filterModel,"batchID") && !this.studyWebService.selectedWebService)){
            this.service.getDiff(filterModel,this.studyWebService).subscribe(res=>{
                console.log("res",res);
                this.cfpLoadingBar.complete();
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
                /*            this.morePatients = undefined;
                            this.moreDiffs = undefined;
                            this.moreStudies = undefined;*/

                if (_.size(res) > 0) {
                    // this.moreDiffs = res.length > this.limit;
                    this.prepareDiffData(res, filterModel.offset);
                }else{
                    this.appService.showMsg($localize `:@@no_diff_res:No Diff Results found!`);
                }
            },err=>{
                this.patients = [];
                this.httpErrorHandler.handleError(err);
                this.cfpLoadingBar.complete();
            });
        }else{
            this.service.triggerDiff(filterModel, this.studyWebService,"study", "object").subscribe(res=>{
                this.cfpLoadingBar.complete();
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
                /*            this.morePatients = undefined;
                            this.moreDiffs = undefined;
                            this.moreStudies = undefined;*/

                if (_.size(res) > 0) {
                    // this.moreDiffs = res.length > this.limit;
                    this.prepareDiffData(res, filterModel.offset);
                }else{
                    if(_.hasIn(filterModel,"queue") && filterModel.queue === true){
                        this.appService.showMsg($localize `:@@diff-pro.diff_triggered_successfully:Diff triggered successfully!`);
                    }else{
                        this.appService.showMsg($localize `:@@no_diff_res:No Diff Results found!`);
                    }
                }
            },err=>{
                this.cfpLoadingBar.complete();
                this.patients = [];
                this.httpErrorHandler.handleError(err);
            })
        }
    }

/*    getDiffTaskResults(params,offset?){
/!*        let filter = Object.assign({},params);
        filter['offset'] = offset ? offset:0;
        filter['limit'] = this.limit + 1;
        let mode = 'pk';
        this.cfpLoadingBar.start();
        if(this.taskPK != ''){
            filter['pk'] = this.taskPK;
        }else{
            mode = 'batch';
            filter['batchID'] = this.batchID;
        }*!/
        this.service.gitDiffTaskResults(filter,mode).subscribe(res=>{
            console.log("res",res);
            this.patients = [];
/!*            this.morePatients = undefined;
            this.moreDiffs = undefined;
            this.moreStudies = undefined;*!/

            if (_.size(res) > 0) {
                // this.moreDiffs = res.length > this.limit;
                this.prepareDiffData(res, offset);
            }else{
                this.appService.setMessage({
                    'title': 'Info',
                    'text': 'No Diff Results found!',
                    'status': 'info'
                });
            }
            this.cfpLoadingBar.complete();
        },err=>{
            this.patients = [];
            this.httpErrorHandler.handleError(err);
            this.cfpLoadingBar.complete();
        });
    }*/

    prepareDiffData(res, offset){
        let haederCodes = [
            "00200010",
            "0020000D",
            "00080020",
            "00080030",
            "00080090",
            "00080050",
            "00080061",
            "00081030",
            "00201206",
            "00201208"
        ];
        let index = 0;
        while (this.patientAttributes.dcmTag[index] && (this.patientAttributes.dcmTag[index] < '00201200')) {
            index++;
        }
        this.patientAttributes.dcmTag.splice(index, 0, '00201200');
        let patient: PatientDicom;
        let diff, patAttrs, tags = this.patientAttributes.dcmTag;
        console.log('res', res);
        res.forEach((studyAttrs, index)=> {
            patAttrs = {};
            this.service.extractAttrs(studyAttrs, tags, patAttrs);
            if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) { //angular.equals replaced with Rx.helpers.defaultComparer
                patient = new PatientDicom(
                    patAttrs,
                    [],
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    [],
                    true
                );
                this.patients.push(patient);
            }
            let showBorder = false;
            let diffHeaders = {};
            _.forEach(haederCodes,(m)=>{
                diffHeaders[m] = this.service.getDiffHeader(studyAttrs,m);
            });
            diff = new DiffDicom(
                studyAttrs,
                patient,
                this._filter.filterModel.offset + index,
                diffHeaders
            );
            console.log("diffHeaders",diffHeaders);
/*            study = {
                patient: pat,
                offset: offset + index,
                moreSeries: false,
                attrs: studyAttrs,
                series: null,
                showAttributes: false,
                fromAllStudies: false,
                selected: false,
                showBorder:false,
                diffHeaders:diffHeaders
            };*/
            patient.diffs.push(diff);
            // this.extendedFilter(false);
        });
        if (this.more = (res.length > this._filter.filterModel.limit)) {
            patient.diffs.pop();
            if (patient.diffs.length === 0) {
                this.patients.pop();
            }
            // this.studies.pop();
        }
    }

    showNoFilterWarning(queryParameters){
        let param =  _.clone(queryParameters);
        // if (param['orderby'] == '-StudyDate,-StudyTime'){
            if (_.hasIn(param, ['ScheduledProcedureStepSequence.ScheduledProcedureStepStartDate'])){
                delete param['ScheduledProcedureStepSequence.ScheduledProcedureStepStartDate'];
            }
            if (_.hasIn(param, 'includefield')){
                delete param['includefield'];
            }
            if (_.hasIn(param, 'limit')){
                delete param['limit'];
            }
            if (_.hasIn(param, 'offset')){
                delete param['offset'];
            }
            if (_.hasIn(param, 'orderby')){
                delete param['orderby'];
            }
            if(_.size(param) < 1){
                return true
            }else{
                for(let p in param){
                    if(param[p] == "")
                        delete param[p];
                }
            }
            return (_.size(param) < 1) ? true : false;
/*        }else{
            return false;
        }*/
    }
    getQuantity(quantity:Quantity){
        let filterModel =  this.getFilterClone();
        if (this.showNoFilterWarning(filterModel)) {
            this.confirm({
                content: $localize `:@@no_filter_set_warning:No filter are set, are you sure you want to continue?`
            }).subscribe(result => {
                if (result){
                    this.getQuantityService(filterModel, quantity);
                }
            });
        }else{
            this.getQuantityService(filterModel, quantity);
        }
    }
    getQuantityService(filterModel, quantity:Quantity){
        // let clonedFilters = _.cloneDeep(filters);
        //this.studyConfig.tab
        delete filterModel.orderby;
        delete filterModel.limit;
        delete filterModel.offset;
        let quantityText = quantity === "count" ? $localize `:@@COUNT:COUNT`: $localize `:@@SIZE:SIZE`;

        _.set(this._filter.filterSchemaMain.schema,[...(this.filterButtonPath[quantity] || []),...["quantityText"]], false);
        _.set(this._filter.filterSchemaMain.schema,[...(this.filterButtonPath[quantity] || []),...["text"]], quantityText);
        _.set(this._filter.filterSchemaMain.schema,[...(this.filterButtonPath[quantity] || []),...["showDynamicLoader"]], true);
        this.getService(filterModel, <DicomResponseType>quantity).subscribe(studyCount=>{
            console.log("studyCount",studyCount);
            let value = studyCount[quantity];
            if(quantity === "size"){
                value = j4care.convertBtoHumanReadable(value,1);
            }
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["showRefreshIcon"]], false);
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["showDynamicLoader"]], false);
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["text"]], `( ${this.largeIntFormat.transform(value)} ) ${quantityText}`);
        },err=>{
            j4care.log("Something went wrong on search", err);
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["showRefreshIcon"]], true);
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["showDynamicLoader"]], false);
            _.set(this._filter.filterSchemaMain.schema,[...this.filterButtonPath[quantity],...["text"]], quantityText);
            this.httpErrorHandler.handleError(err);
        })
    }
    getService(filterModel, quantity){
        switch (this.studyConfig.tab) {
            case "uwl":
                return this.service.getUWL(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
            case "mwl":
                return this.service.getMWL(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
            case "mpps":
                return this.service.getMPPS(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
            case "patient":
                return this.service.getPatients(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
            case "series":
                return this.service.getSeries(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
            default:
                return this.service.getStudies(filterModel, this.studyWebService.selectedWebService, <DicomResponseType>quantity);
        }
    }
    getMWL(filterModel){
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
        if(this.studyConfig.tab === "mwl" && !_.hasIn(filterModel,"includefield")){
            filterModel["includefield"] = "all";
        }
        this.service.getMWL(filterModel,this.studyWebService.selectedWebService).subscribe((res) => {
                this.patients = [];
                //           this.studies = [];
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
/*                this.morePatients = undefined;
                this.moreMWL = undefined;*/
                if (res){
                    this.setTopToTableHeader();
                    // let pat, mwl, patAttrs, tags = this.patientAttributes.dcmTag;
                    let patient: PatientDicom;
                    let mwl: MwlDicom;
                    let patAttrs;
                    let tags = this.patientAttributes.dcmTag;
                    res.forEach((mwlAttrs, index) => {
                        patAttrs = {};
                        this.service.extractAttrs(mwlAttrs, tags, patAttrs);
                        if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) {
                            patient = new PatientDicom(patAttrs, [], false, true, 0, [], true);
                            this.patients.push(patient);
                        }
                        mwl = new MwlDicom(
                            mwlAttrs,
                            patient,
                            this._filter.filterModel.offset + index
                        );
                        patient.mwls.push(mwl);
                    });

                    if (this.more = (res.length > this._filter.filterModel.limit)) {
                        patient.mwls.pop();
                        if (patient.mwls.length === 0) {
                            this.patients.pop();
                        }
                        // this.studies.pop();
                    }
                    console.log("patient",this.patients);
                } else {
                    this.appService.showMsg($localize `:@@study.no_matching_mwl:No matching Modality Worklist Entries found!`);
                }
                this.cfpLoadingBar.complete();
            },
            (err) => {
                j4care.log("Something went wrong on search", err);
                this.cfpLoadingBar.complete();
                this.httpErrorHandler.handleError(err);
            }
        );
    };

    getMPPS(filterModel){
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
        if(this.studyConfig.tab === "mpps" && !_.hasIn(filterModel,"includefield")){
            filterModel["includefield"] = "all";
        }
        this.service.getMPPS(filterModel,this.studyWebService.selectedWebService).subscribe((res) => {
                this.patients = [];
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
                if (res){
                    this.setTopToTableHeader();
                    let patient: PatientDicom;
                    let mpps: MppsDicom;
                    let patAttrs;
                    let tags = this.patientAttributes.dcmTag;
                    res.forEach((mppsAttrs, index) => {
                        patAttrs = {};
                        this.service.extractAttrs(mppsAttrs, tags, patAttrs);
                        if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) {
                            patient = new PatientDicom(patAttrs, [], false, true, 0,
                                undefined, false, undefined, false, undefined, false,
                                [], true);
                            this.patients.push(patient);
                        }
                        mpps = new MppsDicom(
                            mppsAttrs,
                            patient,
                            this._filter.filterModel.offset + index
                        );
                        patient.mpps.push(mpps);
                    });

                    if (this.more = (res.length > this._filter.filterModel.limit)) {
                        patient.mpps.pop();
                        if (patient.mpps.length === 0) {
                            this.patients.pop();
                        }
                    }
                    console.log("patient",this.patients);
                } else {
                    this.appService.showMsg($localize `:@@study.no_matching_mpps:No matching Modality Performed Procedure Step entries found!`);
                }
                this.cfpLoadingBar.complete();
            },
            (err) => {
                j4care.log("Something went wrong on search", err);
                this.cfpLoadingBar.complete();
                this.httpErrorHandler.handleError(err);
            }
        );
    };

    getUWL(filterModel){
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
        if(this.studyConfig.tab === "uwl" && !_.hasIn(filterModel,"includefield")){
            filterModel["includefield"] = "all";
        }
        this.service.getUWL(filterModel,this.studyWebService.selectedWebService).subscribe((res) => {
                this.patients = [];
                //           this.studies = [];
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
/*                this.morePatients = undefined;
                this.moreMWL = undefined;*/
                if (res){
                    this.setTopToTableHeader();
                    // let pat, mwl, patAttrs, tags = this.patientAttributes.dcmTag;
                    let patient: PatientDicom;
                    let uwl: UwlDicom;
                    let patAttrs;
                    let tags = this.patientAttributes.dcmTag;
                    res.forEach((uwlAttrs, index) => {
                        patAttrs = {};
                        this.service.extractAttrs(uwlAttrs, tags, patAttrs);
                        if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) {
                            patient = new PatientDicom(patAttrs, [], false, false, 0, undefined, false,undefined, undefined, [], true);
                            this.patients.push(patient);
                        }
                        uwl = new UwlDicom(
                            uwlAttrs,
                            patient,
                            this._filter.filterModel.offset + index
                        );
                        patient.uwls.push(uwl);
                    });

                    if (this.more = (res.length > this._filter.filterModel.limit)) {
                        patient.uwls.pop();
                        if (patient.uwls.length === 0) {
                            this.patients.pop();
                        }
                        // this.studies.pop();
                    }
                    console.log("patient",this.patients);
                } else {
                    this.appService.showMsg($localize `:@@study.no_matching_uwl:No matching Unified Worklist Entries found!`);
                }
                this.cfpLoadingBar.complete();
            },
            (err) => {
                j4care.log("Something went wrong on search", err);
                this.cfpLoadingBar.complete();
                this.httpErrorHandler.handleError(err);
            }
        );
    };
    getPatients(filterModel){
        this.cfpLoadingBar.start();
        if(this.studyConfig.tab === "patient" && !_.hasIn(filterModel,"includefield")){
            filterModel["includefield"] = "all";
        }
        this.service.getPatients(filterModel,this.studyWebService.selectedWebService).subscribe((res) => {
            this.patients = [];
            this._filter.filterModel.offset = filterModel.offset;
            if (_.size(res) > 0){
                this.setTopToTableHeader();
                this.patients = res.map((attrs, index) => {
                    return new PatientDicom(attrs, [], false, false, filterModel.offset + index);
                });
                if (this.more = (this.patients.length > this._filter.filterModel.limit)) {
                    this.patients.pop();
                }
            } else {
                this.appService.showMsg($localize `:@@study.no_patients_found:No matching Patients found!`);
            }
            this.cfpLoadingBar.complete();
        },(err)=>{
            j4care.log("Something went wrong on search", err);
            this.cfpLoadingBar.complete();
            this.httpErrorHandler.handleError(err);
        });
    }
    getAllStudiesToPatient(patient, filterModel, offset) {
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";

        if (offset < 0) offset = 0;
        filterModel["offset"] = offset;
        
        filterModel["PatientID"] = (<string>_.get(patient.attrs, "['00100020'].Value[0]"));
        filterModel["IssuerOfPatientID"] = (<string>_.get(patient.attrs, "['00100021'].Value[0]"));
        filterModel["IssuerOfPatientIDQualifiersSequence.UniversalEntityID"] = (<string>_.get(patient.attrs, "['00100024'].Value[0]['00400032'].Value[0]"));
        filterModel["IssuerOfPatientIDQualifiersSequence.UniversalEntityIDType"] = (_.get(patient.attrs, "['00100024'].Value[0]['00400033'].Value[0]"));
        this.service.getStudies(filterModel, this.studyWebService.selectedWebService)
            .subscribe((res) => {
                if (res && res.length > 0){
                    let hasMore = res.length > this._filter.filterModel.limit;
                    patient.studies = res.map((studyAttrs, index) => {
                        return new StudyDicom(
                            studyAttrs,
                            patient,
                            offset*1 + index,
                            hasMore,
                            hasMore || offset > 0
                        );
                    });
                    patient.showStudies = true;
                    if(hasMore){
                        patient.studies.pop();
                    }
                }else{
                    this.appService.showMsg($localize `:@@study.no_studies:No matching Studies found!`);
                }
                this.cfpLoadingBar.complete();
            },(err)=>{
                this.cfpLoadingBar.complete();
                this.httpErrorHandler.handleError(err);
            });
    };
    getStudies(filterModel){
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
        this.service.getStudies(filterModel, this.studyWebService.selectedWebService)
            .subscribe(res => {
                this.patients = [];
                this._filter.filterModel.offset = filterModel.offset;
                if(res){
                    this.setTopToTableHeader();
                    let index = 0;
                    let patient: PatientDicom;
                    let study: StudyDicom;
                    let patAttrs;
                    let tags = this.patientAttributes.dcmTag;

                    while (tags && (tags[index] < '00201200')) {
                        index++;
                    }
                    tags.splice(index, 0, '00201200');
                    tags.push('77770010', '77771010', '77771011', '77771012', '77771013', '77771014');

                    res.forEach((studyAttrs, index) => {
                        patAttrs = {};
                        this.service.extractAttrs(studyAttrs, tags, patAttrs);
                        if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) {
                            patient = new PatientDicom(patAttrs, [], false, true);
                            this.patients.push(patient);
                        }
                        study = new StudyDicom(
                            studyAttrs,
                            patient,
                            this._filter.filterModel.offset*1 + index
                        );
                        patient.studies.push(study);
                    });
                    if (this.more = (this._filter.filterModel.limit && res.length > this._filter.filterModel.limit)) {
                        patient.studies.pop();
                        if (patient.studies.length === 0) {
                            this.patients.pop();
                        }
                        // this.studies.pop();
                    }
                }else{
                    this.appService.showMsg($localize `:@@no_studies_found:No Studies found!`);
                }
                this.cfpLoadingBar.complete();
            }, err => {
                j4care.log("Something went wrong on search", err);
                this.httpErrorHandler.handleError(err);
                this.cfpLoadingBar.complete();
            });
    }

    getSeries(filterModel){
        console.log("getSeriesCalled");
        this.cfpLoadingBar.start();
        this.searchCurrentList = "";
        this.service.getSeries(filterModel, this.studyWebService.selectedWebService)
            .subscribe(res => {
                this.patients1 = [];
                this.studies = [];
                this._filter.filterModel.offset = filterModel.offset;
                if(res){
                    this.setTopToTableHeader();
                    let index = 0;
                    let patient: Patient1Dicom;
                    let study: Study1Dicom;
                    let series: Series1Dicom;
                    let patAttrs;
                    let studyAttrs;
                    let tagsPatient = this.patientAttributes.dcmTag;
                    let tagsStudy = this.studyAttributes.dcmTag;

                    while (tagsPatient && (tagsPatient[index] < '00201200')) {
                        index++;
                    }
                    tagsPatient.splice(index, 0, '00201200');
                    tagsPatient.push('77770010', '77771010', '77771011', '77771012', '77771013', '77771014');

                    while (tagsStudy && (tagsStudy[index] < '00201206')) {
                        index++;
                    }
                    tagsStudy.splice(index, 0, '00201206');
                    tagsStudy.push('77770010', '77771020', '77771021', '77771022', '77771023', '77771024', '77771025', '77771026', '77771027', '77771028', '77771029', '7777102A', '7777102B', '7777102C');

                    res.forEach((seriesAttrs, index) => {
                        patAttrs = {};
                        studyAttrs = {};
                        this.service.extractAttrs(seriesAttrs, tagsPatient, patAttrs);
                        this.service.extractAttrs(seriesAttrs, tagsStudy, studyAttrs);
                        if (!(patient && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, patAttrs))) {
                            patient = new Patient1Dicom(patAttrs, [], false, true);
                            this.patients1.push(patient);
                        }

                        if (!(study && this.service.equalsIgnoreSpecificCharacterSet(patient.attrs, studyAttrs))) {
                            study = new Study1Dicom(studyAttrs, patient, 0,false, false,
                                [], false, false, false, true);
                            /*this.studies.push(study);*/
                            patient.studies.push(study);
                        }

                        series = new Series1Dicom(
                            seriesAttrs,
                            patient,
                            study,
                            this._filter.filterModel.offset*1 + index
                        );
                        study.series.push(series);
                    });
                    if (this.more = (this._filter.filterModel.limit && res.length > this._filter.filterModel.limit)) {
                        patient.studies.pop();
                        if (patient.studies.length === 0) {
                            this.patients.pop();
                        }

                        study.series.pop();
                        if (study.series.length === 0) {
                            this.studies.pop();
                        }
                        // this.studies.pop();
                    }
                    console.log("patient",this.patients1);
                }else{
                    this.appService.showMsg($localize `:@@no_series_found:No Series found!`);
                }
                this.cfpLoadingBar.complete();
            }, err => {
                j4care.log("Something went wrong on search", err);
                this.httpErrorHandler.handleError(err);
                this.cfpLoadingBar.complete();
            });
    }

    getSeriesOfStudy(study:StudyDicom, offset){
        console.log('in query sersies study=', study);
        this.cfpLoadingBar.start();
        let filters = this.getFilterClone();

        if (offset < 0) offset = 0;
        filters["offset"] = offset;

        if(filters.limit){
            filters.limit++;
        }
        delete filters.aet;
        filters["orderby"] = 'SeriesNumber';
        this.service.getSeriesOfStudy(study.attrs['0020000D'].Value[0], filters, this.studyWebService.selectedWebService)
            .subscribe((res)=>{
                if (res){
                    let hasMore = res.length > this._filter.filterModel.limit;
                    if (res.length === 0){
                        this.appService.showMsg($localize `:@@study.no_matching_series:No matching series found!`);
                        console.log('in reslength 0');
                    }else{

                        study.series = res.map((attrs, index) =>{
                            return new SeriesDicom(
                                study,
                                attrs,
                                offset*1 + index,
                                hasMore,
                                hasMore || offset > 0
                            );
                        });
                        if (hasMore) {
                            study.series.pop();
                        }
                        console.log("study",study);
                        console.log("patients",this.patients);
                        // StudiesService.trim(this);
                        study.showSeries = true;
                    }
                }else{
                    this.appService.showMsg($localize `:@@study.no_matching_series:No matching series found!`);
                }
                this.cfpLoadingBar.complete();
            },(err)=>{
                j4care.log("Something went wrong on search", err);
                this.httpErrorHandler.handleError(err);
                this.cfpLoadingBar.complete();
            });
    }

    getInstances(series:SeriesDicom, offset){
        // console.log('in query Instances serie=', series);
        this.cfpLoadingBar.start();
        // if (series.offset < 0) series.offset = 0;
        if (offset < 0) offset = 0;
        // let callingAet = new Aet(this._filter.filterModel.aet);
        let filters = this.getFilterClone();
        if(filters.limit){
            filters.limit++;
        }
        filters["offset"] = offset;
        delete filters.aet;
        filters["orderby"] = 'InstanceNumber';
        this.service.getInstances(series.attrs['0020000D'].Value[0], series.attrs['0020000E'].Value[0], filters, this.studyWebService.selectedWebService)
            .subscribe((res)=>{
                if (res){
                    let hasMore = res.length > this._filter.filterModel.limit;
                    series.instances = res.map((attrs, index) => {
                        let numberOfFrames = j4care.valueOf(attrs['00280008']),
                            gspsQueryParams:GSPSQueryParams[] = this.service.createGSPSQueryParams(attrs),
                            video = this.service.isVideo(attrs),
                            image = this.service.isImage(attrs);
                        return new InstanceDicom(
                            series,
                            offset*1 + index,
                            attrs,
                            new WadoQueryParams(attrs['0020000D'].Value[0],attrs['0020000E'].Value[0], attrs['00080018'].Value[0]),
                            video,
                            image,
                            numberOfFrames,
                            gspsQueryParams,
                            this.service.createArray(video || numberOfFrames || gspsQueryParams.length || 1),
                            1,
                            this._filter.filterModel.limit || 20,
                            hasMore,
                            hasMore || offset > 0
                        )
                    });
                    if(hasMore){
                        series.instances.pop();
                    }
                    console.log(series);
                    console.log(this.patients);
                    series.showInstances = true;
                }else{
                    series.instances = [];
                    if (series.moreInstances = (series.instances.length > this._filter.filterModel.limit)) {
                        series.instances.pop();
                        this.appService.showMsg($localize `:@@study.no_matching_instances:No matching Instances found!`);
                    }
                }
                this.cfpLoadingBar.complete();
        },(err)=>{
                j4care.log("Something went wrong on search", err);
                this.httpErrorHandler.handleError(err);
                this.cfpLoadingBar.complete();
        });
    }
    entryFilterChanged(e?){
        console.log("e",e);
        console.log("this.studyWebService",this.studyWebService);
        // this.selectedWebAppService = _.get(this.filter,"filterModel.webApp");
/*        if(this.studyWebService.selectedDevice.dicomDeviceName != this.filter.filterEntryModel["device"] && this.filter.filterEntryModel["device"] && this.filter.filterEntryModel["device"] != ''){
            this.deviceConfigurator.getDevice(this.filter.filterEntryModel["device"]).subscribe(device=>{
                this.studyWebService.selectedDeviceObject = device;
                this._filter.filterSchemaEntry = this.service.getEntrySchema(this.studyWebService.devicesDropdown, this.studyWebService.getDcmWebAppServicesDropdown(["QIDO_RS"]));
            });
            this._filter.filterEntryModel["webService"] = undefined;
            this.studyWebService.dcmWebAppServices = undefined;
        }
        if(!this.selectedWebAppService || this.selectedWebAppService.dcmWebAppName != this.filter.filterEntryModel["webService"]){
            this.studyWebService.setSelectedWebAppByString(this.filter.filterEntryModel["webService"]);
        }*/
    }

    filterChanged(){
        if(this.studyWebService.selectedWebService != _.get(this.filter,"filterModel.webApp")){
            this.studyWebService.seletWebAppFromWebAppName(_.get(this.filter,"filterModel.webApp.dcmWebAppName"));
            this.internal = !(this.appService.archiveDeviceName && _.hasIn(this.studyWebService, "selectedWebService.dicomDeviceName") && this.studyWebService.selectedWebService.dicomDeviceName != this.appService.archiveDeviceName);
            if(!this.internal){
                delete this._filter.filterModel.includefield;
            }else{
                this._filter.filterModel.includefield = "all";
            }
            this.setMainSchema();
/*            this.moreFunctionConfig.options = this.moreFunctionConfig.options.filter(option=>{
                console.log("option",option);
                if(option.value === "retrieve_multiple"){
                    return !this.internal;
                }else{
                    return true;
                }
            });*/
            // console.log("test",test);
            this.setTrash();
            this.patients = [];
        }
        // this.tableParam.tableSchema  = this.service.PATIENT_STUDIES_TABLE_SCHEMA(this, this.actions, {trashActive:this.trash.active});
    }

    moreFunctionFilterPipe = (value, args) => {
        let internal = args[0];
        let studyConfig = args[1];
        return value.filter(option=>{
            console.log("option",option);
            if(option.value === "create_patient"
                || option.value === "supplement_issuer"
                || option.value === "update_charset"
                || option.value === "download_patients"){
                return studyConfig && studyConfig.tab === "patient"
                    && this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET")
            }else{
                 if(studyConfig && studyConfig.tab === "mwl"){
                     return (option.value === "import_matching_sps_to_archive"
                                    && !this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET"))
                                || (option.value === "change_sps_status_on_matching"
                                    && this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET"))
                                || (option.value === "download_mwl"
                                    && this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET"));
                 }else{
                    if(!(studyConfig && studyConfig.tab === "patient")){
                        if(studyConfig && studyConfig.tab === "uwl"){
                            return option.value === "create_ups";
                        }else{
                            switch (option.value) {
                                case "retrieve_multiple":
                                    return (!internal || this.service.webAppGroupHasClass(this.studyWebService,"MOVE_MATCHING")) && (studyConfig && studyConfig.tab === "study");
                                case "upload_dicom":
                                    return this.service.webAppGroupHasClass(this.studyWebService,"STOW_RS")
                                        && studyConfig && studyConfig.tab === "study";
                                case "trigger_diff":
                                    return studyConfig && studyConfig.tab === "diff";
                                case "export_multiple_study":
                                case "permanent_delete":
                                case "download_studies":
                                case "reject_multiple_study":
                                case "update_access_control_id_to_matching":
                                case "storage_verification_studies":
                                case "schedule_storage_commit_for_matching_studies":
                                case "instance_availability_notification_for_matching_studies":
                                    return studyConfig && studyConfig.tab === "study"
                                        && this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET");
                                case "export_multiple_series":
                                case "reject_multiple_series":
                                case "download_series":
                                case "storage_verification_series":
                                case "schedule_storage_commit_for_matching_series":
                                case "instance_availability_notification_for_matching_series":
                                    return studyConfig && studyConfig.tab === "series"
                                        && this.service.webAppGroupHasClass(this.studyWebService,"DCM4CHEE_ARC_AET");
                                case "change_sps_status_on_matching":
                                case "download_mwl":
                                case "import_matching_sps_to_archive":
                                case "create_ups":
                                    return false;
                            }
                        }
                        return true;
                    }else{
                        return false;
                    }
                }
            }
        });
    }

    actionsSelectionsFilterPipe(value, args){
        console.log("args",args);
        let internal = args[0];
        let trashActive = args[1];
        let studyConfig = args[2];
        return value.filter(option=>{
            if(option.value === "delete_object"){
                return internal && trashActive;
            }
            if(option.value === "restore_object"){
                return internal && trashActive;
            }
            if(option.value === "reject_object"){
                return !trashActive && studyConfig && (studyConfig.tab === "study" || studyConfig.tab === "series");
            }
            if(option.value === "update_access_control_id_to_selections" || option.value === "send_ian_request_for_selections"
                || option.value === "send_storage_commitment_request_for_selections" || option.value === "export_object"
                || option.value === "storage_verification_for_selections"){
                return studyConfig && (studyConfig.tab === "study" || studyConfig.tab === "series");
            }
            if(option.value === "change_sps_status_on_selections"){
                return studyConfig && studyConfig.tab === "mwl";
            }
            return true;
        });
    }

    setSchema(){
        try{
            this.synchronizeSelectedWebAppWithFilter();
            this._filter.filterSchemaMain.lineLength = undefined;
            this._filter.filterSchemaExpand.lineLength = undefined;
            this.setMainSchema();
            this._filter.filterSchemaExpand  = this.service.getFilterSchema(
                this.studyConfig.tab, this.applicationEntities.aes, this._filter.quantityText,
                'expand', this.storages);
        }catch (e) {
            j4care.log("Error on schema set",e);
        }
    }

    setMainSchema(){
        this._filter.filterSchemaMain  = this.service.getFilterSchema(
            this.studyConfig.tab,
            this.applicationEntities.aes,
            this._filter.quantityText,
            'main',
            this.storages,
            this.studyWebService,
            this.diffAttributeSets,
            _.hasIn(this.studyWebService,"selectedWebService.dcmWebServiceClass") && this.studyWebService.selectedWebService.dcmWebServiceClass.indexOf("QIDO_COUNT") > -1,
            this.filter
        );
        this.filterButtonPath.count = j4care.getPath(this._filter.filterSchemaMain.schema,"id", "count");
        this.filterButtonPath.size = j4care.getPath(this._filter.filterSchemaMain.schema,"id", "size");
        if(this.filterButtonPath.count){
            this.filterButtonPath.count.pop();
        }
        if(this.filterButtonPath.size){
            this.filterButtonPath.size.pop();
        }
    }
    synchronizeSelectedWebAppWithFilter(){
        if(this.studyWebService && this.studyWebService.selectedWebService && (!_.hasIn(this._filter.filterModel, "webApp") || this._filter.filterModel.webApp.dcmWebAppName != this.studyWebService.selectedWebService.dcmWebAppName)){
            this.filter.filterModel.webApp = this.studyWebService.selectedWebService;
        }
    }

    accessLocationChange(e){
        console.log("e",e.value);
        this.setSchema();
    }

    getPatientAttributeFilters(){
        this.service.getAttributeFilter().subscribe(patientAttributes=>{
            this.patientAttributes = patientAttributes;
        },err=>{
            j4care.log("Something went wrong on getting Patient Attributes",err);
            this.httpErrorHandler.handleError(err);
        });
    }

    getStudyAttributeFilters(){
        this.service.getAttributeFilter("Study").subscribe(studyAttributes=>{
            this.studyAttributes = studyAttributes;
        },err=>{
            j4care.log("Something went wrong on getting Study Attributes",err);
            this.httpErrorHandler.handleError(err);
        });
    }

/*    diffOptions:{
        aes:SelectDropdown<Aet>[],
        primaryAET?:any,
        secondaryAET?:any
    } = {
        aes:[],
    };*/
    getApplicationEntities(){
        // if(!this.applicationEntities.aetsAreSet){
/*            Observable.forkJoin(
                this.service.getAes().map(aes=> aes.map(aet=> new Aet(aet))),
                this.service.getAets().map(aets=> aets.map(aet => new Aet(aet))),
            )*/
            this.service.getAes()
            .subscribe((aes:Aet[])=>{
/*                [0,1].forEach(i=>{
                    res[i] = j4care.extendAetObjectWithAlias(res[i]);
                    ["external","internal"].forEach(location=>{
                      this.applicationEntities.aes[location] = this.permissionService.filterAetDependingOnUiConfig(res[i],location);
                      this.applicationEntities.aets[location] = this.permissionService.filterAetDependingOnUiConfig(res[i],location);
                      this.applicationEntities.aetsAreSet = true;
                    })
                });*/
                this.applicationEntities.aes = aes.map((ae:Aet)=>{
                    return new SelectDropdown(ae.dicomAETitle,ae.dicomAETitle,ae.dicomDescription,undefined,undefined,ae);
                });
                console.log("filter",this.filter);
                this.setSchema();
            },(err)=>{
                this.appService.showError($localize `:@@study.error_getting:_aets:Error getting AETs!`);
                j4care.log("error getting aets in Study page",err);
            });
/*        }else{
            this.setSchema();
        }*/
    }

    getDevices(){
        return new Observable((observer: Subscriber<any>) => {
            this.service.getDevices().subscribe(devices => {
                // this.getApplicationEntities();
                observer.next(devices);
            }, err => {
                observer.next([]);
            })
        });
    }

    createPatient(){
        let config:ModifyConfig = {
            saveLabel:$localize `:@@CREATE:CREATE`,
            titleLabel:$localize `:@@study.create_new_patient:Create new patient`
        };
        let newPatient: any = {
            'attrs': {
                '00100010': { 'vr': 'PN', 'Value': [{
                        Alphabetic: ''
                    }]},
                '00100020': { 'vr': 'LO', 'Value': ['']},
                '00100021': { 'vr': 'LO', 'Value': ['']},
                '00100030': { 'vr': 'DA', 'Value': ['']},
                '00100040': { 'vr': 'CS', 'Value': ['']}
            }
        };
        this.modifyPatient(newPatient, 'create', config);
    };

    supplementIssuer(){
        this.confirm({
            content: $localize`:@@supplement_new_issuer:Supplement new Issuer`,
            doNotSave: true,
            form_schema: [
                [
                    [
                        {
                            tag: "label",
                            text: $localize`:@@issuer_of_patient:Issuer of Patient`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "issuerOfPatient",
                            description: $localize`:@@issuer_of_patient:Issuer of Patient`,
                            placeholder: $localize`:@@issuer_of_patient:Issuer of Patient`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@test:Test`
                        },
                        {
                            tag: "checkbox",
                            filterKey: "testSupplement",
                            description:$localize `:@@supplement_issuer_test_only:Only test, without actually supplementing`,
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize`:@@SUPPLEMENT:SUPPLEMENT`
        }).subscribe((ok) => {
            if (ok) {
                this.cfpLoadingBar.start();
                this.service.supplementIssuer(ok.schema_model.issuerOfPatient,
                                ok.schema_model.testSupplement,
                                this.createPatientFilterParams(true),
                                this.studyWebService).subscribe(res => {
                    this.cfpLoadingBar.complete();
                    this.appService.showMsgSupplementIssuer(res);
                }, err => {
                    this.cfpLoadingBar.complete();
                    this.appService.showMsgSupplementIssuer(err.error);
                });

            }
        });
    }

    updateCharset(){
        this.confirm({
            content: $localize`:@@update_charset:Update Character Set of Patients`,
            doNotSave: true,
            form_schema: [
                [
                    [
                        {
                            tag: "label",
                            text: $localize`:@@charset:Character Set`
                        },
                        {
                            tag: "select",
                            options: [
                                {
                                    value: "ISO_IR 100",
                                    text: $localize`:@dicom_specific_char.latin_alphabet_no._1:Latin alphabet No. 1`,
                                    title: $localize`:@@dicom_specific_char.latin_alphabet_no._1_desc:Latin alphabet No. 1 (ISO_IR 100)`
                                },
                                {
                                    value: "ISO_IR 101",
                                    text: $localize`:@dicom_specific_char.latin_alphabet_no._2:Latin alphabet No. 2`,
                                    title: $localize`:@@dicom_specific_char.latin_alphabet_no._2_desc:Latin alphabet No. 2 (ISO_IR 101)`
                                },
                                {
                                    value: "ISO_IR 109",
                                    text: $localize`:@dicom_specific_char.latin_alphabet_no._3:Latin alphabet No. 3`,
                                    title: $localize`:@@dicom_specific_char.latin_alphabet_no._3_desc:Latin alphabet No. 3 (ISO_IR 109)`
                                },
                                {
                                    value: "ISO_IR 110",
                                    text: $localize`:@dicom_specific_char.latin_alphabet_no._4:Latin alphabet No. 4`,
                                    title: $localize`:@@dicom_specific_char.latin_alphabet_no._4_desc:Latin alphabet No. 4 (ISO_IR 110)`
                                },
                                {
                                    value: "ISO_IR 148",
                                    text: $localize`:@dicom_specific_char.latin_alphabet_no_5:Latin alphabet No. 5`,
                                    title: $localize`:@@dicom_specific_char.latin_alphabet_no_5_desc:Latin alphabet No. 5 (ISO_IR 1148)`
                                },
                                {
                                    value: "ISO_IR 127",
                                    text: $localize`:@dicom_specific_char.arabic:Arabic`,
                                    title: $localize`:@@dicom_specific_char.arabic_desc:Arabic (ISO_IR 127)`
                                },
                                {
                                    value: "ISO_IR 144",
                                    text: $localize`:@dicom_specific_char.cyrillic:Cyrillic`,
                                    title: $localize`:@@dicom_specific_char.cyrillic_desc:Cyrillic (ISO_IR 144)`
                                },
                                {
                                    value: "ISO_IR 126",
                                    text: $localize`:@dicom_specific_char.greek:Greek`,
                                    title: $localize`:@@dicom_specific_char.greek_desc:Greek (ISO_IR 126)`
                                },
                                {
                                    value: "ISO_IR 138",
                                    text: $localize`:@dicom_specific_char.hebrew:Hebrew`,
                                    title: $localize`:@@dicom_specific_char.hebrew_desc:Hebrew (ISO_IR 138)`
                                },
                                {
                                    value: "ISO_IR 13",
                                    text: $localize`:@dicom_specific_char.japanese:Japanese`,
                                    title: $localize`:@@dicom_specific_char.japanese_desc:Japanese (ISO_IR 13)`
                                },
                                {
                                    value: "ISO_IR 166",
                                    text: $localize`:@dicom_specific_char.thai:Thai`,
                                    title: $localize`:@@dicom_specific_char.thai_desc:Thai (ISO_IR 166)`
                                },
                                {
                                    value: "ISO_IR 192",
                                    text: $localize`:@dicom_specific_char.unicode:Unicode in UTF-8`,
                                    title: $localize`:@@dicom_specific_char.unicode_desc:Unicode in UTF-8 (ISO_IR 192)`
                                },
                                {
                                    value: "GB18030",
                                    text: $localize`:@dicom_specific_char.gb18030:GB18030`,
                                    title: $localize`:@@dicom_specific_char.gb18030_desc:GB18030 (GB18030)`
                                },
                                {
                                    value: "GBK",
                                    text: $localize`:@dicom_specific_char.gbk:GBK`,
                                    title: $localize`:@@dicom_specific_char.gbk_desc:GBK (GBK)`
                                }
                            ],
                            filterKey: "charset",
                            description: $localize`:@@charset:Character Set`,
                            placeholder: $localize`:@@charset:Character Set`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@test:Test`
                        },
                        {
                            tag: "checkbox",
                            filterKey: "testUpdateCharset",
                            description:$localize `:@@update_charset_test_only:Only test, without actually updating charset`,
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize`:@@UPDATE:UPDATE`
        }).subscribe((ok) => {
            if (ok) {
                this.cfpLoadingBar.start();
                this.service.updateCharset(ok.schema_model.charset,
                    ok.schema_model.testUpdateCharset,
                    this.createPatientFilterParams(true),
                    this.studyWebService).subscribe(res => {
                    this.cfpLoadingBar.complete();
                    this.appService.showMsgUpdateCharsets(res);
                }, err => {
                    this.cfpLoadingBar.complete();
                    this.appService.showMsgUpdateCharsets(err.error);
                });

            }
        });
    }

    createUPS(){
        this.modifyUPS(
            undefined,
            "create",
            {
                saveLabel: $localize `:@@CREATE:CREATE`,
                titleLabel: $localize `:@@create_new_ups:Create new UPS Workitem`
            },
            $localize `:@@ups_workitem_created_successfully:UPS Workitem created successfully at `
        )
    }
    cloneUPS(workitem){
        this.modifyUPS(
            workitem,
            "clone",
            {
                saveLabel: $localize `:@@CLONE:CLONE`,
                titleLabel: $localize `:@@clone_ups_workitem:Clone UPS Workitem`
            },
            $localize `:@@ups_workitem_cloned_successfully:UPS Workitem cloned successfully at `
        )
    }
    editUPS(workitem){
        this.modifyUPS(
            workitem,
            "edit",
            {
                saveLabel: $localize `:@@SAVE:SAVE`,
                titleLabel: $localize `:@@edit_ups_workitem:Edit UPS Workitem`
            },
            $localize `:@@ups_workitem_updated_successfully:UPS Workitem updated successfully`
        )
    }

    modifyUPS(workitem, mode:UPSModifyMode,config:ModifyConfig, msg:string){
        let originalWorkitemObject;
        this.service.getUPSIod(mode).subscribe(iod=>{
            if(mode === "edit" || mode === "clone"){
                originalWorkitemObject = _.cloneDeep(workitem);
                workitem.attrs = j4care.intersection(workitem.attrs,iod);
            }
            console.log("iod",iod);
            if(mode === "create" && !workitem){
                workitem = {
                    "attrs":{}
                };
                Object.keys(iod).forEach(dicomAttr=>{
                    if((iod[dicomAttr].required && iod[dicomAttr].required === 1) || dicomAttr === "00741202" || dicomAttr === "00404005"){
                        workitem["attrs"][dicomAttr] = _.cloneDeep(iod[dicomAttr]);
                    }
                });
                _.set(workitem.attrs, "00741000.Value[0]","SCHEDULED")
            }
            this.service.initEmptyValue(workitem.attrs);
            this.dialogRef = this.dialog.open(ModifyUpsComponent, {
                height: 'auto',
                width: '90%'
            });

            this.dialogRef.componentInstance.mode = mode;
            this.dialogRef.componentInstance.ups = workitem;
            this.dialogRef.componentInstance.dropdown = this.service.getArrayFromIod(iod);
            this.dialogRef.componentInstance.iod = this.service.replaceKeyInJson(iod, 'items', 'Value');
            this.dialogRef.componentInstance.saveLabel = config.saveLabel;
            this.dialogRef.componentInstance.titleLabel = config.titleLabel;
            this.dialogRef.afterClosed().subscribe(ok => {
                if (ok){
                    console.log("ok",ok);
                    j4care.removeKeyFromObject(workitem.attrs, ["required","enum", "multi"]);
                    let createUPS = (template?:boolean)=>{
                        let object = _.cloneDeep(workitem);
                        if(template){
                            if(_.hasIn(object,"attrs.00404005")){
                                delete object.attrs["00404005"];
                            }
                            msg = $localize `:@@ups_template_created_successfully:UPS template created successfully at `;
                        }
                        this.service.modifyUPS(undefined,object.attrs,this.studyWebService, msg, mode, template).subscribe(res=>{
                            this.appService.showMsg(msg);
                        }
                        // ,err=>{
                        //     if(!template){
                        //         workitem = undefined;
                        //     }
                        //     this.httpErrorHandler.handleError(err);
                        // }
                        );
                    };
                    if(ok.templateParameter && (ok.templateParameter === "no_template" || ok.templateParameter === "template_too")){
                        if(mode === "create" || mode === "clone"){
                            createUPS();
                        }else{
                            this.service.modifyUPS(this.service.getUpsWorkitemUID(originalWorkitemObject.attrs), workitem.attrs, this.studyWebService, msg, mode).subscribe(res=>{
                                this.appService.showMsg(msg);
                            }
                            // ,err=>{
                            //     _.assign(workitem, originalWorkitemObject);
                            //     this.httpErrorHandler.handleError(err);
                            // }
                            );
                        }
                        if(ok.templateParameter === "template_too"){
                            createUPS(true);
                        }
                    }else{
                        createUPS(true);
                    }
                }else{
                    _.assign(workitem, originalWorkitemObject);
                }
                this.dialogRef = null;
            });
        })
    }

    rescheduleUPS(workitem){
        this.confirm({
            content: $localize `:@@title.reschedule:Reschedule`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@uid_of_new_created_workitem:UID of new created Workitem`
                        },
                        {
                            tag:"input",
                            type:"text",
                            filterKey:"newWorkitem",
                            description:$localize `:@@uid_of_new_created_workitem:UID of new created Workitem`,
                            placeholder:$localize `:@@uid_of_new_created_workitem:UID of new created Workitem`
                        }
                    ],[
                        {
                            tag:"label",
                            text:$localize `:@@scheduled_procedure_step_start_date_time:Scheduled Procedure Step Start DateTime`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"upsScheduledTime",
                            description:$localize `:@@scheduled_procedure_step_start_date_time_00404005_as_in_created_ups:Scheduled Procedure Step Start DateTime (0040,4005) as in created UPS`,
                            placeholder:$localize `:@@scheduled_procedure_step_start_date_time:Scheduled Procedure Step Start DateTime`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@RESCHEDULE:RESCHEDULE`
        }).subscribe((ok)=> {
            if(ok){
                this.service.rescheduleUPS(this.service.getUpsWorkitemUID(workitem.attrs), this.studyWebService, ok.schema_model).subscribe(res => {
                    this.appService.showMsg($localize `:@@ups_workitem_rescheduled_successfully:UPS Workitem rescheduled successfully!`);
                }, err => {
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }

    cancelUPS(workitem){
        this.confirm({
            content: $localize `:@@request_cancellation_of_workitem:Request Cancellation of Workitem`,
            doNotSave:true,
            form_schema:[
                    [
                        [

                        {
                            tag:"label",
                            text:$localize `:@@aet_of_a_requester:AET of a Requester`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes,
                            filterKey:"requester",
                            description:$localize `:@@aet_of_a_requester:AET of a Requester`,
                            placeholder:$localize `:@@aet_of_a_requester:AET of a Requester`
                        }
                    ]
                        /*this.applicationEntities.aets*/
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@CANCEL_UPS:Cancel UPS`
        }).subscribe((ok)=> {
            if(ok){
                this.service.cancelUPS(this.service.getUpsWorkitemUID(workitem.attrs), this.studyWebService, ok.schema_model.requester).subscribe(res => {
                    this.appService.showMsg($localize `:@@cancellation_of_the_ups_workitem_was_requested_successfully:Cancellation of the UPS Workitem was requested successfully!`);
                }, err => {
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    editPatient(patient){
        let config:ModifyConfig = {
            saveLabel:$localize `:@@SAVE:SAVE`,
            titleLabel:$localize `:@@study.edit_patient:Edit patient`
        };
        config.titleLabel += ((_.hasIn(patient, 'attrs.00100010.Value.0.Alphabetic')) ? '<b>' + patient.attrs['00100010'].Value[0]['Alphabetic'] + '</b>' : ' ');
        config.titleLabel += ((_.hasIn(patient, 'attrs.00100020.Value.0')) ? ' with ID: <b>' + patient.attrs['00100020'].Value[0] + '</b>' : '');
        this.modifyPatient(patient, 'edit', config);
    };

    modifyPatient(patient, mode:("edit"|"create") , config?:{saveLabel:string,titleLabel:string}){
        let originalPatientObject;
        if(mode === "edit"){
            originalPatientObject = _.cloneDeep(patient);
        }
        this.lastPressedCode = 0;
        this.config.viewContainerRef = this.viewContainerRef;
        this.service.getPatientIod().subscribe((iod) => {
            this.service.initEmptyValue(patient.attrs);
            this.dialogRef = this.dialog.open(EditPatientComponent, {
                height: 'auto',
                width: '90%'
            });

            this.dialogRef.componentInstance.mode = mode;
            this.dialogRef.componentInstance.patient = patient;
            this.dialogRef.componentInstance.dropdown = this.service.getArrayFromIod(iod);
            this.dialogRef.componentInstance.iod = this.service.replaceKeyInJson(iod, 'items', 'Value');
            this.dialogRef.componentInstance.saveLabel = config.saveLabel;
            this.dialogRef.componentInstance.titleLabel = config.titleLabel;
            this.dialogRef.afterClosed().subscribe(result => {
                if (result){
                    if(mode === "create"){
                        this.service.modifyPatient(undefined,patient.attrs,this.studyWebService).subscribe(res=>{
                            this.appService.showMsg($localize `:@@study.patient_created_successfully:Patient created successfully`);
                        },err=>{
                            this.httpErrorHandler.handleError(err);
                        });
                    }else{
                        this.service.modifyPatient(this.service.getPatientId(originalPatientObject.attrs),patient.attrs,this.studyWebService).subscribe(res=>{
                            this.appService.showMsg($localize `:@@study.patient_updated_successfully:Patient updated successfully`);
                        },err=>{
                            _.assign(patient, originalPatientObject);
                            this.httpErrorHandler.handleError(err);
                        });
                    }
                }else{
                    _.assign(patient, originalPatientObject);
                }
                this.dialogRef = null;
            });
        }, (err) => {
            this.httpErrorHandler.handleError(err);
            console.log('error', err);
        });
    };

    updateAccessControlId(mode?:AccessControlIDMode, model?:any){
        const matching = mode === "update_access_control_id_to_matching";
        const innerText = matching ? $localize `:@@inner_text.of_matching_studies:of matching studies`: $localize `:@@inner_text.of_the_study: of the study`;
        this.confirm({
            content: $localize `:@@study.update_study_access_control_id_param:Update Study Access Control ID ${innerText}:@@innerText:`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@access_control_id:Access Control ID`
                        },
                        {
                            tag:"input",
                            type:"text",
                            filterKey:"accessControlID",
                            description:$localize `:@@access_control_id:Access Control ID`,
                            placeholder:$localize `:@@access_control_id:Access Control ID`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@UPDATE:UPDATE`
        }).subscribe((ok)=>{
            if(ok){
                let service;
                let msg;
                if(matching){
                    service = this.service.updateAccessControlId(mode, this.studyWebService.selectedWebService,ok.schema_model.accessControlID || 'null',undefined,this.createStudyFilterParams(true,true))
                    msg = $localize `:@@access_control_id_updated_matching:Access Control ID updated successfully to matching studies`;
                }else{
                    if(mode === "update_access_control_id_to_selections"){
                        service = this.service.updateAccessControlIdOfSelections(this.selectedElements,this.studyWebService.selectedWebService,ok.schema_model.accessControlID || 'null')
                        msg = $localize `:@@access_control_id_updated_selected:Access Control ID updated successfully to selected studies!`
                    }else{
                        service = this.service.updateAccessControlId(mode, this.studyWebService.selectedWebService,ok.schema_model.accessControlID || 'null',this.service.getStudyInstanceUID(model.attrs))
                        msg = $localize `:@@access_control_id_updated_the_study:Access Control ID updated successfully to the study!`
                    }
                }
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    if(matching){
                        msg = j4care.prepareCountMessage(msg, res);
                    }
                    this.appService.showMsg(msg);
                    if(mode === "update_access_control_id_to_selections"){
                        this.clearClipboard();
                    }
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }

    sendStorageCommitmentRequestSingle(dicomLevel?:DicomLevel, model?:any) {
        let dialogText;
        switch (dicomLevel){
            case "series":
                dialogText = $localize `:@@request_storage_commitment_of_series_from_external_storage_commitment_scp:Request Storage Commitment of Series from external Storage Commitment SCP`
                break;
            case "instance":
                dialogText = $localize `:@@request_storage_commitment_of_instance_from_external_storage_commitment_scp:Request Storage Commitment of Instance from external Storage Commitment SCP`
                break;
            default:
                dialogText = $localize `:@@request_storage_commitment_of_study_from_external_storage_commitment_scp:Request Storage Commitment of Study from external Storage Commitment SCP`
                break;
        }
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"stgCmtSCP",
                            description:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`,
                            placeholder:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.stgCmtSCP")){
                let service;
                let msg;
                if(dicomLevel){
                    switch (dicomLevel){
                        case "series":
                            msg = $localize `:@@storage_commitment_of_series_from_external_storage_commitment_scp_requested:Storage Commitment of Series from external Storage Commitment SCP was requested successfully`;
                            break;
                        case "instance":
                            msg = $localize `:@@storage_commitment_of_instance_from_external_storage_commitment_scp_requested:Storage Commitment of Instance from external Storage Commitment SCP was requested successfully`;
                            break;
                        default:
                            msg = $localize `:@@storage_commitment_of_study_from_external_storage_commitment_scp_requested:Storage Commitment of Study from external Storage Commitment SCP was requested successfully`;
                            break;
                    }
                    service = this.service.sendStorageCommitmentRequestForSingle(model.attrs,this.studyWebService,dicomLevel, ok.schema_model.stgCmtSCP);
                } else {
                    //Selected
                    msg = $localize `:@@storage_commitment_of_selected_objects_from_external_storage_commitment_scp_was_requested:Storage Commitment of selected objects from external Storage Commitment SCP was requested successfully`;
                    service = this.service.sendStorageCommitmentRequestForSelected(this.selectedElements,this.studyWebService,ok.schema_model.stgCmtSCP);
                }
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    this.appService.showMsg(msg);
                    if(!dicomLevel){
                        this.clearClipboard();
                    }
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    
    sendStorageCommitmentRequestMatchingStudies(){
        let dialogText = $localize `:@@schedule_storage_commitment_of_matching_studies_from_external_storage_commitment_scp:Schedule Storage Commitment of matching Studies from external Storage Commitment SCP`
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"stgCmtSCP",
                            description:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`,
                            placeholder:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@batch_ID:Batch ID`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "batchID",
                            description: $localize`:@@batch_ID:Batch ID`,
                            placeholder: $localize`:@@batch_ID:Batch ID`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@schedule_at:Schedule at`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"scheduledTime",
                            description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                        },
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.stgCmtSCP")){
                let stgCmtSCP = ok.schema_model.stgCmtSCP;
                delete ok.schema_model['stgCmtSCP'];
                let service = this.service.sendStorageCommitmentRequestForMatchingStudies(
                    this.studyWebService,
                    stgCmtSCP,
                    _.merge(ok.schema_model, this.createStudyFilterParams(true,true)));
                let msg = $localize `:@@storage_commitment_of_matching_studies_from_external_storage_commitment_scp_was_scheduled:Storage Commitment of matching Studies from external Storage Commitment SCP was scheduled successfully`;
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    msg = j4care.prepareCountMessage(msg, res);
                    this.appService.showMsg(msg);
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    sendStorageCommitmentRequestMatchingSeries(){
        let dialogText = $localize `:@@schedule_storage_commitment_of_matching_series_from_external_storage_commitment_scp:Schedule Storage Commitment of matching Series from external Storage Commitment SCP`
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@patient_verification_status:Patient Verification Status`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:[
                                new SelectDropdown("UNVERIFIED", $localize `:@@UNVERIFIED:UNVERIFIED`),
                                new SelectDropdown("VERIFIED", $localize `:@@VERIFIED:VERIFIED`),
                                new SelectDropdown("NOT_FOUND", $localize `:@@NOT_FOUND:NOT_FOUND`),
                                new SelectDropdown("VERIFICATION_FAILED", $localize `:@@VERIFICATION_FAILED:VERIFICATION_FAILED`)
                            ],
                            filterKey:"patientVerificationStatus",
                            description:$localize `:@@patient_verification_status:Patient Verification Status`,
                            placeholder:$localize `:@@status:Status`
                        }
                    ],[
                        {
                            tag: "label",
                            text: $localize`:@@all_of_modalities_in_study:All of Modalities in Study`
                        },
                            {
                                tag:"checkbox",
                                type:"text",
                                filterKey:"allOfModalitiesInStudy",
                                description:$localize `:@@all_of_modalities_in_study:All of Modalities in Study`
                            },
                        ],
                    [
                        {
                            tag:"label",
                            text:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"stgCmtSCP",
                            description:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`,
                            placeholder:$localize `:@@storage_commitment_scp_ae_title:Storage Commitment SCP AE Title`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@schedule_at:Schedule at`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"scheduledTime",
                            description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                        },
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@batch_ID:Batch ID`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "batchID",
                            description: $localize`:@@batch_ID:Batch ID`,
                            placeholder: $localize`:@@batch_ID:Batch ID`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.stgCmtSCP")){
                let stgCmtSCP = ok.schema_model.stgCmtSCP;
                delete ok.schema_model['stgCmtSCP'];
                let service = this.service.sendStorageCommitmentRequestForMatchingSeries(
                    this.studyWebService,
                    stgCmtSCP,
                    _.merge(ok.schema_model, this.createStudyFilterParams(true,true)));
                let msg = $localize `:@@storage_commitment_of_matching_series_from_external_storage_commitment_scp_was_scheduled:Storage Commitment of matching Series from external Storage Commitment SCP was scheduled successfully`;
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    msg = j4care.prepareCountMessage(msg, res);
                    this.appService.showMsg(msg);
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }

    sendInstanceAvailabilityNotificationSingle(dicomLevel?:DicomLevel, model?:any) {
        let dialogText;
        switch (dicomLevel){
            case "series":
                dialogText = $localize `:@@request_instance_availability_of_series_to_external_instance_availability_scp:Request Instance Availability of Series to external Instance Availability SCP`
                break;
            case "instance":
                dialogText = $localize `:@@request_instance_availability_of_instance_to_external_instance_availability_scp:Request Instance Availability of Instance to external Instance Availability SCP`
                break;
            default:
                dialogText = $localize `:@@request_instance_availability_of_study_to_external_instance_availability_scp:Request Instance Availability of Study to external Instance Availability SCP`
                break;
        }
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"ianscp",
                            description:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`,
                            placeholder:$localize `:@@instance_availability_notification_scp_ae_title:Instance Availability Notification SCP AE Title`
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.ianscp")){
                let service;
                let msg;
                if(dicomLevel){
                    switch (dicomLevel){
                        case "series":
                            msg = $localize `:@@instance_availability_of_series_to_external_instance_availability_scp_requested:Instance Availability of Series to external Instance Availability SCP was requested successfully`;
                            break;
                        case "instance":
                            msg = $localize `:@@instance_availability_of_instance_to_external_instance_availability_scp_requested:Instance Availability of Instance to external Instance Availability SCP was requested successfully`;
                            break;
                        default:
                            msg = $localize `:@@instance_availability_of_study_to_external_instance_availability_scp_requested:Instance Availability of Study to external Instance Availability SCP was requested successfully`;
                            break;
                    }
                    service = this.service.sendInstanceAvailabilityNotificationForSingle(model.attrs,this.studyWebService,dicomLevel, ok.schema_model.ianscp);
                }else{
                    //Selected
                    msg = $localize `:@@instance_availability_of_selected_objects_to_external_instance_availability_scp_was_requested:Instance Availability of selected objects to external Instance Availability SCP was requested successfully`;
                    service = this.service.sendInstanceAvailabilityNotificationForSelected(this.selectedElements,this.studyWebService,ok.schema_model.ianscp);
                }
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    this.appService.showMsg(msg);
                    if(!dicomLevel){
                        this.clearClipboard();
                    }
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }

    sendInstanceAvailabilityNotificationMatchingStudies(){
        let dialogText = $localize `:@@schedule_instance_availability_of_matching_studies_to_external_instance_availability_scp:Schedule Instance Availability of matching Studies to external Instance Availability SCP`
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"ianscp",
                            description:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`,
                            placeholder:$localize `:@@instance_availability_notification_scp_ae_title:Instance Availability Notification SCP AE Title`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@batch_ID:Batch ID`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "batchID",
                            description: $localize`:@@batch_ID:Batch ID`,
                            placeholder: $localize`:@@batch_ID:Batch ID`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@schedule_at:Schedule at`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"scheduledTime",
                            description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                        },
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.ianscp")){
                let ianscp = ok.schema_model.ianscp;
                delete ok.schema_model['ianscp'];
                let service = this.service.sendInstanceAvailabilityNotificationForMatchingStudies(
                    this.studyWebService,
                    ianscp,
                    _.merge(ok.schema_model, this.createStudyFilterParams(true,true)));
                let msg = $localize `:@@instance_availability_of_matching_studies_to_external_instance_availability_scp_was_scheduled:Instance Availability of matching Studies to external Instance Availability SCP was scheduled successfully`;
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    msg = j4care.prepareCountMessage(msg, res);
                    this.appService.showMsg(msg);
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }

    sendInstanceAvailabilityNotificationMatchingSeries(){
        let dialogText = $localize `:@@schedule_instance_availability_of_matching_series_to_external_instance_availability_scp:Schedule Instance Availability of matching Series to external Instance Availability SCP`
        console.log("archiveDevice",this.appService.archiveDeviceName);
        this.confirm({
            content: dialogText,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:this.applicationEntities.aes.filter(aes=>aes.wholeObject.dicomDeviceName != this.appService.archiveDeviceName),
                            filterKey:"ianscp",
                            description:$localize `:@@ian_scp_ae_title:IAN SCP AE Title`,
                            placeholder:$localize `:@@instance_availability_notification_scp_ae_title:Instance Availability Notification SCP AE Title`
                        }
                    ],
                    [
                        {
                            tag:"label",
                            text:$localize `:@@patient_verification_status:Patient Verification Status`
                        },
                            {
                                tag:"select",
                                type:"text",
                                options:[
                                    new SelectDropdown("UNVERIFIED", $localize `:@@UNVERIFIED:UNVERIFIED`),
                                    new SelectDropdown("VERIFIED", $localize `:@@VERIFIED:VERIFIED`),
                                    new SelectDropdown("NOT_FOUND", $localize `:@@NOT_FOUND:NOT_FOUND`),
                                    new SelectDropdown("VERIFICATION_FAILED", $localize `:@@VERIFICATION_FAILED:VERIFICATION_FAILED`)
                                ],
                                filterKey:"patientVerificationStatus",
                                description:$localize `:@@patient_verification_status:Patient Verification Status`,
                                placeholder:$localize `:@@status:Status`
                            }
                        ],[
                        {
                            tag: "label",
                            text: $localize`:@@all_of_modalities_in_study:All of Modalities in Study`
                        },
                        {
                            tag:"checkbox",
                            type:"text",
                            filterKey:"allOfModalitiesInStudy",
                            description:$localize `:@@all_of_modalities_in_study:All of Modalities in Study`
                        },
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@batch_ID:Batch ID`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "batchID",
                            description: $localize`:@@batch_ID:Batch ID`,
                            placeholder: $localize`:@@batch_ID:Batch ID`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@schedule_at:Schedule at`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"scheduledTime",
                            description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                        },
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@SEND:SEND`
        }).subscribe((ok)=>{
            if(ok && _.hasIn(ok, "schema_model.ianscp")){
                let ianscp = ok.schema_model.ianscp;
                delete ok.schema_model['ianscp'];
                let service = this.service.sendInstanceAvailabilityNotificationForMatchingSeries(
                    this.studyWebService,
                    ianscp,
                    _.merge(ok.schema_model, this.createStudyFilterParams(true,true)));
                let msg = $localize `:@@instance_availability_of_matching_series_to_external_instance_availability_scp_was_scheduled:Instance Availability of matching Series to external Instance Availability SCP was scheduled successfully`;
                this.cfpLoadingBar.start();
                service.subscribe(res=>{
                    this.cfpLoadingBar.complete();
                    msg = j4care.prepareCountMessage(msg, res);
                    this.appService.showMsg(msg);
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    editSeries(series){
        let config:{saveLabel:string,titleLabel:string} = {
            saveLabel:$localize `:@@SAVE:SAVE`,
            titleLabel:$localize `:@@study.edit_series:Edit series of study `
        };
        config.titleLabel += ((_.hasIn(series, 'attrs.0020000D.Value.0')) ? ' with IUID: <b>' + series.attrs['0020000D'].Value[0] + '</b>' : '');
        config.titleLabel += ((_.hasIn(series, 'attrs.00100010.Value.0.Alphabetic')) ? ' of patient <b>' + series.attrs['00100010'].Value[0]['Alphabetic'] + '</b>' : ' ');
        config.titleLabel += ((_.hasIn(series, 'attrs.00100020.Value.0')) ? ' with ID: <b>' + series.attrs['00100020'].Value[0] + '</b>' : '');
        this.modifySeries(series, 'edit', config);
    };
    modifySeries(series, mode, config?:{saveLabel:string,titleLabel:string}){
        let $this = this;
        this.config.viewContainerRef = this.viewContainerRef;
        let originalSeriesObject = _.cloneDeep(series);
        if (mode === 'edit'){
            _.forEach(series.attrs, function(value, index) {
                let checkValue = '';
                if (value.Value && value.Value.length){
                    checkValue = value.Value.join('');
                }
                if (!(value.Value && checkValue != '')){
                    delete series.attrs[index];
                }
            });
        }
        this.lastPressedCode = 0;
        this.service.getSeriesIod()
            .subscribe((res) => {
                let iod = $this.service.replaceKeyInJson(res, 'items', 'Value');
                let seriesFiltered = _.cloneDeep(series);
                seriesFiltered.attrs = new ComparewithiodPipe().transform(series.attrs, iod);
                $this.service.initEmptyValue(seriesFiltered.attrs);
                $this.dialogRef = $this.dialog.open(EditSeriesComponent, {
                    height: 'auto',
                    width: '90%'
                });
                $this.dialogRef.componentInstance.series = seriesFiltered;
                $this.dialogRef.componentInstance.dropdown = $this.service.getArrayFromIod(res);
                $this.dialogRef.componentInstance.iod = iod;
                $this.dialogRef.componentInstance.saveLabel = config.saveLabel;
                $this.dialogRef.componentInstance.titleLabel = config.titleLabel;
                $this.dialogRef.componentInstance.mode = mode;
                $this.dialogRef.afterClosed().subscribe(result => {
                    if (result){
                        $this.service.clearPatientObject(seriesFiltered.attrs);
                        $this.service.convertStringToNumber(seriesFiltered.attrs);
                        let local = {};
                        $this.service.appendPatientIdTo(series.attrs, local);
                        _.forEach(seriesFiltered.attrs, function(m, i){
                            if (res[i]){
                                local[i] = m;
                            }
                        });
                        this.service.modifySeries(local,
                            this.studyWebService,
                            new HttpHeaders({ 'Content-Type': 'application/dicom+json' }),
                            this.service.getStudyInstanceUID(series.attrs),
                            this.service.getSeriesInstanceUID(series.attrs)).subscribe(
                            () => {
                                $this.appService.showMsg($localize `:@@series_saved:Series saved successfully!`);
                            },
                            (err) => {
                                $this.httpErrorHandler.handleError(err);
                                _.assign(series, originalSeriesObject);
                            }
                        );
                    }else{
                        _.assign(series, originalSeriesObject);
                    }
                    $this.dialogRef = null;
                });
            });
    }
    editStudy(study){
        let config:{saveLabel:string,titleLabel:string} = {
            saveLabel:$localize `:@@SAVE:SAVE`,
            titleLabel:$localize `:@@study.edit_study:patient:Edit study of patient `
        };
        config.titleLabel += ((_.hasIn(study, 'attrs.00100010.Value.0.Alphabetic')) ? '<b>' + study.attrs['00100010'].Value[0]['Alphabetic'] + '</b>' : ' ');
        config.titleLabel += ((_.hasIn(study, 'attrs.00100020.Value.0')) ? ' with ID: <b>' + study.attrs['00100020'].Value[0] + '</b>' : '');
        this.modifyStudy(study, 'edit', config);
    };
    modifyStudy(study, mode, config?:{saveLabel:string,titleLabel:string}){
        let $this = this;
        this.config.viewContainerRef = this.viewContainerRef;
        let originalStudyObject = _.cloneDeep(study);
        if (mode === 'edit'){
            _.forEach(study.attrs, function(value, index) {
                let checkValue = '';
                if (value.Value && value.Value.length){
                    checkValue = value.Value.join('');
                }
                if (!(value.Value && checkValue != '')){
                    delete study.attrs[index];
                }
            });
        }
        this.lastPressedCode = 0;
        this.service.getStudyIod()
            .subscribe((res) => {
                let iod = $this.service.replaceKeyInJson(res, 'items', 'Value');
                let studyFiltered = _.cloneDeep(study);
                studyFiltered.attrs = new ComparewithiodPipe().transform(study.attrs, iod);
                $this.service.initEmptyValue(studyFiltered.attrs);
                $this.dialogRef = $this.dialog.open(EditStudyComponent, {
                    height: 'auto',
                    width: '90%'
                });
                $this.dialogRef.componentInstance.study = studyFiltered;
                $this.dialogRef.componentInstance.dropdown = $this.service.getArrayFromIod(res);
                $this.dialogRef.componentInstance.iod = iod;
                $this.dialogRef.componentInstance.saveLabel = config.saveLabel;
                $this.dialogRef.componentInstance.titleLabel = config.titleLabel;
                $this.dialogRef.componentInstance.mode = mode;
                $this.dialogRef.afterClosed().subscribe(result => {
                    if (result){
                        $this.service.clearPatientObject(studyFiltered.attrs);
                        $this.service.convertStringToNumber(studyFiltered.attrs);
                        let local = {};
                        $this.service.appendPatientIdTo(study.attrs, local);
                        _.forEach(studyFiltered.attrs, function(m, i){
                            if (res[i]){
                                local[i] = m;
                            }
                        });
                        this.service.modifyStudy(local,
                            this.studyWebService,
                            new HttpHeaders({ 'Content-Type': 'application/dicom+json' }),
                            this.service.getStudyInstanceUID(study.attrs)).subscribe(
                            () => {
                                $this.appService.showMsg($localize `:@@study_saved:Study saved successfully!`);
                            },
                            (err) => {
                                $this.httpErrorHandler.handleError(err);
                                _.assign(study, originalStudyObject);
                            }
                        );
                    }else{
                        _.assign(study, originalStudyObject);
                    }
                    $this.dialogRef = null;
                });
            });
    };

    setExpiredDate(study){
        this.setExpiredDateQuery(study,false);
    }

    setExpiredDateQuery(study, infinit){
        this.confirm(this.service.getPrepareParameterForExpiriationDialog(study,this.exporters, infinit)).subscribe(result => {
            if(result){
                this.cfpLoadingBar.start();
                if(result.schema_model.expiredDate){
                    this.service.setExpiredDate(this.studyWebService, _.get(study,"attrs.0020000D.Value[0]"), result.schema_model.expiredDate, result.schema_model.exporter).subscribe(
                        (res)=>{
                            _.set(study,"attrs.77771023.Value[0]",result.schema_model.expiredDate);
                            _.set(study,"attrs.77771023.vr","DA");
                            this.appService.showMsg( $localize `:@@expired_date_set:Expired date set successfully!`);
                            this.cfpLoadingBar.complete();
                        },
                        (err)=>{
                            this.httpErrorHandler.handleError(err);
                            this.cfpLoadingBar.complete();
                        }
                    );
                }else{
                    this.appService.showError($localize `:@@expired_date_required:Expired date is required!`);
                }
            }
        });
    }
    deleteRejectedInstances(){
        let result = {
            reject: undefined
        };
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(DeleteRejectedInstancesComponent, {
            height: 'auto',
            width: '500px'
        });
        this.dialogRef.componentInstance.rjnotes = this.trash.rjnotes;
        this.dialogRef.componentInstance.results = result;
        this.dialogRef.afterClosed().subscribe(re => {
            console.log('afterclose re', re);
            this.cfpLoadingBar.start();
            if (re) {

                let params = {};
                if (re.rejectedBefore){
                    params['rejectedBefore'] = re.rejectedBefore;
                }
                if (re.keepRejectionNote === true){
                    params['keepRejectionNote'] = re.keepRejectionNote;
                }
                console.log('params1', this.appService.param(params));
                console.log('params', params);

                this.service.deleteRejectedInstances(re.reject, params)
                .subscribe(
                        (res) => {
                            console.log('in res', res);
                            this.cfpLoadingBar.complete();
                            // this.fireRightQuery();
                            if (_.hasIn(res, 'deleted')){
                                this.appService.showMsg($localize `:@@instance_delete:${res.deleted}:@@deleted: instances deleted successfully!`);
                            }else{
                                this.appService.showMsg($localize `:@@process_executed:Process executed successfully`);
                            }
                        },
                        (err) => {
                            console.log('error', err);
                            this.httpErrorHandler.handleError(err);
                        });
            }
            this.cfpLoadingBar.complete();
            this.dialogRef = null;
        });

    }

    deleteStudy(study){
        console.log('study', study);
        this.confirm({
            content: $localize `:@@study.want_to_delete_study:Are you sure you want to delete this study?`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@retainObj:Retain objects on the filesystem`
                        },
                        {
                            tag:"checkbox",
                            filterKey:"retainObj"
                        }
                    ]
                ]
            ],
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@DELETE:DELETE`
        }).subscribe(result => {
            this.cfpLoadingBar.start();
            if (result){
                this.service.deleteStudy(_.get(study,"attrs['0020000D'].Value[0]"), this.studyWebService.selectedWebService, result.schema_model)
                .subscribe(
                    (response) => {
                        this.appService.showMsg($localize `:@@study.study_deleted:Study deleted successfully!`);
                        this.cfpLoadingBar.complete();
                    },
                    (response) => {
                        this.httpErrorHandler.handleError(response);
                        this.cfpLoadingBar.complete();
                    }
                );
            }
            this.cfpLoadingBar.complete();
        });
    };

    rejectMatchingStudies(){
        let rjNoteCodes: any = [];
        _.forEach(this.trash.rjnotes, (m, i) => {
            rjNoteCodes.push({
                title: m.codeMeaning,
                value: m.codeValue + '^' + m.codingSchemeDesignator,
                label: m.label
            });
        });
        this.confirm({
            content: $localize `:@@select_rejected_type:Select rejected type`,
            doNotSave:true,
            form_schema:[
                [
                    [
                        {
                            tag:"label",
                            text:$localize `:@@rejection_reason:Rejection Reason`
                        },
                        {
                            tag:"select",
                            type:"text",
                            options:rjNoteCodes,
                            filterKey:"rjNoteCode",
                            description:$localize `:@@rejection_reason:Rejection Reason`,
                            placeholder:$localize `:@@rejection_reason:Rejection Reason`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@batch_ID:Batch ID`
                        },
                        {
                            tag: "input",
                            type: "text",
                            filterKey: "batchID",
                            description: $localize`:@@batch_ID:Batch ID`,
                            placeholder: $localize`:@@batch_ID:Batch ID`
                        }
                    ],
                    [
                        {
                            tag: "label",
                            text: $localize`:@@schedule_at:Schedule at`
                        },
                        {
                            tag:"single-date-time-picker",
                            type:"text",
                            filterKey:"scheduledTime",
                            description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                        },
                    ]
                ]
            ],
            result: {
                schema_model: {
                    rjNoteCode: "113039^DCM"
                }
            },
            saveButton: $localize `:@@REJECT:REJECT`
        }).subscribe(result => {
            if (result) {
                console.log("result",result.rjNoteCode);
                this.cfpLoadingBar.start();
                let rjNoteCode = result.schema_model.rjNoteCode;
                delete result.schema_model['rjNoteCode'];
                this.service.rejectMatchingStudies(this.studyWebService.selectedWebService,
                                                    rjNoteCode,
                                                    _.merge(result.schema_model, this.createStudyFilterParams(true,true)))
                    .subscribe(res=>{
                        console.log("res",res);
                        let count = "";
                        try{
                            count = res.count;
                        }catch (e) {
                            j4care.log("Could not get count from res=",e);
                        }
                        this.appService.showMsg(`Objects rejected successfully:<br>Count: ${count}`);
                        this.cfpLoadingBar.complete();
                },err=>{
                    this.httpErrorHandler.handleError(err);
                    this.cfpLoadingBar.complete();
                });
            }
        });
    }
    rejectMatchingSeries(){
        let rjNoteCodes: any = [];
        _.forEach(this.trash.rjnotes, (m, i) => {
            rjNoteCodes.push({
                title: m.codeMeaning,
                value: m.codeValue + '^' + m.codingSchemeDesignator,
                label: m.label
            });
        });
        this.confirm({
            content: $localize `:@@select_rejected_type:Select rejected type`,
            doNotSave:true,
            form_schema:this.service.rejectMatchingSeriesDialogSchema(rjNoteCodes),
            result: {
                schema_model: {
                    rjNoteCode: "113039^DCM"
                }
            },
            saveButton: $localize `:@@REJECT:REJECT`
        }).subscribe(result => {
            if (result) {
                console.log("result",result.rjNoteCode);
                this.cfpLoadingBar.start();
                let rjNoteCode = result.schema_model.rjNoteCode;
                delete result.schema_model['rjNoteCode'];
                this.service.rejectMatchingSeries(
                        this.studyWebService.selectedWebService,
                        rjNoteCode,
                        _.merge(result.schema_model, this.createStudyFilterParams(true,true))
                    ).subscribe(res=>{
                        console.log("res",res);
                        let count = "";
                        try{
                            count = res.count;
                        }catch (e) {
                            j4care.log("Could not get count from res=",e);
                        }
                        this.appService.showMsg(`Objects rejected successfully:<br>Count: ${count}`);
                        this.cfpLoadingBar.complete();
                },err=>{
                    this.httpErrorHandler.handleError(err);
                    this.cfpLoadingBar.complete();
                });
            }
        });
    }
    exportMatchingSeries(){
        this.confirm({
            content: $localize `:@@export_all_matching_studies:Export all matching studies`,
            doNotSave:true,
            form_schema:this.service.exportMatchingSeriesDialogSchema(this.exporters),
            result: {
                schema_model: {}
            },
            saveButton: $localize `:@@EXPORT:EXPORT`
        }).subscribe(result => {
            if (result) {
                this.cfpLoadingBar.start();
                this.service.exportMatchingSeries(
                        this.studyWebService,
                        _.merge(result.schema_model, this.createStudyFilterParams(true,true))
                    ).subscribe(res=>{
                        console.log("res",res);
                        this.cfpLoadingBar.complete();
                        try{
                            let count = res["count"] || "";
                            this.appService.showMsg(`Objects export successfully:<br>Count: ${count}`);
                        }catch (e) {
                            j4care.log("Could not get count from res=",e);
                        }
                },err=>{
                    this.httpErrorHandler.handleError(err);
                    this.cfpLoadingBar.complete();
                });
            }
        });
    }
    rejectRestoreMultipleObjects(){
        let msg = "";
        let select: any = [];
        let rejectionRestoreService = (rejectionCode)=>{
            if(this.selectedElements.size > 0){
                this.cfpLoadingBar.start();
                this.service.rejectRestoreMultipleObjects(this.selectedElements, this.studyWebService.selectedWebService,rejectionCode).subscribe(res=>{
                    this.appService.showMsg(msg);
                this.cfpLoadingBar.complete();
                },err=>{
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                })
            }
        };

        if (this.trash.active) {
            msg = $localize `:@@study.objects_restored:Objects restored successfully!`;
            rejectionRestoreService(this.trash.rjcode.codeValue + '^' + this.trash.rjcode.codingSchemeDesignator);
        }else{
            msg = $localize `:@@study.objects_rejected:Objects rejected successfully!`;
            _.forEach(this.trash.rjnotes, (m, i) => {
                select.push({
                    title: m.codeMeaning,
                    value: m.codeValue + '^' + m.codingSchemeDesignator,
                    label: m.label
                });
            });
            let parameters: any = {
                content: $localize `:@@select_rejected_type:Select rejected type`,
                select: select,
                result: {select: this.trash.rjnotes[0].codeValue + '^' + this.trash.rjnotes[0].codingSchemeDesignator},
                saveButton: $localize `:@@REJECT:REJECT`
            };
            this.confirm(parameters).subscribe(result => {
                if (result) {
                    rejectionRestoreService(parameters.result.select);
                }
            });
        }

    }
    rejectStudy(study){
        let $this = this;
        if (this.trash.active) {
            //restore
            this.service.restoreStudy(study.attrs, this.studyWebService, this.trash.rjcode.codeValue + '^' + this.trash.rjcode.codingSchemeDesignator)
            .subscribe(
                (res) => {
                    $this.appService.showMsg($localize `:@@study.study_restored:Study restored successfully!`);
                    // $this.queryStudies($this.patients[0].offset);
                },
                (response) => {
                    $this.httpErrorHandler.handleError(response);
                    console.log('response', response);
                }
            );
        }else{
            let rjNoteCodes: any = [];
            _.forEach(this.trash.rjnotes, (m, i) => {
                rjNoteCodes.push({
                    title: m.codeMeaning,
                    value: m.codeValue + '^' + m.codingSchemeDesignator,
                    label: m.label
                });
            });
            this.confirm({
                content: $localize `:@@select_rejected_type:Select rejected type`,
                doNotSave:true,
                form_schema:[
                    [
                        [
                            {
                                tag:"label",
                                text:$localize `:@@rejection_reason:Rejection Reason`
                            },
                            {
                                tag:"select",
                                type:"text",
                                options:rjNoteCodes,
                                filterKey:"rjNoteCode",
                                description:$localize `:@@rejection_reason:Rejection Reason`,
                                placeholder:$localize `:@@rejection_reason:Rejection Reason`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@queue_rejection:Queue Rejection`
                            },
                            {
                                tag:"checkbox",
                                filterKey:"queue",
                                description:$localize `:@@queue_rejection:Queue Rejection`,
                                placeholder:$localize `:@@queue_rejection:Queue Rejection`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@batch_ID:Batch ID`
                            },
                            {
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize`:@@batch_ID:Batch ID`,
                                placeholder: $localize`:@@batch_ID:Batch ID`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@schedule_at:Schedule at`
                            },
                            {
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                            },
                        ]
                    ]
                ],
                result: {
                    schema_model: {
                        rjNoteCode: "113039^DCM"
                    }
                },
                saveButton: $localize `:@@REJECT:REJECT`
            }).subscribe(result => {
                if (result) {
                    $this.cfpLoadingBar.start();
                    let rjNoteCode = result.schema_model.rjNoteCode;
                    delete result.schema_model['rjNoteCode'];
                    this.service.rejectStudy(study.attrs, this.studyWebService, rjNoteCode, result.schema_model)
                        .subscribe(
                            (response) => {
                                let msg = result.schema_model.queue === "true"
                                    ? $localize `:@@study_queue_reject:Study queued for rejection successfully`
                                    : $localize `:@@study_rejected:Study rejected successfully`;
                                $this.appService.showMsg(j4care.prepareCountMessage(msg, response));

                                // patients.splice(patientkey,1);
                                $this.cfpLoadingBar.complete();
                            },
                            (err) => {
                                $this.httpErrorHandler.handleError(err);
                                // angular.element("#querypatients").trigger('click');
                                $this.cfpLoadingBar.complete();
                            }
                        );
                } else {
                    console.log('else', result);
                    console.log('parameters', result.schema_model);
                }
            })
        }
    };
    rejectSeries(series) {
        let $this = this;
        if (this.trash.active) {
            this.service.restoreSeries(series.attrs, this.studyWebService, this.trash.rjcode.codeValue + '^' + this.trash.rjcode.codingSchemeDesignator )
            .subscribe(
                (res) => {
                    // $scope.queryStudies($scope.studies[0].offset);
                    $this.appService.showMsg($localize `:@@study.series_restored:Series restored successfully!`);
                    // $this.queryStudies($this.patients[0].offset);
                },
                (response) => {
                    $this.httpErrorHandler.handleError(response);
                    console.log('response', response);
                }
            );
        }else{
            let rjNoteCodes: any = [];
            _.forEach(this.trash.rjnotes, (m, i) => {
                rjNoteCodes.push({
                    title: m.codeMeaning,
                    value: m.codeValue + '^' + m.codingSchemeDesignator,
                    label: m.label
                });
            });
            this.confirm({
                content: $localize `:@@select_rejected_type:Select rejected type`,
                doNotSave:true,
                form_schema:[
                    [
                        [
                            {
                                tag:"label",
                                text:$localize `:@@rejection_reason:Rejection Reason`
                            },
                            {
                                tag:"select",
                                type:"text",
                                options:rjNoteCodes,
                                filterKey:"rjNoteCode",
                                description:$localize `:@@rejection_reason:Rejection Reason`,
                                placeholder:$localize `:@@rejection_reason:Rejection Reason`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@queue_rejection:Queue Rejection`
                            },
                            {
                                tag:"checkbox",
                                filterKey:"queue",
                                description:$localize `:@@queue_rejection:Queue Rejection`,
                                placeholder:$localize `:@@queue_rejection:Queue Rejection`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@batch_ID:Batch ID`
                            },
                            {
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize`:@@batch_ID:Batch ID`,
                                placeholder: $localize`:@@batch_ID:Batch ID`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@schedule_at:Schedule at`
                            },
                            {
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                            },
                        ]
                    ]
                ],
                result: {
                    schema_model: {
                        rjNoteCode: "113039^DCM"
                    }
                },
                saveButton: $localize `:@@REJECT:REJECT`
            }).subscribe(result => {
                if (result) {
                    $this.cfpLoadingBar.start();
                    let rjNoteCode = result.schema_model.rjNoteCode;
                    delete result.schema_model['rjNoteCode'];
                    this.service.rejectSeries(series.attrs, this.studyWebService, rjNoteCode, result.schema_model)
                        .subscribe(
                            (response) => {
                                let msg = result.schema_model.queue === "true"
                                            ? $localize `:@@series_queue_reject:Series queued for rejection successfully`
                                            : $localize `:@@series_rejected:Series rejected successfully`;
                                $this.appService.showMsg(j4care.prepareCountMessage(msg, response));

                                // patients.splice(patientkey,1);
                                $this.cfpLoadingBar.complete();
                            },
                            (err) => {
                                $this.httpErrorHandler.handleError(err);
                                // angular.element("#querypatients").trigger('click');
                                $this.cfpLoadingBar.complete();
                            }
                        );
                } else {
                    console.log('else', result);
                    console.log('parameters', result.schema_model);
                }
            })
        }
    };
    rejectInstance(instance) {
        let $this = this;
        if (this.trash.active) {
            this.service.restoreInstance(instance.attrs, this.studyWebService, this.trash.rjcode.codeValue + '^' + this.trash.rjcode.codingSchemeDesignator )
                .subscribe(
                (res) => {
                    // $scope.queryStudies($scope.studies[0].offset);
                    $this.appService.showMsg($localize `:@@study.instance_restored:Instance restored successfully!`);
                    // $this.queryStudies($this.patients[0].offset);
                },
                (response) => {
                    $this.httpErrorHandler.handleError(response);
                    console.log('response', response);
                }
            );
        }else{
            let rjNoteCodes: any = [];
            _.forEach(this.trash.rjnotes, (m, i) => {
                rjNoteCodes.push({
                    title: m.codeMeaning,
                    value: m.codeValue + '^' + m.codingSchemeDesignator,
                    label: m.label
                });
            });
            this.confirm({
                content: $localize `:@@select_rejected_type:Select rejected type`,
                doNotSave:true,
                form_schema:[
                    [
                        [
                            {
                                tag:"label",
                                text:$localize `:@@rejection_reason:Rejection Reason`
                            },
                            {
                                tag:"select",
                                type:"text",
                                options:rjNoteCodes,
                                filterKey:"rjNoteCode",
                                description:$localize `:@@rejection_reason:Rejection Reason`,
                                placeholder:$localize `:@@rejection_reason:Rejection Reason`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@queue_rejection:Queue Rejection`
                            },
                            {
                                tag:"checkbox",
                                filterKey:"queue",
                                description:$localize `:@@queue_rejection:Queue Rejection`,
                                placeholder:$localize `:@@queue_rejection:Queue Rejection`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@batch_ID:Batch ID`
                            },
                            {
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize`:@@batch_ID:Batch ID`,
                                placeholder: $localize`:@@batch_ID:Batch ID`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@schedule_at:Schedule at`
                            },
                            {
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                            }
                        ]
                    ]
                ],
                result: {
                    schema_model: {
                        rjNoteCode: "113039^DCM"
                    }
                },
                saveButton: $localize `:@@REJECT:REJECT`
            }).subscribe(result => {
                if (result) {
                    $this.cfpLoadingBar.start();
                    let rjNoteCode = result.schema_model.rjNoteCode;
                    delete result.schema_model['rjNoteCode'];
                    this.service.rejectInstance(instance.attrs, this.studyWebService, rjNoteCode, result.schema_model)
                        .subscribe(
                            (response) => {
                                let msg = result.schema_model.queue === "true"
                                    ? $localize `:@@instance_queue_reject:Instance queued for rejection successfully`
                                    : $localize `:@@instance_rejected:Instance rejected successfully`;
                                $this.appService.showMsg(j4care.prepareCountMessage(msg, response));

                                // patients.splice(patientkey,1);
                                $this.cfpLoadingBar.complete();
                            },
                            (err) => {
                                $this.httpErrorHandler.handleError(err);
                                // angular.element("#querypatients").trigger('click');
                                $this.cfpLoadingBar.complete();
                            }
                        );
                } else {
                    console.log('else', result);
                    console.log('parameters', result.schema_model);
                }
            })
        }
    };

    setTrash(){
        if (_.hasIn(this.studyWebService,"selectedWebService.dicomAETitleObject") && this.studyWebService.selectedWebService.dicomAETitleObject.dcmHideNotRejectedInstances){
            if (!this.trash.rjcode){
                this.service.getRejectNotes({dcmRevokeRejection:true})
                    .subscribe((res)=>{
                        this.trash.rjcode = res[0];
                    });
            }
            this.trash.active = true;
        }else{
            this.trash.active = false;
        }
        this.tableParam.tableSchema  = this.getSchema();
    };
    getSchema(){
        let dateTimeFormat = _.hasIn(this.appService.global,"dateTimeFormat") ? this.appService.global["dateTimeFormat"] : undefined;
        let personNameFormat = _.hasIn(this.appService.global,"personNameFormat") ? this.appService.global["personNameFormat"] : undefined;
        return this.service.checkSchemaPermission(this.service.PATIENT_STUDIES_TABLE_SCHEMA(this, this.actions, {
            trash:this.trash,
            selectedWebService: _.get(this.studyWebService,"selectedWebService"),
            studyWebService:this.studyWebService,
            tableParam:this.tableParam,
            studyConfig:this.studyConfig,
            appService:this.appService,
            getSOPClassUIDName:this.getSOPClassUIDName,
            internal:this.internal,
            configuredDateTimeFormats:dateTimeFormat,
            configuredPersonNameFormat:personNameFormat
        }));
    }


    retrieveMultipleStudies(){
        this.exporter(
            '',
            $localize `:@@study.retrieve_matching_studies_depending:Retrieve matching studies depending on selected filters, from external C-MOVE SCP`,
            'multiple-retrieve',
            {},
            ""
        );
    }
    exportMultipleStudies(){
        this.exporter(
            '',
            $localize `:@@study.export_all_matching_studies:Export all matching studies`,
            'multipleExport',
            {},
            "study"
        );
    }
    retrieveObject(level:DicomLevel, object?, multipleObjects?:SelectionActionElement){
        console.log("object",object);
        let modalText;
        switch(level){
            case "study":
                modalText = $localize `:@@study.retrieve_study:Retrieve Study`;
                break;
            case "instance":
                modalText = $localize `:@@study.retrieve_instance:Retrieve Instance`;
                break;
            case "series":
                modalText = $localize `:@@study.retrieve_series:Retrieve Series`;
                break;
            default:
                modalText = $localize `:@@retrieve_selected_objects:Retrieve selected objects`
        }
        this.getDevices().subscribe(devices=>{
           this.devices = devices;
            this.confirm({
                content: modalText,
                doNotSave: true,
                form_schema: [
                    [
                        [
                            {
                                tag:"label_large",
                                text:modalText
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@destination_aet:Destination AET`
                            },{
                                tag:"editable-select",
                                options:this.applicationEntities.aes,
                                filterKey:"destination",
                                description: $localize `:@@destination_aet:Destination AET`,
                                placeholder: $localize `:@@destination_aet:Destination AET`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@priority:Priority`
                            },
                            {
                                tag:"select",
                                options:[
                                    new SelectDropdown(0, $localize `:@@normal:NORMAL`),
                                    new SelectDropdown(1, $localize `:@@HIGH:HIGH`),
                                    new SelectDropdown(2, $localize `:@@LOW:LOW`)
                                ],
                                filterKey:"priority",
                                type:"number",
                                description:$localize `:@@priority:Priority`,
                                placeholder:$localize `:@@priority:Priority`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@queue_name:Queue Name`
                            },
                            {
                                tag:"select",
                                options:this.retrieveQueues,
                                filterKey:"dcmQueueName",
                                description:$localize `:@@queue_name:Queue Name`,
                                placeholder:$localize `:@@queue_name:Queue Name`
                            }
                        ],[
                            {
                                tag:"label",
                                text: $localize `:@@batch_id:Batch ID`
                            },{
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize `:@@batch_id:Batch ID`,
                                placeholder: $localize `:@@batch_id:Batch ID`
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@device_name:Device Name`
                            },
                            {
                                tag:"select",
                                options:devices.map((device:Device)=>{
                                    return new SelectDropdown(device.dicomDeviceName,device.dicomDeviceName,device.dicomDeviceDescription)
                                }),
                                filterKey:"dicomDeviceName",
                                description:$localize `:@@device_name:Device Name`,
                                placeholder:$localize `:@@device_name:Device Name`
                            }
                        ],[
                            {
                                tag:"label",
                                text:$localize `:@@scheduled_time:Scheduled Time`
                            },{
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@scheduled_time:Scheduled Time`
                            }
                        ]
                    ]
                ],
                result: {
                    schema_model: {}
                },
                saveButton: $localize`:@@RETRIEVE:RETRIEVE`
            }).subscribe((ok) => {
                if(ok){
                    console.log("ok",ok);
                    this.service.getWebAppFromWebServiceClassAndSelectedWebApp(
                        this.studyWebService,
                        "MOVE",
                        "MOVE_MATCHING"
                    ).subscribe(webApp=>{
                        if(webApp){
                            this.cfpLoadingBar.start();
                            this.service.retrieve(webApp, ok.schema_model, object, level, multipleObjects).subscribe(res=>{
                                this.cfpLoadingBar.complete();
                                this.appService.showMsg(this.service.getMsgFromResponse(res,$localize `:@@study.command_executed:Command executed successfully!`));
                            },err=>{
                                this.cfpLoadingBar.complete();
                                this.httpErrorHandler.handleError(err);

                            });
                        }else{
                            this.appService.showError($localize `:@@webapp_with_MOVE_MATCHING_not_found:Web Application Service with the web service class 'MOVE_MATCHING' not found!`)
                        }
                        // fireService(result, multipleObjects,singleUrlSuffix, urlRest, url);
                    });
                }
            });
        });
    }
    exportStudy(study) {
        this.exporter(
            this.service.studyURL(study.attrs, this.studyWebService.selectedWebService),
            $localize `:@@study.export_study:Export study`,
            'single',
            study.attrs,
            "study"
        );
    };
    exportSeries(series) {
        this.exporter(
            this.service.seriesURL(series.attrs, this.studyWebService.selectedWebService),
            $localize `:@@export_series:Export series`,
            'single',
            series.attrs,
            "series"
        );
    };
    exportInstance(instance) {
        this.exporter(
            this.service.instanceURL(instance.attrs, this.studyWebService.selectedWebService),
            $localize `:@@export_instance:Export instance`,
            'single',
            instance.attrs,
            "instance"
        );
    };
    exporter(url, title, mode, objectAttr, dicomMode, multipleObjects?:SelectionActionElement){
        let $this = this;
        let id;
        let urlRest;
        let noDicomExporters = [];
        let dicomPrefixes = [];
        let singleUrlSuffix = "";
        _.forEach(this.exporters, (m, i) => {
            if (m.id.indexOf(':') > -1){
                dicomPrefixes.push(m);
            }else{
                noDicomExporters.push(m);
            }
        });
        this.config.viewContainerRef = this.viewContainerRef;
        let config = {
            height: 'auto',
            width: '500px'
        };
        if(mode === "multiple-retrieve"){
            config = {
                height: 'auto',
                width: '600px'
            };
        }
        this.dialogRef = this.dialog.open(ExportDialogComponent, config);
        this.dialogRef.componentInstance.noDicomExporters = noDicomExporters;
        this.dialogRef.componentInstance.dicomPrefixes = dicomPrefixes;
        this.dialogRef.componentInstance.externalInternalAetMode = !this.internal || mode === "multiple-retrieve" ? "external" : "internal";
        this.dialogRef.componentInstance.title = title;
        this.dialogRef.componentInstance.mode = mode;
        this.dialogRef.componentInstance.queues = this.queues;
        this.dialogRef.componentInstance.newStudyPage = true;
        // this.dialogRef.componentInstance.count = this.count;
 /*       if(!internal) {
            this.dialogRef.componentInstance.preselectedExternalAET = this.externalInternalAetModel.dicomAETitle;
        }*/
        this.dialogRef.afterClosed().subscribe(result => {
            if (result){
                let batchID = "";
                let params = {};
                if(result.batchID)
                    batchID = `batchID=${result.batchID}&`;
                let params1 = result.batchID
                            ? result.scheduledTime
                                ? `batchID=${result.batchID}&scheduledTime=${result.scheduledTime}`
                                : `batchID=${result.batchID}&`
                            : result.scheduledTime
                                ? `scheduledTime=${result.scheduledTime}&`
                                : "";
                $this.cfpLoadingBar.start();
                if(mode === "multiple-retrieve"){
                    this.service.getWebAppFromWebServiceClassAndSelectedWebApp(
                        this.studyWebService,
                        "MOVE",
                        "MOVE_MATCHING"
                    ).subscribe(webApp=>{
                        if(webApp){
                             urlRest = `${
                                    j4care.getUrlFromDcmWebApplication(webApp, this.appService.baseUrl)
                                }/studies/export/dicom:${
                                    result.selectedAet
                                }?${
                                    params1
                                }${
                                    this.appService.param({...this.createStudyFilterParams(true,true),...{batchID:result.batchID}})
                                }`;
                        }else{
                            this.appService.showError($localize `:@@webapp_with_MOVE_MATCHING_not_found:Web Application Service with the web service class 'MOVE_MATCHING' not found!`)
                        }
                        fireService(result, multipleObjects,singleUrlSuffix, urlRest, url);
                    });
                }else{
                    if(mode === 'multipleExport'){
                        this.service.getWebAppFromWebServiceClassAndSelectedWebApp(
                            this.studyWebService,
                            "DCM4CHEE_ARC_AET",
                            "MOVE_MATCHING"
                        ).subscribe(webApp=>{
                            if(webApp){
                                urlRest = `${
                                    this.service.getDicomURL("export",webApp)
                                }/${
                                    result.selectedExporter
                                }?${
                                    params1
                                }${
                                    this.appService.param(this.createStudyFilterParams(true,true))
                                }`;
                            }else{
                                this.appService.showError($localize `:@@webapp_with_MOVE_MATCHING_not_found:Web Application Service with the web service class 'MOVE_MATCHING' not found!`)
                            }
                            fireService(result, multipleObjects,singleUrlSuffix, urlRest, url);
                        });
                    }else{
                        //SINGLE
                        if(!this.internal){
                            this.service.getWebAppFromWebServiceClassAndSelectedWebApp(
                                this.studyWebService,
                                "DCM4CHEE_ARC_AET",
                                "MOVE"
                            ).subscribe(webApp=>{
                                if(webApp){
                                    if(result.dcmQueueName){
                                        params['dcmQueueName'] = result.dcmQueueName
                                    }
                                    delete params['limit'];
                                    delete params['offset'];
                                    delete params['includefield'];
                                    delete params['orderby'];
                                    urlRest = `${this.service.getDicomURL("export",webApp)}/dicom:${result.selectedAet}${j4care.param(params)}`;
                                    // urlRest = `${url}/export/dicom:${result.selectedAet}${j4care.param(params)}`;
                                    //TODO url schould be her overwritten with the 'MOVE' webapp url for external
                                }else{
                                    this.appService.showError($localize `:@@webapp_with_MOVE_MATCHING_not_found:Web Application Service with the web service class 'MOVE,DCM4CHEE_ARC_AET' not found!`)
                                }
                                fireService(result, multipleObjects,singleUrlSuffix, urlRest, url);
                            });
                        }else{
                            if (result.exportType === 'dicom') {
                                id = 'dicom:' + result.selectedAet;
                            }
                            else if (result.exportType === 'stow'){
                                id = 'stowrs:' + result.selectedStowWebapp;
                            }
                            else {
                                id = result.selectedExporter;
                            }
                            singleUrlSuffix = '/export/' + id + '?'+ params1;
                            fireService(result, multipleObjects,singleUrlSuffix, urlRest, url);
                        }
                    }
                }


            }
        });
        let  fireService = (result, multipleObjects,singleUrlSuffix, urlRest, url)=>{
            if(multipleObjects && multipleObjects.size > 0){
                this.service.export(undefined,multipleObjects,singleUrlSuffix, this.studyWebService.selectedWebService).subscribe(res=>{
                    console.log("res",res);
                    $this.appService.showMsg($this.service.getMsgFromResponse(result,'Command executed successfully!'));
                    $this.cfpLoadingBar.complete();
                }, err=>{
                    console.log("err",err);
                    $this.cfpLoadingBar.complete();
                });
            }else{
                if(singleUrlSuffix){
                    urlRest = url + singleUrlSuffix;
                }
                this.service.export(urlRest)
                    .subscribe(
                        (result) => {
                            $this.appService.showMsg($this.service.getMsgFromResponse(result,$localize `:@@study.command_executed:Command executed successfully!`));
                            $this.cfpLoadingBar.complete();
                        },
                        (err) => {
                            console.log("err",err);
                            $this.appService.setMessage({
                                'title': $localize `:@@error_status:Error ${err.status}:@@status:`,
                                'text': $this.service.getMsgFromResponse(err),
                                'status': 'error'
                            });
                            $this.cfpLoadingBar.complete();
                        }
                    );
            }
        }
    }
    storageVerificationSeries(){
        this.confirm({
            content: $localize`:@@scheduled_storage_verification_of_matching_studies:Schedule Storage Verification of matching Series`,
            doNotSave: true,
            form_schema: this.service.storageVerificationSeriesSchema(),
            result: {
                schema_model: {}
            },
            saveButton: $localize`:@@SUBMIT:SUBMIT`
        }).subscribe((ok) => {
            if (ok) {
                let msg;
                this.cfpLoadingBar.start();
                msg = $localize `:@@storage_verification_scheduled:Storage Verification scheduled successfully!`;
                this.service.schedulestorageVerificationSeries(_.merge(ok.schema_model, this.createStudyFilterParams(true, true)), this.studyWebService).subscribe(res => {
                    console.log("res", res);
                    this.cfpLoadingBar.complete();
                    msg = j4care.prepareCountMessage(msg, res);
                    this.appService.showMsg(msg);
                }, err => {
                    this.cfpLoadingBar.complete();
                    this.httpErrorHandler.handleError(err);
                });
            }
        });
    }
    storageVerificationStudies(){
        this.service.getStorageSystems().subscribe(storages=> {
            this.confirm({
                content: $localize`:@@scheduled_storage_verification_of_matching_studies:Schedule Storage Verification of matching Studies`,
                doNotSave: true,
                form_schema: [
                    [
                        [
                            {
                                tag: "label",
                                text: $localize`:@@verification_policy:Verification Policy`
                            },
                            {
                                tag: "select",
                                options: [
                                    {
                                        value: "DB_RECORD_EXISTS",
                                        text: $localize`:@@DB_RECORD_EXISTS:DB_RECORD_EXISTS`,
                                        title: $localize`:@@check_for_existence_of_db_records:Check for existence of DB records`
                                    },
                                    {
                                        value: "OBJECT_EXISTS",
                                        text: $localize`:@@OBJECT_EXISTS:OBJECT_EXISTS`,
                                        title: $localize`:@@study.check_storage_system:Check if object exists on Storage System`
                                    },
                                    {
                                        value: "OBJECT_SIZE",
                                        text: "OBJECT_SIZE",
                                        title: $localize`:@@study.check_size_in_storage_system:Check size of object on Storage System`
                                    },
                                    {
                                        value: "OBJECT_FETCH",
                                        text: $localize`:@@OBJECT_FETCH:OBJECT_FETCH`,
                                        title: $localize`:@@fetch_from_storage_system:Fetch object from Storage System`
                                    },
                                    {
                                        value: "OBJECT_CHECKSUM",
                                        text: $localize`:@@OBJECT_CHECKSUM:OBJECT_CHECKSUM`,
                                        title: $localize`:@@recalculate_checksum_on_storage_system:recalculate checksum of object on Storage System`
                                    },
                                    {
                                        value: "S3_MD5SUM",
                                        text: $localize`:@@S3_MD5SUM:S3_MD5SUM`,
                                        title: $localize`:@@check_MD5_checksum_on_S3:Check MD5 checksum of object on S3 Storage System`
                                    }
                                ],
                                showStar: true,
                                filterKey: "storageVerificationPolicy",
                                description: $localize`:@@verification_policy:Verification Policy`,
                                placeholder: $localize`:@@verification_policy:Verification Policy`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@update_location_db:Update Location DB`
                            },
                            {
                                tag: "checkbox",
                                filterKey: "storageVerificationUpdateLocationStatus"
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@storage_id:Storage ID`
                            }, {
                                tag: "select",
                                options: storages.map(storage => new SelectDropdown(storage.dcmStorageID, storage.dcmStorageID)),
                                showStar: true,
                                filterKey: "storageVerificationStorageID",
                                description: $localize`:@@storage_IDs:Storage IDs`,
                                placeholder: $localize`:@@storage_IDs:Storage IDs`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@batch_ID:Batch ID`
                            },
                            {
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize`:@@batch_ID:Batch ID`,
                                placeholder: $localize`:@@batch_ID:Batch ID`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@schedule_at:Schedule at`
                            },
                            {
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                            },
                        ]
                    ]
                ],
                result: {
                    schema_model: {}
                },
                saveButton: $localize`:@@SAVE:SAVE`
            }).subscribe((ok) => {
                if (ok) {
                    let msg;
                    this.cfpLoadingBar.start();
                    msg = $localize `:@@storage_verification_scheduled:Storage Verification scheduled successfully!`;
                    this.service.schedulestorageVerificationStudies(_.merge(ok.schema_model, this.createStudyFilterParams(true, true)), this.studyWebService).subscribe(res => {
                        console.log("res", res);
                        this.cfpLoadingBar.complete();
                        msg = j4care.prepareCountMessage(msg, res);
                        this.appService.showMsg(msg);
                    }, err => {
                        this.cfpLoadingBar.complete();
                        this.httpErrorHandler.handleError(err);
                    });
                }
            });
        },(err)=>{
            this.httpErrorHandler.handleError(err);
        });
    }

    storageCommitmen(mode, object){
        console.log('object', object);
        let dialogText = $localize `:@@verify_storage_of_selected:Verify Storage of selected entities`;
        if (mode) {
            switch (mode) {
                case "study":
                    dialogText = $localize `:@@verify_storage_of_study:Verify Storage of Study`
                    break;
                case "series":
                    dialogText = $localize `:@@verify_storage_of_series:Verify Storage of Series`
                    break;
                case "instance":
                    dialogText = $localize `:@@verify_storage_of_instance:Verify Storage of Instance`
                    break;
            }
        }
        this.service.getStorageSystems().subscribe(storages=>{
            this.confirm({
                content: dialogText,
                doNotSave:true,
                form_schema:[
                    [
                        [
                            {
                                tag:"label",
                                text:$localize `:@@verification_policy:Verification Policy`
                            },
                            {
                                tag:"select",
                                options:[
                                    {
                                        value:"DB_RECORD_EXISTS",
                                        text:$localize `:@@DB_RECORD_EXISTS:DB_RECORD_EXISTS`,
                                        title:$localize `:@@check_for_existence_of_db_records:Check for existence of DB records`
                                    },
                                    {
                                        value:"OBJECT_EXISTS",
                                        text:$localize `:@@OBJECT_EXISTS:OBJECT_EXISTS`,
                                        title:$localize `:@@study.check_storage_system:Check if object exists on Storage System`
                                    },
                                    {
                                        value:"OBJECT_SIZE",
                                        text:$localize `:@@OBJECT_SIZE:OBJECT_SIZE`,
                                        title:$localize `:@@study.check_size_in_storage_system:Check size of object on Storage System`
                                    },
                                    {
                                        value:"OBJECT_FETCH",
                                        text:$localize `:@@OBJECT_FETCH:OBJECT_FETCH`,
                                        title:$localize `:@@fetch_from_storage_system:Fetch object from Storage System`
                                    },
                                    {
                                        value:"OBJECT_CHECKSUM",
                                        text:$localize `:@@OBJECT_CHECKSUM:OBJECT_CHECKSUM`,
                                        title:$localize `:@@recalculate_checksum_on_storage_system:recalculate checksum of object on Storage System`
                                    },
                                    {
                                        value:"S3_MD5SUM",
                                        text:$localize `:@@S3_MD5SUM:S3_MD5SUM`,
                                        title:$localize `:@@check_MD5_checksum_on_S3:Check MD5 checksum of object on S3 Storage System`
                                    }
                                ],
                                showStar:true,
                                filterKey:"storageVerificationPolicy",
                                description:$localize `:@@verification_policy:Verification Policy`,
                                placeholder:$localize `:@@verification_policy:Verification Policy`,
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@update_location_db:Update Location DB`
                            },
                            {
                                tag:"checkbox",
                                filterKey:"storageVerificationUpdateLocationStatus"
                            }
                        ],
                        [
                            {
                                tag:"label",
                                text:$localize `:@@storage_id:Storage ID`
                            },
                            {
                                tag:"select",
                                options:storages.map(storage=> new SelectDropdown(storage.dcmStorageID, storage.dcmStorageID)),
                                showStar:true,
                                filterKey:"storageVerificationStorageID",
                                description:$localize `:@@storage_IDs:Storage IDs`,
                                placeholder:$localize `:@@storage_IDs:Storage IDs`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@batch_ID:Batch ID`
                            },
                            {
                                tag: "input",
                                type: "text",
                                filterKey: "batchID",
                                description: $localize`:@@batch_ID:Batch ID`,
                                placeholder: $localize`:@@batch_ID:Batch ID`
                            }
                        ],
                        [
                            {
                                tag: "label",
                                text: $localize`:@@schedule_at:Schedule at`
                            },
                            {
                                tag:"single-date-time-picker",
                                type:"text",
                                filterKey:"scheduledTime",
                                description:$localize `:@@schedule_at_desc:Schedule at (if not set, schedule immediately)`
                            },
                        ]
                    ]
                ],
                result: {
                    schema_model: {}
                },
                saveButton: $localize `:@@QUERY:QUERY`
            }).subscribe(ok=> {
                if (ok) {
                    if(mode){
                        this.cfpLoadingBar.start();
                        this.service.verifyStorage(object.attrs, this.studyWebService, mode, ok.schema_model)
                            .subscribe(
                                (response) => {
                                    // console.log("response",response);
                                    let failed = (response[0]['00081198'] && response[0]['00081198'].Value) ? response[0]['00081198'].Value.length : 0;
                                    let success = (response[0]['00081199'] && response[0]['00081199'].Value) ? response[0]['00081199'].Value.length : 0;
                                    let msgStatus = $localize `:@@info:Info`;
                                    if (failed > 0 && success > 0) {
                                        msgStatus = $localize `:@@warning:Warning`;
                                        this.appService.setMessage({
                                            'title': msgStatus,
                                            'text': $localize `:@@failed_of:${failed} of ${success + failed} failed!`,
                                            'status': msgStatus.toLowerCase()
                                        });
                                        console.log(failed + ' of ' + (success + failed) + ' failed!');
                                    }
                                    if (failed > 0 && success === 0) {
                                        msgStatus = 'Error';
                                        this.appService.setMessage({
                                            'title': msgStatus,
                                            'text': $localize `:@@study.all_failed:all (${failed}) failed!`,
                                            'status': msgStatus.toLowerCase()
                                        });
                                        console.log('all ' + failed + 'failed!');
                                    }
                                    if (failed === 0) {
                                        console.log(success + ' verified successfully 0 failed!');
                                        this.appService.setMessage({
                                            'title': msgStatus,
                                            'text': $localize `:@@study.verified_successfully_0_failed:${success} verified successfully\n 0 failed!`,
                                            'status': msgStatus.toLowerCase()
                                        });
                                    }
                                    this.cfpLoadingBar.complete();
                                },
                                (response) => {
                                    this.httpErrorHandler.handleError(response);
                                    this.cfpLoadingBar.complete();
                                }
                            );
                    } else {
                        //Selected
                        this.cfpLoadingBar.start();
                        this.service.storageVerificationForSelected(this.selectedElements, this.studyWebService, ok.schema_model)
                            .subscribe(res => {
                                console.log("res", res);
                                this.cfpLoadingBar.complete();
                                this.appService.showMsg($localize `:@@storage_verification_selected:Storage Verification of selected objects executed successfully!`);
                            }, err => {
                                this.cfpLoadingBar.complete();
                                this.httpErrorHandler.handleError(err);
                            });
                    }
                }
            });
        },(err)=>{
            this.httpErrorHandler.handleError(err);
        });
    };

    initRjNotes(retries) {
        this.service.getRejectNotes()
            .subscribe(res => {
                    this.trash.rjnotes = res.sort(function (a, b) {
                        if (a.codeValue === '113039' && a.codingSchemeDesignator === 'DCM')
                            return -1;
                        if (b.codeValue === '113039' && b.codingSchemeDesignator === 'DCM')
                            return 1;
                        return 0;
                    });
                    this.trash.reject = this.trash.rjnotes[0].codeValue + '^' + this.trash.rjnotes[0].codingSchemeDesignator;
                },
                err => {
                    if (retries)
                        this.initRjNotes(retries - 1);
                });
    }
    // aets;
    initWebApps(){
        let aetsTemp;
        let aesTemp;
        let webAppsTemp:DcmWebApp[];
        this.service.getAets().pipe(
            map((aets:Aet[])=>{
                aetsTemp = aets;
            }),
            switchMap(()=>{
                return this.service.getAes()
            }),
            switchMap((aes)=>{
                aesTemp = aes;
                let filter = {
                    dcmWebServiceClass: "MOVE"
                };
                return this.service.getWebApps(filter)
            }),
            switchMap((webApps:DcmWebApp[])=>{
                webAppsTemp = webApps;
                let filter = {
                    dcmWebServiceClass: this.currentWebAppClass
                };
                return this.service.getWebApps(filter)
            })
        ).subscribe(
                (webApps:DcmWebApp[])=> {
                    // webApps = _.uniq([...webApps,...webAppsTemp],"dcmWebAppName");
                    console.log("this.studyWebService",this.studyWebService);
                    console.log("this.filter",this.filter.filterModel);
                    this.studyWebService= new StudyWebService({
                        webServices:webApps.map((webApp:DcmWebApp)=>{
                            aetsTemp.forEach((aet)=>{
                                if(webApp.dicomAETitle && webApp.dicomAETitle === aet.dicomAETitle){
                                    webApp.dicomAETitleObject = aet;
                                }
                            });
                            this.service.convertStringLDAPParamToObject(webApp,"dcmProperty",['IID_STUDY_URL', 'IID_PATIENT_URL', 'IID_URL_TARGET']);
                            return webApp;
                        }),
                        selectedWebService:_.get(this.studyWebService,"selectedWebService"),
                        allWebServices:_.uniq([...webApps,...webAppsTemp],"dcmWebAppName"),
                    });
                    this.applicationEntities.aets = aetsTemp.map((ae:Aet)=>{
                        return new SelectDropdown(ae.dicomAETitle,ae.dicomAETitle,ae.dicomDescription,undefined,undefined,ae);
                    });
                    this.applicationEntities.aes = aesTemp.map((ae:Aet)=>{
                        return new SelectDropdown(ae.dicomAETitle,ae.dicomAETitle,ae.dicomDescription,undefined,undefined,ae);
                    });
                    // this.aets = aetsTemp;
                    // console.log("ates",this.aets);
                    // this.getDevices();
                    this.setSchema();
                    this.initExporters(2);
                    this.initRjNotes(2);
                    this.getQueueNames();
                    this.getRetrieveQueueNames();
                },
                (err)=> {
                    console.error("Error on getting webApps",err);
                    this.httpErrorHandler.handleError(err);
                });
    }
    initExporters(retries) {
        this.service.getExporters()
            .subscribe(
                (res)=> {
                    this.exporters = res;
                    /*                    if (res && res[0] && res[0].id){
                                            $this.exporterID = res[0].id;
                                        }*/
                    // $this.appService.setGlobal({exporterID:$this.exporterID});
                },
                (res)=> {
                    if (retries)
                        this.initExporters(retries - 1);
                });
    }

    queryNationalPatientRegister(patientId){
        if(patientId.xroad){
            delete patientId.xroad;
        }else{
            if(_.hasIn(this.appService,"global['PDQs']") && this.appService.global['PDQs'].length > 0){
                //PDQ is configured
                console.log("global",this.appService.global);
                if(this.appService.global['PDQs'].length > 1){
                    this.confirm({
                        content: $localize `:@@query_pdw:Query External Patient Demographics Service`,
                        doNotSave:true,
                        form_schema:[
                            [
                                [

                                    {
                                        tag:"label",
                                        text:$localize `:@@select_PDQ:Select PDQ Service`
                                    },
                                    {
                                        tag:"select",
                                        options:this.appService.global['PDQs'].map(pdq=>{
                                            return new SelectDropdown(pdq.id, (pdq.description || pdq.id))
                                        }),
                                        filterKey:"PDQServiceID",
                                        description:$localize `:@@PDQ_ServiceID:PDQ ServiceID`,
                                        placeholder:$localize `:@@PDQ_ServiceID:PDQ ServiceID`
                                    }
                                ]
                            ]
                        ],
                        result: {
                            schema_model: {}
                        },
                        saveButton: $localize `:@@QUERY:QUERY`
                    }).subscribe(ok=>{
                        if(ok && ok.schema_model.PDQServiceID){
                            this.queryPDQ(patientId,ok.schema_model.PDQServiceID);
                        }
                    })
                }else{
                    this.queryPDQ(patientId, this.appService.global.PDQs[0].id);
                }
            }else{
                console.log("global",this.appService.global);
                this.cfpLoadingBar.start();
                this.service.queryNationalPatientRegister(this.service.getPatientId(patientId.attrs)).subscribe((xroadAttr)=>{
                    patientId.xroad = xroadAttr;
                    this.cfpLoadingBar.complete();
                },(err)=>{
                    console.error("Error Quering National Pation Register",err);
                    this.httpErrorHandler.handleError(err);
                    this.cfpLoadingBar.complete();
                });
            }
        }
    }
    queryPDQ(patientId, PDQServiceID){
        this.cfpLoadingBar.start();
        this.service.queryPatientDemographics(this.service.getPatientId(patientId.attrs),PDQServiceID).subscribe((xroadAttr)=>{
            patientId.xroad = xroadAttr;
            this.cfpLoadingBar.complete();
        },(err)=>{
            console.error("Error Quering National Patient Register",err);
            this.httpErrorHandler.handleError(err);
            this.cfpLoadingBar.complete();
        });
    }
    getQueueNames(){
        this.service.getQueueNames().subscribe(names=>{
            this.queues = names.map(name=> new SelectDropdown(name.name, name.description));
        },err=>{
            this.httpErrorHandler.handleError(err);
        })
    }
    getRetrieveQueueNames(){
        this.service.getQueueNames().subscribe(names=>{
            this.retrieveQueues = names
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

    getStorages($this, callback?:Function) {
        this.service.getStorageSystems().subscribe((storageSystems:StorageSystems[]) => {
            this.storages = storageSystems.map((storageSystem:StorageSystems) => {
                return new SelectDropdown(storageSystem.dcmStorageID, storageSystem.dcmStorageID);
            });
            callback.call($this);
        }, err => {
            this.httpErrorHandler.handleError(err);
        });
    }

    getDiffAttributeSet($this, callback?:Function){
        this.service.getDiffAttributeSet().subscribe((attributeSets:DiffAttributeSet[])=>{
            this.diffAttributeSets = attributeSets.map((attributeSet:DiffAttributeSet)=>{
                return new SelectDropdown(attributeSet.id, attributeSet.title, attributeSet.description, undefined, undefined, attributeSet);
            });
            callback.call($this);
        },err=>{
            this.httpErrorHandler.handleError(err);
        });
    }

    getSOPClassUIDName(classUID){
        try{
            return DCM4CHE.SOPClass.nameOf(classUID);
        }catch (e) {
            return classUID;
        }
    }

    ngAfterContentChecked(): void {
        this.changeDetector.detectChanges();
    }

/*    get selectedWebAppService(): DcmWebApp {
        return this.studyWebService.selectedWebService;
    }

    set selectedWebAppService(value: DcmWebApp) {
        this.studyWebService.selectedWebService = value;
        this.setTrash();
    }*/
   ngOnDestroy(){
       if(this.selectedElements){
           this.service.selectedElements = this.selectedElements;
       }


/*       let stateObject = {
           isOpen:this.isOpen,
           studyConfig:this.studyConfig,
           patientAttributes:this.patientAttributes,
           _filter:this._filter,
           applicationEntities:this.applicationEntities,
           trash:this.trash,
           studyWebService:this.studyWebService,
           selectedElements:this.selectedElements,
           tableParam:this.tableParam,
           lastPressedCode:this.lastPressedCode,
           moreFunctionConfig:this.moreFunctionConfig,
           actionsSelections:this.actionsSelections,
           exporters:this.exporters,
           patients:this.patients,
           moreState:this.moreState,
           queues:this.queues,
           searchCurrentList:this.searchCurrentList,
           largeIntFormat:this.largeIntFormat,
           filterButtonPath:this.filterButtonPath,
           internal:this.internal,
           checkboxFunctions:this.checkboxFunctions,
           currentWebAppClass:this.currentWebAppClass,
           diffAttributeSets:this.diffAttributeSets,
       };
       this.appService.updateGlobal(`study_${this.studyConfig.tab}`,stateObject);*/
   }
}
