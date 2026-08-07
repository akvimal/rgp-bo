import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../roles.service";
import { PERMISSION_CATALOG, PERMISSION_GROUPS, PermissionResource } from "../permission-catalog";

interface ResourceSelection {
  enabled: boolean;
  actions: { [actionKey: string]: boolean };
  properties: { [actionKey: string]: { [propKey: string]: boolean } };
  pages: { [pathKey: string]: boolean };
}

interface LandingOption {
  value: string;
  label: string;
}

@Component({
    templateUrl: 'role-form.component.html',
    styleUrls: ['role-form.component.scss']
})
export class RoleFormComponent {

    catalog = PERMISSION_CATALOG;
    groups = PERMISSION_GROUPS;

    selection: { [resourceKey: string]: ResourceSelection } = {};
    dashboardAccess = true;
    landingPath = '/secure/dashboard';
    extraResources: any[] = [];

    showJson = false;
    jsonPreview = '';
    importText = '';
    importError = '';

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required)
      });

      constructor(private service:RolesService, private router:Router,
        private route:ActivatedRoute){
          this.resetSelection();
        }

      ngOnInit(){
        const id = this.route.snapshot.paramMap.get('id');
        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['name'].setValue(data.name);
          this.populateFromPermissions(data.permissions || []);
          this.refreshPreview();
        });
      }

      private resetSelection(){
        this.selection = {};
        this.catalog.forEach(r => {
          this.selection[r.key] = { enabled: false, actions: {}, properties: {}, pages: {} };
        });
      }

      private firstPath(path: string | string[]): string {
        return Array.isArray(path) ? path[0] : path;
      }

      get landingOptions(): LandingOption[] {
        const options: LandingOption[] = [{ value: '/secure/dashboard', label: 'Dashboard' }];
        this.catalog.forEach(r => {
          if (this.selection[r.key]?.enabled) {
            options.push({ value: this.firstPath(r.path), label: r.label });
          }
        });
        return options;
      }

      resourcesInGroup(group: string): PermissionResource[] {
        return this.catalog.filter(r => r.group === group);
      }

      toggleResource(resource: PermissionResource, checked: boolean){
        const sel = this.selection[resource.key];
        sel.enabled = checked;
        if (checked && resource.bundle) {
          resource.actions.forEach(a => sel.actions[a.key] = true);
        }
        if (checked && resource.pathOptions && !Object.values(sel.pages).some(v => v)) {
          resource.pathOptions.forEach(p => sel.pages[p.key] = true);
        }
        if (!checked) {
          sel.actions = {};
          sel.properties = {};
          sel.pages = {};
          if (this.landingPath === this.firstPath(resource.path)) {
            this.landingPath = '/secure/dashboard';
          }
        }
        this.refreshPreview();
      }

      togglePage(resource: PermissionResource, pathKey: string, checked: boolean){
        const sel = this.selection[resource.key];
        sel.pages[pathKey] = checked;
        this.refreshPreview();
      }

      isPageChecked(resource: PermissionResource, pathKey: string): boolean {
        return !!this.selection[resource.key]?.pages?.[pathKey];
      }

      toggleAction(resource: PermissionResource, actionKey: string, checked: boolean){
        const sel = this.selection[resource.key];
        sel.actions[actionKey] = checked;
        sel.enabled = Object.values(sel.actions).some(v => v);
        this.refreshPreview();
      }

      toggleProperty(resource: PermissionResource, actionKey: string, propKey: string, checked: boolean){
        const sel = this.selection[resource.key];
        if (!sel.properties[actionKey]) {
          sel.properties[actionKey] = {};
        }
        sel.properties[actionKey][propKey] = checked;
        this.refreshPreview();
      }

      isPropertyChecked(resource: PermissionResource, actionKey: string, propKey: string): boolean {
        return !!this.selection[resource.key]?.properties?.[actionKey]?.[propKey];
      }

      onLandingChange(){
        this.refreshPreview();
      }

      onDashboardAccessChange(){
        this.refreshPreview();
      }

      private populateFromPermissions(blocks: any[]){
        this.resetSelection();
        this.extraResources = [];
        this.dashboardAccess = false;
        this.landingPath = '/secure/dashboard';

        (blocks || []).forEach(block => {
          if (block.resource === 'site') {
            const paths: string[] = Array.isArray(block.path) ? block.path : [block.path].filter(Boolean);
            this.dashboardAccess = paths.includes('/secure/dashboard');
            this.landingPath = paths[0] || '/secure/dashboard';
            return;
          }
          if (block.resource === 'settings') {
            return;
          }
          const catalogEntry = this.catalog.find(r => r.key === block.resource);
          if (!catalogEntry) {
            this.extraResources.push(block);
            return;
          }
          const sel = this.selection[block.resource];
          sel.enabled = true;
          (block.policies || []).forEach((policy: any) => {
            sel.actions[policy.action] = true;
            const actionDef = catalogEntry.actions.find(a => a.key === policy.action);
            if (actionDef?.properties && Array.isArray(policy.properties)) {
              sel.properties[policy.action] = {};
              policy.properties.forEach((p: string) => sel.properties[policy.action][p] = true);
            }
          });
          if (catalogEntry.pathOptions) {
            const blockPaths: string[] = Array.isArray(block.path) ? block.path : [block.path].filter(Boolean);
            const allPageKeys = catalogEntry.pathOptions.map(p => p.key);
            // A single parent path (e.g. legacy '/secure/sales') already grants every sub-page via
            // prefix matching, so treat it the same as every page being individually selected.
            const isBareParentPrefix = blockPaths.length === 1 && allPageKeys.every(p => p.startsWith(blockPaths[0] + '/'));
            allPageKeys.forEach(p => sel.pages[p] = isBareParentPrefix || blockPaths.includes(p));
          }
        });
      }

      private buildPermissions(): any[] {
        const blocks: any[] = [];

        const sitePath = [this.landingPath];
        if (this.dashboardAccess && this.landingPath !== '/secure/dashboard') {
          sitePath.push('/secure/dashboard');
        }
        if (this.landingPath !== '/secure/profile') {
          sitePath.push('/secure/profile');
        }
        blocks.push({ resource: 'site', path: sitePath });

        const enabledSettingsPaths: string[] = [];

        this.catalog.forEach(resource => {
          const sel = this.selection[resource.key];
          if (!sel?.enabled) {
            return;
          }

          if (resource.presenceOnly) {
            blocks.push({ resource: resource.key, path: resource.path });
            if (resource.settingsPath) {
              enabledSettingsPaths.push(this.firstPath(resource.path));
            }
            return;
          }

          const policies = resource.actions
            .filter(a => sel.actions[a.key])
            .map(a => {
              const policy: any = { action: a.key };
              if (a.properties) {
                policy.properties = a.properties
                  .filter(p => sel.properties[a.key]?.[p.key])
                  .map(p => p.key);
              } else if (a.fixedProperties) {
                policy.properties = a.fixedProperties;
              }
              return policy;
            });

          if (!policies.length) {
            return;
          }

          const path = resource.pathOptions
            ? resource.pathOptions.filter(p => sel.pages[p.key]).map(p => p.key)
            : resource.path;

          blocks.push({ resource: resource.key, path, policies });
          if (resource.settingsPath) {
            enabledSettingsPaths.push(this.firstPath(resource.path));
          }
        });

        if (enabledSettingsPaths.length) {
          blocks.push({
            resource: 'settings',
            path: enabledSettingsPaths,
            data: 'all',
            policies: [{ action: 'read', properties: [] }, { action: 'view', properties: [] }, { action: 'add', path: '/new', properties: [] }],
          });
        }

        blocks.push(...this.extraResources);

        return blocks;
      }

      refreshPreview(){
        this.jsonPreview = JSON.stringify(this.buildPermissions(), null, 2);
      }

      toggleJsonView(){
        this.showJson = !this.showJson;
        if (this.showJson) {
          this.importText = this.jsonPreview;
          this.importError = '';
        }
      }

      applyImportedJson(){
        this.importError = '';
        try {
          const parsed = JSON.parse(this.importText);
          if (!Array.isArray(parsed)) {
            throw new Error('Expected a JSON array of permission blocks');
          }
          this.populateFromPermissions(parsed);
          this.refreshPreview();
          this.showJson = false;
        } catch (e: any) {
          this.importError = e?.message || 'Invalid JSON';
        }
      }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = {
          name: this.form.value.name,
          permissions: this.buildPermissions()
        };

        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => {
            this.gotoList()
          });
        }
        else {
          this.service.save(obj).subscribe(data => this.gotoList());
        }

      }

      reset(){
        this.form.controls['name'].setValue('');
        this.resetSelection();
        this.dashboardAccess = true;
        this.landingPath = '/secure/dashboard';
        this.extraResources = [];
        this.refreshPreview();
      }

      gotoList() {
        this.router.navigate(['/secure/settings/roles'])
      }
}
