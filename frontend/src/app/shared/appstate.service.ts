import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { AppState } from "./app-state";

@Injectable({
    providedIn: 'root'
})
export class AppStateService {

    state = new BehaviorSubject<AppState>({title:'Dashboard'});

}