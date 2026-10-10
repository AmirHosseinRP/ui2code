import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-button",
  standalone: true,
  imports: [CommonModule],
  template: `
    <button [ngClass]="variant" class="btn">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
    }
    .primary {
      background: #3b82f6;
      color: white;
    }
    .secondary {
      background: #6b7280;
      color: white;
    }
    .outline {
      border: 1px solid #d1d5db;
    }
  `],
})
export class ButtonComponent {
  @Input() variant: "primary" | "secondary" | "outline" = "primary";
}