import { effect, Signal } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

export function wireDataSource<T>(
  dataSource: MatTableDataSource<T>,
  rows: Signal<T[]>,
  sorter: Signal<MatSort | undefined>,
  pager: Signal<MatPaginator | undefined>,
): void {
  effect((): T[] => dataSource.data = rows());

  effect((): void => {
    const sort: MatSort | undefined = sorter();
    if (sort) dataSource.sort = sort;
  });

  effect((): void => {
    const paginator: MatPaginator | undefined = pager();
    if (paginator) dataSource.paginator = paginator;
  });
}