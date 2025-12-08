import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HsnService } from './hsn.service';

@Component({
  selector: 'app-hsn-list',
  templateUrl: './hsn-list.component.html',
  styleUrls: ['./hsn-list.component.scss']
})
export class HsnListComponent implements OnInit {
  hsnCodes: any[] = [];
  filteredCodes: any[] = [];
  categories: string[] = [];
  statistics: any[] = [];

  // Filters
  searchTerm: string = '';
  selectedCategory: string = '';
  activeOnly: boolean = true;

  loading: boolean = false;

  constructor(
    private hsnService: HsnService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadCategories();
    this.loadStatistics();
    this.loadHsnCodes();
  }

  loadCategories(): void {
    this.hsnService.getCategories().subscribe({
      next: (data: string[]) => {
        this.categories = data;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadStatistics(): void {
    this.hsnService.getStatistics().subscribe({
      next: (data: any[]) => {
        this.statistics = data;
      },
      error: (error) => {
        console.error('Error loading statistics:', error);
      }
    });
  }

  loadHsnCodes(): void {
    this.loading = true;
    this.hsnService.getAllHsnTaxCodes({
      category: this.selectedCategory || undefined,
      activeOnly: this.activeOnly,
      search: this.searchTerm || undefined
    }).subscribe({
      next: (data: any[]) => {
        this.hsnCodes = data;
        this.filteredCodes = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading HSN codes:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.loadHsnCodes();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.activeOnly = true;
    this.loadHsnCodes();
  }

  getTotalTaxRate(hsn: any): number {
    return Number(hsn.cgstrate) + Number(hsn.sgstrate);
  }

  editHsn(id: number): void {
    this.router.navigate(['/secure/products/hsn/edit', id]);
  }

  deleteHsn(hsn: any): void {
    if (confirm(`Are you sure you want to delete HSN code ${hsn.hsncode}?`)) {
      this.hsnService.deleteHsnTax(hsn.id).subscribe({
        next: () => {
          alert('HSN code deleted successfully');
          this.loadHsnCodes();
        },
        error: (error) => {
          console.error('Error deleting HSN code:', error);
          alert('Failed to delete HSN code');
        }
      });
    }
  }

  createNew(): void {
    this.router.navigate(['/secure/products/hsn/new']);
  }
}
