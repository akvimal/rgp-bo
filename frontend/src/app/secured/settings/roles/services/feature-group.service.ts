import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface FeatureGroup {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  accessLevels: AccessLevel[];
  subFeatures: SubFeature[];
}

export interface AccessLevel {
  id: number;
  featureGroupId: number;
  levelName: string;
  levelOrder: number;
  displayName: string;
  description: string;
  permissions: any[];
  active: boolean;
}

export interface SubFeature {
  id: number;
  featureGroupId: number;
  name: string;
  displayName: string;
  description: string;
  sortOrder: number;
  active: boolean;
  accessLevels: SubFeatureAccessLevel[];
}

export interface SubFeatureAccessLevel {
  id: number;
  subFeatureId: number;
  levelName: string;
  levelOrder: number;
  displayName: string;
  permissions: any[];
  active: boolean;
}

export interface RoleFeatureAssignment {
  id?: number;
  roleId: number;
  featureGroupId: number;
  accessLevelId: number;
  dataScope: string;
  options: any;
  active?: boolean;
  featureGroup?: FeatureGroup;
  accessLevel?: AccessLevel;
  subFeatureAssignments?: RoleSubFeatureAssignment[];
}

export interface RoleSubFeatureAssignment {
  id?: number;
  roleFeatureAssignmentId: number;
  subFeatureId: number;
  accessLevelId: number;
  active?: boolean;
  subFeature?: SubFeature;
  accessLevel?: SubFeatureAccessLevel;
}

@Injectable({
  providedIn: 'root'
})
export class FeatureGroupService {
  private readonly API_SERVER = environment.apiHost;

  constructor(private http: HttpClient) {}

  /**
   * Get all feature groups with access levels and sub-features
   */
  getAllFeatureGroups(): Observable<FeatureGroup[]> {
    return this.http.get<FeatureGroup[]>(`${this.API_SERVER}/feature-groups`);
  }

  /**
   * Get a single feature group by ID
   */
  getFeatureGroupById(id: number): Observable<FeatureGroup> {
    return this.http.get<FeatureGroup>(`${this.API_SERVER}/feature-groups/${id}`);
  }

  /**
   * Get all feature assignments for a role
   */
  getRoleFeatureAssignments(roleId: number): Observable<RoleFeatureAssignment[]> {
    return this.http.get<RoleFeatureAssignment[]>(`${this.API_SERVER}/feature-groups/role/${roleId}`);
  }

  /**
   * Assign a feature group to a role
   */
  assignFeatureToRole(assignment: {
    roleId: number;
    featureGroupId: number;
    accessLevelId: number;
    dataScope?: string;
    options?: any;
  }): Observable<RoleFeatureAssignment> {
    return this.http.post<RoleFeatureAssignment>(
      `${this.API_SERVER}/feature-groups/assign`,
      assignment
    );
  }

  /**
   * Update a feature assignment
   */
  updateFeatureAssignment(
    assignmentId: number,
    updates: {
      accessLevelId?: number;
      dataScope?: string;
      options?: any;
    }
  ): Observable<RoleFeatureAssignment> {
    return this.http.put<RoleFeatureAssignment>(
      `${this.API_SERVER}/feature-groups/assignment/${assignmentId}`,
      updates
    );
  }

  /**
   * Remove a feature assignment from a role
   */
  removeFeatureFromRole(roleId: number, featureGroupId: number): Observable<RoleFeatureAssignment> {
    return this.http.delete<RoleFeatureAssignment>(
      `${this.API_SERVER}/feature-groups/role/${roleId}/feature/${featureGroupId}`
    );
  }

  /**
   * Assign a sub-feature to a role feature assignment
   */
  assignSubFeature(
    assignmentId: number,
    subFeatureId: number,
    accessLevelId: number
  ): Observable<RoleSubFeatureAssignment> {
    return this.http.post<RoleSubFeatureAssignment>(
      `${this.API_SERVER}/feature-groups/assignment/${assignmentId}/sub-feature`,
      { subFeatureId, accessLevelId }
    );
  }

  /**
   * Remove a sub-feature assignment
   */
  removeSubFeature(assignmentId: number, subFeatureId: number): Observable<RoleSubFeatureAssignment> {
    return this.http.delete<RoleSubFeatureAssignment>(
      `${this.API_SERVER}/feature-groups/assignment/${assignmentId}/sub-feature/${subFeatureId}`
    );
  }

  /**
   * Generate and preview permissions for a role
   */
  generateRolePermissions(roleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_SERVER}/feature-groups/role/${roleId}/permissions`);
  }
}
