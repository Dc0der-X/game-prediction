import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../core/money';

/** {{ 1600 | money: cur }} → "₹1,600";  {{ 54 | money: cur : true }} → "+₹54". */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency: string, signed = false): string {
    return formatMoney(value ?? 0, currency || 'USD', signed);
  }
}
