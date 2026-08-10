import { NgModule } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { UserInfoDialogComponent } from './user-info-dialog-component/user-info-dialog.component';
import { UserAddDialogComponent } from './user-add-dialog-component/user-add-dialog.component';
import { UserTableComponent } from './user-table-component/user-table.component';
import { UserBadgesComponent } from './user-badges-component/user-badges.component';
import { ScrollBarComponent } from './scroll-bar-component/scroll-bar.component';
import { LocaleDatePipe } from '../pipes/locale-date.pipe';

const components: any[] = [
  UserInfoDialogComponent,
  UserAddDialogComponent,
  UserTableComponent
];

@NgModule({
  declarations: [components],
  imports: [
    UserBadgesComponent,
    ScrollBarComponent,
    LocaleDatePipe,
    NgOptimizedImage,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule
  ],
  exports: [components]
})
export class UserComponentsModule { }
