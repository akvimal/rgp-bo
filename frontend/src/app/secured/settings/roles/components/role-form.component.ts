import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../roles.service";
import { PERMISSION_RESOURCES, ResourcePermission, PermissionState } from "../permissions.config";

@Component({
    templateUrl: 'role-form.component.html'
})
export class RoleFormComponent{

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        name: new FormControl('',Validators.required)
      });

    // Permission configuration
    resources = PERMISSION_RESOURCES;
    permissionState: PermissionState = {};

    // UI state
    editMode: 'visual' | 'json' = 'visual';
    jsonPreview = '';
    activeAccordion: string | null = null;

      constructor(private service:RolesService, private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        // Initialize permission state
        this.initializePermissionState();

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
          this.service.findById(id).subscribe((data:any) => {
            this.form.controls['id'].setValue(id);
            this.form.controls['name'].setValue(data.name);

            // Load permissions from JSON
            if (data.permissions) {
              const permissionsData = typeof data.permissions === 'string'
                ? JSON.parse(data.permissions)
                : data.permissions;
              this.loadPermissionsFromJSON(permissionsData);
            }
          })
        }
      }

      initializePermissionState() {
        this.resources.forEach(resource => {
          this.permissionState[resource.resource] = {
            enabled: false,
            paths: [...(resource.defaultPaths || [])],
            actions: {}
          };

          resource.actions.forEach(action => {
            this.permissionState[resource.resource].actions[action.action] = {
              enabled: false,
              path: '',
              properties: []
            };
          });
        });
      }

      loadPermissionsFromJSON(jsonPermissions: any[]) {
        // Reset state
        this.initializePermissionState();

        // Parse JSON permissions into visual state
        if (Array.isArray(jsonPermissions)) {
          jsonPermissions.forEach(permission => {
            const resource = permission.resource;
            if (this.permissionState[resource]) {
              this.permissionState[resource].enabled = true;

              // Load paths
              if (permission.path) {
                if (Array.isArray(permission.path)) {
                  this.permissionState[resource].paths = permission.path;
                } else {
                  this.permissionState[resource].paths = [permission.path];
                }
              }

              // Load actions/policies
              if (permission.policies && Array.isArray(permission.policies)) {
                permission.policies.forEach((policy: any) => {
                  if (this.permissionState[resource].actions[policy.action]) {
                    this.permissionState[resource].actions[policy.action] = {
                      enabled: true,
                      path: policy.path || '',
                      properties: policy.properties || []
                    };
                  }
                });
              }
            }
          });
        }

        this.updateJSONPreview();
      }

      toggleResource(resourceName: string) {
        this.permissionState[resourceName].enabled = !this.permissionState[resourceName].enabled;

        // If disabling, disable all actions
        if (!this.permissionState[resourceName].enabled) {
          Object.keys(this.permissionState[resourceName].actions).forEach(action => {
            this.permissionState[resourceName].actions[action].enabled = false;
          });
        }

        this.updateJSONPreview();
      }

      toggleAction(resourceName: string, actionName: string) {
        const action = this.permissionState[resourceName].actions[actionName];
        action.enabled = !action.enabled;

        // Enable resource if action is enabled
        if (action.enabled) {
          this.permissionState[resourceName].enabled = true;
        }

        this.updateJSONPreview();
      }

      toggleProperty(resourceName: string, actionName: string, property: string) {
        const action = this.permissionState[resourceName].actions[actionName];
        if (!action.properties) {
          action.properties = [];
        }

        const index = action.properties.indexOf(property);
        if (index > -1) {
          action.properties.splice(index, 1);
        } else {
          action.properties.push(property);
        }

        this.updateJSONPreview();
      }

      isPropertySelected(resourceName: string, actionName: string, property: string): boolean {
        const action = this.permissionState[resourceName].actions[actionName];
        return action.properties ? action.properties.indexOf(property) > -1 : false;
      }

      selectAllProperties(resourceName: string, actionName: string, properties: string[]) {
        const action = this.permissionState[resourceName].actions[actionName];
        action.properties = [...properties];
        this.updateJSONPreview();
      }

      clearAllProperties(resourceName: string, actionName: string) {
        const action = this.permissionState[resourceName].actions[actionName];
        action.properties = [];
        this.updateJSONPreview();
      }

      updateJSONPreview() {
        const permissions = this.generatePermissionsJSON();
        this.jsonPreview = JSON.stringify(permissions, null, 2);
      }

      generatePermissionsJSON(): any[] {
        const permissions: any[] = [];

        this.resources.forEach(resource => {
          const state = this.permissionState[resource.resource];

          if (state.enabled) {
            const permission: any = {
              resource: resource.resource
            };

            // Add paths
            if (state.paths && state.paths.length > 0) {
              permission.path = state.paths.length === 1 ? state.paths[0] : state.paths;
            }

            // Add policies
            const policies: any[] = [];
            Object.keys(state.actions).forEach(actionKey => {
              const action = state.actions[actionKey];
              if (action.enabled) {
                const policy: any = { action: actionKey };

                if (action.path) {
                  policy.path = action.path;
                }

                if (action.properties && action.properties.length > 0) {
                  policy.properties = action.properties;
                }

                policies.push(policy);
              }
            });

            if (policies.length > 0) {
              permission.policies = policies;
            }

            permissions.push(permission);
          }
        });

        return permissions;
      }

      toggleAccordion(resourceName: string) {
        this.activeAccordion = this.activeAccordion === resourceName ? null : resourceName;
      }

      switchToVisualMode() {
        this.editMode = 'visual';
      }

      switchToJSONMode() {
        this.editMode = 'json';
        this.updateJSONPreview();
      }

      applyJSONChanges() {
        try {
          const parsed = JSON.parse(this.jsonPreview);
          this.loadPermissionsFromJSON(parsed);
          this.editMode = 'visual';
        } catch (e) {
          alert('Invalid JSON format. Please check and try again.');
        }
      }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const permissions = this.generatePermissionsJSON();

        const obj = {
          name: this.form.value.name,
          permissions: JSON.stringify(permissions)
        }

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
        this.form.reset();
        this.initializePermissionState();
        this.updateJSONPreview();
      }

      gotoList() {
        this.router.navigate(['/secure/settings/roles'])
      }
}
