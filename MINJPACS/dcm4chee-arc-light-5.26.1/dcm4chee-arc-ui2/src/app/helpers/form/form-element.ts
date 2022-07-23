/**
 * Created by shefki on 9/20/16.
 */

export class FormElement<T>{
    value: T;
    key: string;
    label: string;
    validation: any;
    order: number;
    description: string;
    controlType: string;
    url: string;
    msg: string;
    addUrl: string;
    materialIconName: string;
    title: string;
    show: boolean;
    format: string;
    downloadUrl:string;
    deviceName:string;
    type:string;
    showPicker:boolean;
    showPickerTooltipp:boolean;
    showTimePicker:boolean;
    showDurationPicker:boolean;
    showSchedulePicker:boolean;
    showCharSetPicker:boolean;
    showLanguagePicker:boolean;
    options:any;
    constructor(options: {
        value?: T,
        key?: string,
        label?: string,
        validation?: any,
        order?: number,
        description?: string,
        controlType?: string,
        type?:string,
        show?: boolean;
        format?: string;
    } = {}) {
        this.value = options.value;
        this.key = options.key || '';
        this.label = options.label || '';
        this.validation = options.validation;
        this.order = options.order === undefined ? 1 : options.order;
        this.description = options.description || '';
        this.controlType = options.controlType || '';
        this.show = options.show || false;
        this.format = options.format || undefined;
        if(options.type){
            this.type = options.type;
        }
    }
}