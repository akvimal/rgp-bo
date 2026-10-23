import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { UsersService } from "../users.service";

/**
 * A person at a glance, read only and set out like a one-page resume: who they are and where they work, their contact
 * details, employment, emergency contact and pharmacist registration. Editing is the Edit button (the Edit User form).
 */
@Component({
    templateUrl: "user-profile.component.html",
    styles: [`
        .profile-block { margin-bottom: 1.1rem; }
        .profile-title { font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; color: #6c757d; border-bottom: 1px solid #e3e6ee; padding-bottom: .2rem; margin-bottom: .5rem; font-weight: 600; }
        .profile-list dt { font-weight: 500; color: #6c757d; padding-top: .1rem; padding-bottom: .1rem; }
        .profile-list dd { margin-bottom: 0; padding-top: .1rem; padding-bottom: .1rem; }
        @media (min-width: 992px) { .border-end-lg { border-right: 1px solid #e3e6ee; } }
    `]
})
export class UserProfileComponent implements OnInit {
    user:any = null;
    staff:any = null;
    error = "";
    loading = true;

    constructor(private service:UsersService, private route:ActivatedRoute) {}

    ngOnInit(){
        const id = this.route.snapshot.paramMap.get("id");
        this.service.findById(id).subscribe((u:any) => {
            this.user = u;
            this.service.staffDetails().subscribe((r:any) => {
                this.staff = (r.people || []).find((p:any) => String(p.user_id) === String(id)) || null;
                this.loading = false;
            }, () => { this.loading = false; });
        }, () => { this.loading = false; this.error = "This person was not found."; });
    }

    get initials():string {
        const parts = String(this.user?.fullname || "?").trim().split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
    }

    get stores():string[] {
        return (this.user?.storeassignments || []).map((a:any) => a.store?.location).filter((n:any) => !!n);
    }

    /** "2 years 3 months" since the joining date */
    get tenure():string {
        const j = this.staff?.join_date;
        if (!j) return "";
        const from = new Date(j + "T00:00:00");
        const now = new Date();
        let months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth();
        if (now.getDate() < from.getDate()) months--;
        if (months < 1) return "less than a month";
        const y = Math.floor(months / 12), m = months % 12;
        return [y ? `${y} year${y === 1 ? "" : "s"}` : "", m ? `${m} month${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
    }

    get regClass():string {
        const s = this.staff?.reg_status;
        return s === "EXPIRED" ? "bg-danger" : s === "EXPIRING" ? "bg-warning text-dark" : "bg-success";
    }

    get regLabel():string {
        const s = this.staff?.reg_status;
        return s === "EXPIRED" ? "Lapsed" : s === "EXPIRING" ? "Lapses soon" : s === "VALID" ? "Valid" : "";
    }
}
