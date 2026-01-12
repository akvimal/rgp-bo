import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RolesService } from "../roles.service";
import { PERMISSION_RESOURCES, ResourcePermission, PermissionState } from "../permissions.config";
import { FeatureGroupService, FeatureGroup, RoleFeatureAssignment } from "../services/feature-group.service";

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

    // Permission mode: 'legacy' or 'feature-groups'
    permissionMode: 'legacy' | 'feature-groups' = 'feature-groups';

    // Feature Groups data
    featureGroups: FeatureGroup[] = [];
    roleFeatureAssignments: RoleFeatureAssignment[] = [];
    availableFeatureGroups: FeatureGroup[] = [];
    selectedFeatureGroup: number | null = null;
    selectedAccessLevel: number | null = null;
    selectedDataScope: string = 'all';
    featureOptions: any = {};

      constructor(
        private service:RolesService,
        private router:Router,
        private route:ActivatedRoute,
        private featureGroupService:FeatureGroupService
      ){}

      ngOnInit(){
        // Initialize permission state
        this.initializePermissionState();

        // Load all feature groups
        this.featureGroupService.getAllFeatureGroups().subscribe(groups => {
          this.featureGroups = groups;
          this.updateAvailableFeatureGroups();
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
          this.service.findById(id).subscribe((data:any) => {
            this.form.controls['id'].setValue(id);
            this.form.controls['name'].setValue(data.name);

            // Determine permission mode
            if (data.usesFeatureGroups) {
              this.permissionMode = 'feature-groups';
              // Load feature group assignments
              this.loadFeatureGroupAssignments(Number(id));
            } else {
              this.permissionMode = 'legacy';
              // Load permissions from JSON
              if (data.permissions) {
                const permissionsData = typeof data.permissions === 'string'
                  ? JSON.parse(data.permissions)
                  : data.permissions;
                this.loadPermissionsFromJSON(permissionsData);
              }
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

      // === Feature Groups Methods ===

      switchPermissionMode(mode: 'legacy' | 'feature-groups') {
        if (this.form.value.id) {
          if (confirm('Switching permission mode will reset current permissions. Continue?')) {
            this.permissionMode = mode;
            if (mode === 'legacy') {
              this.initializePermissionState();
            } else {
              this.roleFeatureAssignments = [];
              this.updateAvailableFeatureGroups();
            }
          }
        } else {
          this.permissionMode = mode;
        }
      }

      loadFeatureGroupAssignments(roleId: number) {
        this.featureGroupService.getRoleFeatureAssignments(roleId).subscribe(assignments => {
          this.roleFeatureAssignments = assignments;
          this.updateAvailableFeatureGroups();
        });
      }

      updateAvailableFeatureGroups() {
        const assignedIds = this.roleFeatureAssignments.map(a => a.featureGroupId);
        this.availableFeatureGroups = this.featureGroups.filter(fg => !assignedIds.includes(fg.id));
      }

      getFeatureGroupById(id: number): FeatureGroup | undefined {
        return this.featureGroups.find(fg => fg.id === id);
      }

      getAccessLevelById(featureGroupId: number, accessLevelId: number) {
        const featureGroup = this.getFeatureGroupById(featureGroupId);
        return featureGroup?.accessLevels.find(al => al.id === accessLevelId);
      }

      onAssignFeature() {
        console.log('onAssignFeature called');
        console.log('Selected Feature Group:', this.selectedFeatureGroup);
        console.log('Selected Access Level:', this.selectedAccessLevel);
        console.log('Selected Access Level TYPE:', typeof this.selectedAccessLevel);
        console.log('Selected Data Scope:', this.selectedDataScope);

        // Convert string values to numbers (HTML select returns strings)
        if (this.selectedFeatureGroup !== null) {
          this.selectedFeatureGroup = +this.selectedFeatureGroup;
        }
        if (this.selectedAccessLevel !== null) {
          this.selectedAccessLevel = +this.selectedAccessLevel;
        }

        console.log('After conversion - Feature Group:', this.selectedFeatureGroup, 'TYPE:', typeof this.selectedFeatureGroup);
        console.log('After conversion - Access Level:', this.selectedAccessLevel, 'TYPE:', typeof this.selectedAccessLevel);

        if (!this.selectedFeatureGroup || !this.selectedAccessLevel) {
          alert('Please select a feature group and access level');
          return;
        }

        const roleId = this.form.value.id;
        console.log('Role ID:', roleId);
        if (!roleId) {
          // For new role, add to temporary array
          console.log('Adding to temporary array (new role)');
          const featureGroup = this.getFeatureGroupById(this.selectedFeatureGroup);
          console.log('Found feature group:', featureGroup);

          // Debug access levels array
          console.log('Access Levels Array:', featureGroup?.accessLevels);
          if (featureGroup?.accessLevels) {
            console.log('Access Levels Count:', featureGroup.accessLevels.length);
            featureGroup.accessLevels.forEach((al, index) => {
              console.log(`  Access Level [${index}]: id=${al.id} (type: ${typeof al.id}), displayName=${al.displayName}`);
            });
          }

          const accessLevel = featureGroup?.accessLevels.find(al => {
            console.log(`  Comparing: al.id=${al.id} (${typeof al.id}) === selectedAccessLevel=${this.selectedAccessLevel} (${typeof this.selectedAccessLevel}) => ${al.id === this.selectedAccessLevel}`);
            return al.id === this.selectedAccessLevel;
          });
          console.log('Found access level:', accessLevel);

          if (featureGroup && accessLevel) {
            console.log('Adding assignment to array...');
            this.roleFeatureAssignments.push({
              roleId: 0, // Will be set when role is created
              featureGroupId: this.selectedFeatureGroup,
              accessLevelId: this.selectedAccessLevel,
              dataScope: this.selectedDataScope,
              options: { ...this.featureOptions },
              featureGroup: featureGroup,
              accessLevel: accessLevel,
              subFeatureAssignments: []
            });
            console.log('Current assignments:', this.roleFeatureAssignments);
            this.updateAvailableFeatureGroups();
            this.resetFeatureSelection();
            console.log('Assignment added successfully!');
          } else {
            console.error('Failed to add: featureGroup or accessLevel not found');
            console.error('featureGroup:', featureGroup);
            console.error('accessLevel:', accessLevel);
          }
        } else {
          // For existing role, save to database
          this.featureGroupService.assignFeatureToRole({
            roleId: Number(roleId),
            featureGroupId: this.selectedFeatureGroup,
            accessLevelId: this.selectedAccessLevel,
            dataScope: this.selectedDataScope,
            options: this.featureOptions
          }).subscribe({
            next: () => {
              this.loadFeatureGroupAssignments(Number(roleId));
              this.resetFeatureSelection();
            },
            error: (err) => {
              alert(err.error?.message || 'Failed to assign feature');
            }
          });
        }
      }

      onRemoveFeature(assignment: RoleFeatureAssignment) {
        if (!confirm('Remove this feature group assignment?')) return;

        const roleId = this.form.value.id;
        if (roleId && assignment.id) {
          this.featureGroupService.removeFeatureFromRole(Number(roleId), assignment.featureGroupId).subscribe({
            next: () => {
              this.loadFeatureGroupAssignments(Number(roleId));
            },
            error: (err) => {
              alert(err.error?.message || 'Failed to remove feature');
            }
          });
        } else {
          // Remove from temporary array for new role
          const index = this.roleFeatureAssignments.indexOf(assignment);
          if (index > -1) {
            this.roleFeatureAssignments.splice(index, 1);
            this.updateAvailableFeatureGroups();
          }
        }
      }

      onUpdateAccessLevel(assignment: RoleFeatureAssignment, newAccessLevelId: number) {
        const roleId = this.form.value.id;
        if (roleId && assignment.id) {
          this.featureGroupService.updateFeatureAssignment(assignment.id, {
            accessLevelId: newAccessLevelId
          }).subscribe({
            next: () => {
              this.loadFeatureGroupAssignments(Number(roleId));
            },
            error: (err) => {
              alert(err.error?.message || 'Failed to update access level');
            }
          });
        } else {
          // Update in temporary array
          assignment.accessLevelId = newAccessLevelId;
          const accessLevel = this.getAccessLevelById(assignment.featureGroupId, newAccessLevelId);
          if (accessLevel) {
            assignment.accessLevel = accessLevel;
          }
        }
      }

      onUpdateDataScope(assignment: RoleFeatureAssignment, newDataScope: string) {
        const roleId = this.form.value.id;
        if (roleId && assignment.id) {
          this.featureGroupService.updateFeatureAssignment(assignment.id, {
            dataScope: newDataScope
          }).subscribe({
            next: () => {
              this.loadFeatureGroupAssignments(Number(roleId));
            },
            error: (err) => {
              alert(err.error?.message || 'Failed to update data scope');
            }
          });
        } else {
          // Update in temporary array
          assignment.dataScope = newDataScope;
        }
      }

      resetFeatureSelection() {
        this.selectedFeatureGroup = null;
        this.selectedAccessLevel = null;
        this.selectedDataScope = 'all';
        this.featureOptions = {};
      }

      onFeatureGroupChange() {
        // Convert string to number (HTML select returns strings)
        if (this.selectedFeatureGroup !== null) {
          this.selectedFeatureGroup = +this.selectedFeatureGroup;
        }

        // Auto-select the first access level when a feature group is selected
        const featureGroup = this.getFeatureGroupById(this.selectedFeatureGroup!);
        console.log('Feature group selected:', featureGroup);

        if (featureGroup && featureGroup.accessLevels && featureGroup.accessLevels.length > 0) {
          this.selectedAccessLevel = featureGroup.accessLevels[0].id;
          console.log('Auto-selected access level:', this.selectedAccessLevel);
        } else {
          this.selectedAccessLevel = null;
          console.log('No access levels available for this feature group');
        }
      }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const id = this.form.value.id;

        if (this.permissionMode === 'feature-groups') {
          // Feature groups mode
          const obj = {
            name: this.form.value.name,
            permissions: null, // No legacy permissions
            usesFeatureGroups: true
          }

          if(id) {
            // Update existing role
            this.service.update(id, obj).subscribe(() => {
              this.gotoList()
            });
          } else {
            // Create new role, then assign feature groups
            this.service.save(obj).subscribe((newRole: any) => {
              if (this.roleFeatureAssignments.length > 0) {
                // Assign all feature groups
                this.assignFeatureGroupsForNewRole(newRole.id);
              } else {
                this.gotoList();
              }
            });
          }
        } else {
          // Legacy permissions mode
          const permissions = this.generatePermissionsJSON();
          const obj = {
            name: this.form.value.name,
            permissions: JSON.stringify(permissions)
          }

          if(id) {
            this.service.update(id, obj).subscribe(data => {
              this.gotoList()
            });
          }
          else {
            this.service.save(obj).subscribe(data => this.gotoList());
          }
        }
      }

      assignFeatureGroupsForNewRole(roleId: number) {
        const assignments = this.roleFeatureAssignments.map(assignment =>
          this.featureGroupService.assignFeatureToRole({
            roleId,
            featureGroupId: assignment.featureGroupId,
            accessLevelId: assignment.accessLevelId,
            dataScope: assignment.dataScope,
            options: assignment.options
          })
        );

        // Wait for all assignments to complete
        Promise.all(assignments.map(obs => obs.toPromise()))
          .then(() => this.gotoList())
          .catch(err => {
            alert('Error assigning feature groups: ' + (err.error?.message || 'Unknown error'));
          });
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
