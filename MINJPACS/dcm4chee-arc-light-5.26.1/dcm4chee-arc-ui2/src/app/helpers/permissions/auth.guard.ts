import { Injectable } from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';
import {PermissionService} from "./permission.service";
import {AppService} from "../../app.service";

// let keycloak: any;

@Injectable()
export class AuthGuard implements CanActivate {

    constructor(
        private permissionService:PermissionService,
        private appservice:AppService,
        private router: Router,
    ) {}

    canActivate(route : ActivatedRouteSnapshot, state : RouterStateSnapshot){
        console.log("in can activate", this.appservice);
        if(this.appservice.global && this.appservice.global.notSecure){
            return true;
        }else{
            let check = this.permissionService.getPermission(state.url);
            if(!check){
                this.router.navigateByUrl('/permission-denied');
                this.appservice.setMessage({
                    'title': $localize `:@@auth.permission_denied:Permission denied`,
                    'text': $localize `:@@you_dont_have_access_permission:You don\'t have permission to access ${state.url}`,
                    'status': 'error'
                });
            }
            if(check && check.redirect)
                this.router.navigateByUrl(check.redirect);
            return check;
        }
    }
}