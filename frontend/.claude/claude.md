# Frontend (Angular) - Development Guide

## Overview

This is the frontend SPA for the RGP Back Office system, built with Angular 12, NgRx, and PrimeNG.

**Development Port**: 4200
**Production Port**: 80 (via Nginx)

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── app.module.ts              # Root module
│   │   ├── app-routing.module.ts      # Main routing
│   │   ├── app.component.ts           # Root component
│   │   ├── pos.component.ts           # POS interface
│   │   ├── @core/                     # Core functionality
│   │   │   └── auth/                  # Authentication
│   │   │       ├── login/             # Login component
│   │   │       ├── logout/            # Logout component
│   │   │       ├── register/          # Registration
│   │   │       ├── changepwd/         # Password change
│   │   │       ├── auth.guard.ts      # Route guard
│   │   │       ├── auth.service.ts    # Auth service
│   │   │       ├── credentials.service.ts  # Token storage
│   │   │       └── auth-token.interceptor.ts  # HTTP interceptor
│   │   ├── shared/                    # Shared resources
│   │   │   ├── components/            # Reusable components
│   │   │   ├── directives/            # Custom directives
│   │   │   │   ├── isAuth.directive.ts      # Permission directive
│   │   │   │   └── isNavAuth.directive.ts   # Nav permission
│   │   │   ├── pipes/                 # Custom pipes
│   │   │   │   └── text-wrap.pipe.ts
│   │   │   └── services/              # Shared services
│   │   └── secured/                   # Protected routes (lazy-loaded)
│   │       ├── secured.module.ts
│   │       ├── dashboard.component/   # Dashboard with charts
│   │       ├── products/              # Product management
│   │       ├── customers/             # Customer management
│   │       ├── sales/                 # Sales module
│   │       ├── purchases/             # Purchase orders
│   │       ├── reports/               # Business reports
│   │       ├── documents/             # Document management
│   │       ├── settings/              # System settings
│   │       └── store/                 # NgRx state management
│   ├── assets/                        # Static assets
│   │   ├── vendor/                    # Third-party libraries
│   │   │   ├── apexcharts/
│   │   │   ├── bootstrap-icons/
│   │   │   └── tinymce/
│   │   ├── props.json                 # App properties
│   │   └── permissions.json           # Permission definitions
│   ├── environments/                  # Environment configs
│   │   ├── environment.ts             # Development
│   │   └── environment.prod.ts        # Production
│   ├── index.html                     # Entry HTML
│   ├── main.ts                        # Application bootstrap
│   └── styles.scss                    # Global styles
├── angular.json                       # Angular CLI config
├── tsconfig.json                      # TypeScript config
├── package.json                       # Dependencies
└── nginx.conf                         # Nginx configuration
```

## Angular Module Architecture

### Root Module (app.module.ts)
- Import core modules (BrowserModule, HttpClientModule)
- Import NgRx StoreModule and EffectsModule
- Import third-party modules (PrimeNG, Bootstrap)
- Declare root component and public components
- Configure providers (HTTP interceptors, guards)

### Routing Architecture
```
/ (root)
├── /login               # Public - Login page
├── /register            # Public - Registration
├── /changepwd           # Public - Password change
├── /pos                 # Public - POS interface
└── /secure              # Protected - Lazy loaded
    ├── /dashboard       # Dashboard overview
    ├── /products        # Product management
    ├── /customers       # Customer management
    ├── /sales           # Sales transactions
    ├── /purchases       # Purchase orders
    ├── /reports         # Business reports
    ├── /documents       # Document management
    └── /settings        # System settings
```

### Lazy Loading
The secured module is lazy-loaded for performance:
```typescript
// app-routing.module.ts
{
  path: 'secure',
  loadChildren: () => import('./secured/secured.module')
    .then(m => m.SecuredModule),
  canActivate: [AuthGuard]
}
```

## State Management (NgRx)

### Store Structure
```
secured/store/
├── actions/           # Action definitions
├── effects/           # Side effects (API calls)
├── reducers/          # State reducers
└── selectors/         # State selectors
```

### Actions
```typescript
// product.actions.ts
import { createAction, props } from '@ngrx/store';

export const loadProducts = createAction('[Products] Load Products');

export const loadProductsSuccess = createAction(
  '[Products] Load Products Success',
  props<{ products: Product[] }>()
);

export const loadProductsFailure = createAction(
  '[Products] Load Products Failure',
  props<{ error: any }>()
);
```

### Reducers
```typescript
// product.reducer.ts
import { createReducer, on } from '@ngrx/store';

export interface ProductState {
  products: Product[];
  loading: boolean;
  error: any;
}

const initialState: ProductState = {
  products: [],
  loading: false,
  error: null
};

export const productReducer = createReducer(
  initialState,
  on(loadProducts, state => ({ ...state, loading: true })),
  on(loadProductsSuccess, (state, { products }) => ({
    ...state,
    products,
    loading: false
  })),
  on(loadProductsFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false
  }))
);
```

### Effects
```typescript
// product.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';

@Injectable()
export class ProductEffects {
  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadProducts),
      mergeMap(() =>
        this.productService.getProducts().pipe(
          map(products => loadProductsSuccess({ products })),
          catchError(error => of(loadProductsFailure({ error })))
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private productService: ProductService
  ) {}
}
```

### Selectors
```typescript
// product.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';

export const selectProductState = createFeatureSelector<ProductState>('products');

export const selectAllProducts = createSelector(
  selectProductState,
  state => state.products
);

export const selectProductsLoading = createSelector(
  selectProductState,
  state => state.loading
);
```

### Using in Components
```typescript
export class ProductListComponent implements OnInit {
  products$ = this.store.select(selectAllProducts);
  loading$ = this.store.select(selectProductsLoading);

  constructor(private store: Store) {}

  ngOnInit() {
    this.store.dispatch(loadProducts());
  }
}
```

## Authentication

### Authentication Flow
1. User logs in via LoginComponent
2. AuthService calls API `/auth/login`
3. Token stored in localStorage via CredentialsService
4. HTTP interceptor adds token to all requests
5. AuthGuard protects secured routes

### Auth Guard
```typescript
// auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authService.isAuthenticated()) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}
```

### HTTP Interceptor
```typescript
// auth-token.interceptor.ts
@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.credentialsService.getToken();

    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req);
  }
}
```

### Credentials Service
```typescript
// credentials.service.ts
@Injectable({ providedIn: 'root' })
export class CredentialsService {
  private readonly TOKEN_KEY = 'auth_token';

  setToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }
}
```

## Permission Directives

### isAuth Directive
Used to show/hide elements based on permissions:
```html
<button *isAuth="'products:create'">Add Product</button>
```

### isNavAuth Directive
Used for navigation items:
```html
<li *isNavAuth="'sales:view'">
  <a routerLink="/secure/sales">Sales</a>
</li>
```

## Services

### Service Pattern
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiUrl = `${environment.apiHost}/products`;

  constructor(private http: HttpClient) {}

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
```

## Components

### Component Pattern
```typescript
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
  products$: Observable<Product[]>;
  loading$: Observable<boolean>;

  constructor(private store: Store) {}

  ngOnInit() {
    this.products$ = this.store.select(selectAllProducts);
    this.loading$ = this.store.select(selectProductsLoading);
    this.store.dispatch(loadProducts());
  }

  onDeleteProduct(id: number) {
    this.store.dispatch(deleteProduct({ id }));
  }
}
```

### Template Pattern
```html
<!-- product-list.component.html -->
<div class="card">
  <div class="card-header">
    <h3>Products</h3>
    <button
      pButton
      label="Add Product"
      icon="pi pi-plus"
      *isAuth="'products:create'"
      (click)="showAddDialog()">
    </button>
  </div>

  <div class="card-body">
    <p-table
      [value]="products$ | async"
      [loading]="loading$ | async"
      [paginator]="true"
      [rows]="10">

      <ng-template pTemplate="header">
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Price</th>
          <th>Actions</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-product>
        <tr>
          <td>{{ product.id }}</td>
          <td>{{ product.name }}</td>
          <td>{{ product.price | currency }}</td>
          <td>
            <button
              pButton
              icon="pi pi-pencil"
              class="p-button-text"
              *isAuth="'products:update'"
              (click)="onEditProduct(product)">
            </button>
            <button
              pButton
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              *isAuth="'products:delete'"
              (click)="onDeleteProduct(product.id)">
            </button>
          </td>
        </tr>
      </ng-template>
    </p-table>
  </div>
</div>
```

## PrimeNG Components

### Commonly Used Components

**Table (p-table)**:
```html
<p-table
  [value]="data"
  [paginator]="true"
  [rows]="10"
  [showCurrentPageReport]="true"
  currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
  [rowsPerPageOptions]="[10,25,50]">
</p-table>
```

**Dialog (p-dialog)**:
```html
<p-dialog
  header="Add Product"
  [(visible)]="displayDialog"
  [modal]="true"
  [style]="{width: '50vw'}">
  <form [formGroup]="productForm">
    <!-- Form content -->
  </form>
  <p-footer>
    <button pButton label="Cancel" (click)="displayDialog=false"></button>
    <button pButton label="Save" (click)="onSave()"></button>
  </p-footer>
</p-dialog>
```

**Dropdown (p-dropdown)**:
```html
<p-dropdown
  [options]="categories"
  [(ngModel)]="selectedCategory"
  optionLabel="name"
  placeholder="Select Category">
</p-dropdown>
```

**Calendar (p-calendar)**:
```html
<p-calendar
  [(ngModel)]="date"
  dateFormat="yy-mm-dd"
  [showIcon]="true">
</p-calendar>
```

**Toast (p-toast)**:
```typescript
// In component
this.messageService.add({
  severity: 'success',
  summary: 'Success',
  detail: 'Product created successfully'
});
```

## Forms

### Reactive Forms
```typescript
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export class ProductFormComponent implements OnInit {
  productForm: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      price: ['', [Validators.required, Validators.min(0)]],
      description: [''],
      category_id: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.productForm.valid) {
      const product = this.productForm.value;
      // Dispatch action or call service
    }
  }
}
```

### Template
```html
<form [formGroup]="productForm" (ngSubmit)="onSubmit()">
  <div class="field">
    <label for="name">Name</label>
    <input
      id="name"
      type="text"
      pInputText
      formControlName="name">
    <small
      class="p-error"
      *ngIf="productForm.get('name')?.invalid && productForm.get('name')?.touched">
      Name is required
    </small>
  </div>

  <div class="field">
    <label for="price">Price</label>
    <input
      id="price"
      type="number"
      pInputText
      formControlName="price">
  </div>

  <button
    type="submit"
    pButton
    label="Save"
    [disabled]="productForm.invalid">
  </button>
</form>
```

## Routing

### Navigation
```typescript
// Programmatic navigation
constructor(private router: Router) {}

navigateToProduct(id: number) {
  this.router.navigate(['/secure/products', id]);
}

// With query params
this.router.navigate(['/secure/products'], {
  queryParams: { category: 'electronics' }
});
```

### Route Parameters
```typescript
import { ActivatedRoute } from '@angular/router';

constructor(private route: ActivatedRoute) {}

ngOnInit() {
  // Path params
  this.route.params.subscribe(params => {
    const id = params['id'];
  });

  // Query params
  this.route.queryParams.subscribe(params => {
    const category = params['category'];
  });
}
```

## Styling

### Component Styles
```scss
// product-list.component.scss
.product-card {
  margin: 1rem;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
```

### Global Styles
Located in `src/styles.scss`:
- Bootstrap styles
- PrimeNG theme
- Custom global styles

### Theme Customization
PrimeNG theme can be customized in `angular.json`:
```json
"styles": [
  "node_modules/primeng/resources/themes/saga-blue/theme.css",
  "node_modules/primeng/resources/primeng.min.css",
  "node_modules/primeicons/primeicons.css"
]
```

## Environment Configuration

### Development (environment.ts)
```typescript
export const environment = {
  production: false,
  apiHost: 'http://localhost:3000'
};
```

### Production (environment.prod.ts)
```typescript
export const environment = {
  production: true,
  apiHost: 'https://api.yourdomain.com'
};
```

### Usage
```typescript
import { environment } from '@env/environment';

const apiUrl = environment.apiHost;
```

## Commands Reference

```bash
# Development
npm start                # Start dev server (port 4200)
ng serve                 # Same as npm start
ng serve --open          # Open browser automatically

# Build
ng build                 # Development build
ng build --configuration production  # Production build
ng build --prod          # Production build (shorthand)

# Testing
ng test                  # Run Jasmine/Karma tests
ng test --code-coverage  # With coverage report

# Code Generation
ng generate component secured/feature-name  # Generate component
ng generate service shared/services/my-service  # Generate service
ng generate module secured/feature-name --routing  # Module with routing
```

## Best Practices

1. **Smart vs Presentational Components**:
   - Smart: Connected to store, handle business logic
   - Presentational: Pure components with @Input/@Output

2. **OnPush Change Detection**:
   ```typescript
   @Component({
     changeDetection: ChangeDetectionStrategy.OnPush
   })
   ```

3. **Unsubscribe from Observables**:
   ```typescript
   ngOnDestroy() {
     this.subscription.unsubscribe();
   }
   // Or use async pipe in template
   ```

4. **Lazy Loading**: Use for large feature modules

5. **TrackBy for Lists**:
   ```html
   <tr *ngFor="let item of items; trackBy: trackById">
   ```

6. **Type Safety**: Use interfaces for all data models

7. **Error Handling**:
   ```typescript
   this.service.getData().pipe(
     catchError(error => {
       this.messageService.add({
         severity: 'error',
         summary: 'Error',
         detail: error.message
       });
       return of([]);
     })
   )
   ```

## Common Pitfalls

1. **Memory Leaks**: Always unsubscribe or use async pipe
2. **Mutating State**: NgRx state should be immutable
3. **Too Many Subscriptions**: Use async pipe when possible
4. **Missing Error Handling**: Always handle HTTP errors
5. **Not Using OnPush**: Can cause performance issues
6. **Hardcoded URLs**: Use environment configs
7. **Missing Loading States**: Always show loading indicators

## Performance Tips

1. Use OnPush change detection
2. Lazy load feature modules
3. Use trackBy in ngFor loops
4. Implement virtual scrolling for long lists
5. Use async pipe to auto-unsubscribe
6. Avoid function calls in templates
7. Use pure pipes
8. Optimize images and assets

## Debugging

### Chrome DevTools
- Redux DevTools for NgRx state inspection
- Network tab for API calls
- Console for errors

### Source Maps
Enabled in development for debugging TypeScript

### Angular DevTools
Chrome extension for Angular debugging

## Key Dependencies

- `@angular/*` (v12.2.0) - Core framework
- `@ngrx/*` (v12.5.1) - State management
- `primeng` (v12.2.2) - UI components
- `bootstrap` (v5.2.3) - Layout framework
- `rxjs` (v6.6.0) - Reactive programming
- `@auth0/angular-jwt` (v5.0.2) - JWT handling
- `file-saver` (v2.0.5) - File downloads
- `@swimlane/ngx-charts` (v20.1.2) - Charts
